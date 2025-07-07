import { App, MenuItem, normalizePath, Notice, Platform, TFile } from "obsidian";

export const timeouts = {
    loadImageBlob: 5_000,
    successNotice: 1_800,
};

export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => { reject(new Error(`timed out after ${ms} ms`)); }, ms));
    return Promise.race([
        promise,
        timeout,
    ]);
}

export async function copyImageToClipboard(url: string | ArrayBuffer): Promise<void> {
    const blob = url instanceof ArrayBuffer
        ? new Blob([url], { type: "image/png" })
        : await loadImageBlob(url);
    try {
        const data = new ClipboardItem({ [blob!.type]: blob! });
        await navigator.clipboard.write([data]);
        new Notice(i18next.t("interface.copied_generic"), timeouts.successNotice);
    } catch (e) {
        console.error(e);
        new Notice(i18next.t("interface.copy_failed"));
    }
}

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
// option?: https://www.npmjs.com/package/html-to-image
export function loadImageBlob(imgSrc: string): Promise<Blob | null> {
    const loadImageBlobCore = (): Promise<Blob | null> => new Promise<Blob | null>((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const ctx = canvas.getContext("2d")!;
            ctx.drawImage(image, 0, 0);
            canvas.toBlob(blob => { resolve(blob); });
        };
        image.onerror = async () => {
            try {
                await fetch(image.src, { mode: "no-cors" });

                // console.log("possible CORS violation, falling back to allOrigins proxy");
                // https://github.com/gnuns/allOrigins
                const blob = await loadImageBlob(`https://api.allorigins.win/raw?url=${encodeURIComponent(imgSrc)}`);
                resolve(blob);
            } catch {
                reject(new Error());
            }
        };
        image.src = imgSrc;
    });
    return withTimeout(timeouts.loadImageBlob, loadImageBlobCore());
}

export function onElementToOff<K extends keyof DocumentEventMap>(
    element: Document,
    type: K,
    selector: string,
    listener: (
        this: Document,
        ev: DocumentEventMap[K],
        delegateTarget: HTMLElement,
    ) => unknown,
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
    urlPath = urlPath.split("/").filter(part => part !== "").join("/");

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

type MenuType
  = "open-in-new-tab"
    | "copy-to-clipboard"
    | "open-in-default-app"
    | "show-in-explorer"
    | "reveal-in-navigation"
    | "reveal-in-navigation-tree"
    | "rename-file";

export function setMenuItem(item: MenuItem, type: "copy-to-clipboard", imageSource: string | Promise<ArrayBuffer>): MenuItem;
export function setMenuItem(item: MenuItem, type: MenuType): MenuItem;
export function setMenuItem(item: MenuItem, type: MenuType, imageSource?: string | Promise<ArrayBuffer>): MenuItem {
    const types: Record<MenuType, { icon: string; title: string; section: "info" | "system" | "open" }> = {
        "copy-to-clipboard": { section: "info", icon: "image-file", title: "interface.label-copy" },
        "open-in-new-tab": { section: "open", icon: "file-plus", title: "interface.menu.open-in-new-tab" },
        "open-in-default-app": {
            section: "system", icon: "arrow-up-right",
            title: "plugins.open-with-default-app.action-open-file",
        },
        "show-in-explorer": {
            section: "system", icon: "arrow-up-right",
            title: `plugins.open-with-default-app.action-show-in-folder${Platform.isMacOS ? "-mac" : ""}`,
        },
        "reveal-in-navigation": { section: "system", icon: "folder", title: "plugins.file-explorer.action-reveal-file" },
        "reveal-in-navigation-tree": { section: "system", icon: "folder", title: "Reveal in File Tree Alternative" },
        "rename-file": {
            section: "info",
            icon: "pencil",
            title: "interface.menu.rename",
        },
    };

    if (type === "copy-to-clipboard" && imageSource) {
        item.onClick(async () => {
            await copyImageToClipboard(typeof imageSource === "string" ? imageSource : await imageSource);
        });
    }

    return item
        .setIcon(types[type].icon)
        .setTitle(i18next.t(types[type].title))
        .setSection(types[type].section);
}
