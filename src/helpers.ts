import { type App, Notice, normalizePath, TFile } from "obsidian";

/** URL string or internal image. */
type ImageType = string | TFile;

export const timeouts = {
    loadImageBlob: 5_000,
    successNotice: 1_800,
};

export function isImageFile(path: string): boolean {
    const imageFileExtensions = ["avif", "bmp", "gif", "jpg", "jpeg", "png", "svg", "webp", "heic"];
    path = path.toLowerCase();
    return imageFileExtensions.some((ext) => path.endsWith(`.${ext}`));
}

/* Remove search params from URL */
export function clearUrl(url: URL | string): string {
    url = new URL(url);
    url.search = "";
    return url.toString();
}

export async function copyImageToClipboard(image: ImageType): Promise<void> {
    const blob = await getImageBlob(image);
    if (!blob) return;

    try {
        const data = new ClipboardItem({ [blob.type]: blob });
        await navigator.clipboard.write([data]);
        new Notice(i18next.t("interface.copied_generic"), timeouts.successNotice);
    } catch (e) {
        console.error(e);
        new Notice(i18next.t("interface.copy_failed"));
    }
}

async function getImageBlob(file: ImageType): Promise<Blob | null> {
    return file instanceof TFile
        ? new Blob([await file.vault.readBinary(file)], { type: "image/png" })
        : await loadImageBlob(file);
}

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
// option?: https://www.npmjs.com/package/html-to-image
function loadImageBlob(imgSrc: string): Promise<Blob | null> {
    const loadImageBlobCore = (): Promise<Blob | null> =>
        new Promise<Blob | null>((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";

            image.onload = () => {
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const ctx = canvas.getContext("2d")!;
                ctx.drawImage(image, 0, 0);
                canvas.toBlob((blob) => {
                    resolve(blob);
                });
            };
            image.onerror = async () => {
                try {
                    await fetch(image.src, { mode: "no-cors" });

                    // console.log("possible CORS violation, falling back to allOrigins proxy");
                    // https://github.com/gnuns/allOrigins
                    const blob = await loadImageBlob(
                        `https://api.allorigins.win/raw?url=${encodeURIComponent(imgSrc)}`,
                    );
                    resolve(blob);
                } catch {
                    reject(new Error());
                }
            };

            image.src = imgSrc;
        });
    return withTimeout(timeouts.loadImageBlob, loadImageBlobCore());
}

export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => {
            reject(new Error(`timed out after ${ms} ms`));
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
