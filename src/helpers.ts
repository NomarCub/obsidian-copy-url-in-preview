import { type App, Notice, normalizePath, TFile } from "obsidian";

/** URL string or internal image. */
type ImageType = string | TFile;

export const timeouts = {
    loadImageBlob: 5_000,
    notice: 1_800,
};

export function isImageFile(path: string): boolean {
    const imageFileExtensions = ["avif", "bmp", "gif", "jpg", "jpeg", "png", "svg", "webp", "heic"];
    path = path.toLowerCase();
    return imageFileExtensions.some((ext) => path.endsWith(`.${ext}`));
}

/** Remove search params from URL */
export function clearUrl(url: URL | string): string {
    url = new URL(url);
    url.search = "";
    return url.toString();
}

export async function copyImageToClipboard(image: ImageType): Promise<void> {
    const successNotice = (): void => {
        new Notice(i18next.t("interface.copied_generic"), timeouts.notice);
    };
    const failureNotice = (): void => {
        new Notice(i18next.t("Failed to copy image to clipboard"), timeouts.notice);
    };

    if (image instanceof TFile) {
        const blob = new Blob([await image.vault.readBinary(image)], { type: `image/${image.extension}` });
        if (await copyBlobToClipboardWithPNGFallback(blob)) {
            successNotice();
            return;
        } else {
            failureNotice();
            return;
        }
    }

    let blob = await getExternalImageBlob(image);
    if (blob && (await copyBlobToClipboardWithPNGFallback(blob))) {
        successNotice();
        return;
    }

    // see https://allorigins.win/
    // see also
    // https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
    // https://www.npmjs.com/package/html-to-image
    // also consider the Obsidian API that has no CORS restriction, but also no blob type: https://docs.obsidian.md/Reference/TypeScript+API/requestUrl
    const corsFreeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(image)}`;
    blob = await getExternalImageBlob(corsFreeUrl);
    if (blob && (await copyBlobToClipboardWithPNGFallback(blob))) {
        successNotice();
        return;
    }

    blob = await withTimeout(timeouts.loadImageBlob, getExternalImageBlobWithCanvas(image));
    if (blob && (await copyBlobToClipboardWithPNGFallback(blob))) {
        successNotice();
        return;
    }

    blob = await withTimeout(timeouts.loadImageBlob, getExternalImageBlobWithCanvas(corsFreeUrl));
    if (blob && (await copyBlobToClipboardWithPNGFallback(blob))) {
        successNotice();
        return;
    }

    failureNotice();
}

async function copyBlobToClipboardWithPNGFallback(blob: Blob): Promise<boolean> {
    try {
        // copying SVGs this way doesn't seem to work on Windows
        if (ClipboardItem.supports(blob.type) && blob.type !== "image/svg+xml") {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return true;
        }
    } catch (e) {
        console.warn("Failed copying image with original mimetype, using PNG fallback - ", e);
    }

    try {
        blob = new Blob([blob], { type: "image/png" });
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return true;
    } catch (e) {
        console.warn("Failed copying image with PNG mimetype - ", e);
    }

    return false;
}

async function getExternalImageBlob(url: string): Promise<Blob | null> {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(timeouts.loadImageBlob) });
        return await response.blob();
    } catch (e) {
        console.warn("Failed to fetch image - ", e);
    }
    return null;
}

function getExternalImageBlobWithCanvas(url: string): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";

        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d")!.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                resolve(blob);
            });
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = url;
    });
}

function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T | null> {
    const timeout = new Promise<null>((resolve) =>
        setTimeout(() => {
            resolve(null);
        }, ms),
    );
    return Promise.race([promise, timeout]);
}

export function onElementToOff<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    selector: string,
    listener: (this: Document, ev: DocumentEventMap[K], delegateTarget: HTMLElement) => unknown,
    options?: AddEventListenerOptions,
) {
    element.on(type, selector, listener, options);

    return () => {
        element.off(type, selector, listener, options);
    };
}

export function getTfileFromUrl(app: App, url: URL): TFile | null {
    let basePath = normalizePath(app.vault.adapter.basePath);
    basePath = basePath.replace("file://", "");

    let urlPath = url.pathname;
    urlPath = urlPath.replace("/_capacitor_file_", ""); // clear url on mobile
    urlPath = urlPath
        .split("/")
        .filter((part) => part !== "")
        .join("/");

    if (urlPath.startsWith(basePath)) {
        const relativePath = urlPath.slice(basePath.length + 1);
        const decodedPath = decodeURI(relativePath);
        return app.vault.getFileByPath(decodedPath);
    }

    return null;
}

export function openTfileInNewTab(app: App, tfile: TFile): void {
    void app.workspace.getLeaf(true).openFile(tfile, { active: true });
}
