import { App, FileSystemAdapter } from "obsidian";

const loadImageBlobTimeout = 5_000;

export interface ElectronWindow extends Window {
    WEBVIEW_SERVER_URL: string
}

export interface FileSystemAdapterWithInternalApi extends FileSystemAdapter {
    open(path: string): Promise<void>
}

export interface Listener {
    (this: Document, ev: Event): unknown;
}

export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
    const timeout = new Promise((_resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(`timed out after ${ms} ms`)
        }, ms)
    }) as unknown as Promise<T>;
    return Promise.race([
        promise,
        timeout
    ]);
}

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
// option?: https://www.npmjs.com/package/html-to-image
export async function loadImageBlob(imgSrc: string): Promise<Blob> {
    const loadImageBlobCore = () => new Promise<Blob>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(image, 0, 0);
            canvas.toBlob((blob: Blob) => {
                resolve(blob);
            });
        };
        image.onerror = async () => {
            try {
                await fetch(image.src, { "mode": "no-cors" });

                // console.log("possible CORS violation, falling back to allOrigins proxy");
                // https://github.com/gnuns/allOrigins
                const blob = await loadImageBlob(`https://api.allorigins.win/raw?url=${encodeURIComponent(imgSrc)}`);
                resolve(blob);
            } catch {
                reject();
            }
        }
        image.src = imgSrc;
    });
    return withTimeout(loadImageBlobTimeout, loadImageBlobCore())
}

export function onElement(
    el: Document, event: keyof HTMLElementEventMap, selector: string,
    listener: Listener,
    options?: { capture?: boolean; }
) {
    el.on(event, selector, listener, options);
    return () => el.off(event, selector, listener, options);
}

export function imageElementFromMouseEvent(event: MouseEvent): HTMLImageElement | undefined {
    const imageElement = event.target;
    if (!(imageElement instanceof HTMLImageElement)) {
        console.error("imageElement is supposed to be a HTMLImageElement. imageElement:");
        console.error(imageElement);
    }
    else {
        return imageElement;
    }
}

export function openImageFromMouseEvent(event: MouseEvent, app: App) {
    const image = imageElementFromMouseEvent(event);
    if (!image) return;

    const imageSrc = image.currentSrc;
    const url = new URL(imageSrc);

    const basePath = app.vault.adapter.basePath;

    const leaf = app.workspace.getLeaf(true);
    app.workspace.setActiveLeaf(leaf, { focus: true });

    if (url.pathname.startsWith(basePath)) {
        const titleContainerEl = (leaf.view as any).titleContainerEl;
        titleContainerEl.empty();
        titleContainerEl.createEl("div", { text: url.pathname.substring(basePath.length + 1) })
    }

    const contentEl = (leaf.view as any).contentEl;
    contentEl.empty();

    const div = contentEl.createEl("div", {});
    const img = div.appendChild(document.createElement("img"));
    img.src = imageSrc;
}