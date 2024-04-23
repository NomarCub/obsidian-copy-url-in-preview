import { FileSystemAdapter } from "obsidian";

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
    const timeout = new Promise((resolve, reject) => {
        const id = setTimeout(() => {
            clearTimeout(id);
            reject(`timed out after ${ms} ms`)
        }, ms)
    })
    return Promise.race([
        promise,
        timeout
    ]) as Promise<T>
}

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
// option?: https://www.npmjs.com/package/html-to-image
export async function loadImageBlob(imgSrc: string): Promise<Blob> {
    const loadImageBlobCore = () => {
        return new Promise<Blob>((resolve, reject) => {
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
    };
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

export function openImageFromMouseEvent(event: MouseEvent) {
    const image = event.target;
    if (image != null) {
        const img_src = image.currentSrc;
        const url = new URL(img_src);

        const basePath = this.app.vault.adapter.basePath + require('path').sep;

        const leaf = this.app.workspace.getLeaf(true);
        this.app.workspace.setActiveLeaf(leaf, { focus: true });

        if (url.pathname.startsWith(basePath)) {
            const titleContainerEl = leaf.view.titleContainerEl;
            titleContainerEl.empty();
            titleContainerEl.createEl("div", { text: url.pathname.substring(basePath.length) })
        }

        const contentEl = leaf.view.contentEl;
        contentEl.empty();

        const div = contentEl.createEl("div", {});
        const img = div.appendChild(document.createElement("img"));
        img.src = img_src;
    }
}