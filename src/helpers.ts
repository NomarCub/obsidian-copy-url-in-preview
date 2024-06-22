import { App, Menu, MenuItem, Notice, Platform, TFile } from "obsidian";

export const timeouts = {
	loadImageBlob: 5_000,
	longTap: 500,
	deleteTempFile: 60_000,
	openPdfMenu: 5_000,
	successNotice: 1_800
};

export function withTimeout<T>(ms: number, promise: Promise<T>): Promise<T> {
	const timeout = new Promise<never>((_, reject) =>
		setTimeout(() => reject(`timed out after ${ms} ms`), ms));
	return Promise.race([
		promise,
		timeout
	]);
}

export async function copyImageToClipboard(url: string | ArrayBuffer) {
	const blob = url instanceof ArrayBuffer
		? new Blob([url], { type: "image/png", })
		: await loadImageBlob(url);
	try {
		const data = new ClipboardItem({ [blob!.type]: blob!, });
		await navigator.clipboard.write([data]);
		new Notice("Image copied to the clipboard!", timeouts.successNotice);
	} catch (e) {
		console.error(e);
		new Notice("Error, could not copy the image!");
	}
}

// https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
// option?: https://www.npmjs.com/package/html-to-image
export async function loadImageBlob(imgSrc: string): Promise<Blob | null> {
	const loadImageBlobCore = () => new Promise<Blob | null>((resolve, reject) => {
		const image = new Image();
		image.crossOrigin = "anonymous";
		image.onload = () => {
			const canvas = document.createElement("canvas");
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(image, 0, 0);
			canvas.toBlob(blob => resolve(blob));
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
	return withTimeout(timeouts.loadImageBlob, loadImageBlobCore())
}

export function onElement<K extends keyof DocumentEventMap>(
	el: Document, type: K, selector: string,
	listener: (this: Document, ev: DocumentEventMap[K], delegateTarget: HTMLElement) => unknown,
	options?: boolean | AddEventListenerOptions
) {
	el.on(type, selector, listener, options);
	return () => el.off(type, selector, listener, options);
}

export function imageElementFromMouseEvent(event: MouseEvent): HTMLImageElement | undefined {
	const imageElement = event.target;
	if (!(imageElement instanceof HTMLImageElement)) {
		console.error("imageElement is supposed to be a HTMLImageElement. imageElement:", imageElement);
	}
	else {
		return imageElement;
	}
}

export function getRelativePath(url: URL, app: App): string | undefined {
	// getResourcePath("") also works for root path
	const baseFileUrl = app.vault.adapter.getFilePath("");
	const basePath = baseFileUrl.replace("file://", "");

	const urlPathName: string = url.pathname;
	if (urlPathName.startsWith(basePath)) {
		const relativePath = urlPathName.substring(basePath.length + 1);
		return decodeURI(relativePath);
	}
}

export function openTfileInNewTab(app: App, tfile: TFile) {
	void app.workspace.getLeaf(true).openFile(tfile, { active: true });
}

export function openImageInNewTabFromEvent(app: App, event: MouseEvent) {
	const image = imageElementFromMouseEvent(event);
	if (!image) return;

	const activeFile = app.workspace.getActiveFile();
	const link = getRelativePath(new URL(image.src), app);
	if (!link) return;
	const imageAsTFile = activeFile
		? app.metadataCache.getFirstLinkpathDest(link, activeFile.path)
		: app.vault.getAbstractFileByPath(link);

	if (imageAsTFile && imageAsTFile instanceof TFile) {
		openTfileInNewTab(app, imageAsTFile);
	}
}

export function registerEscapeButton(menu: Menu) {
	const document = activeDocument;
	menu.register(onElement(
		document, "keydown", "*",
		e => {
			if (e instanceof KeyboardEvent && e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				menu.hide();
			}
		}));
}

type menuType =
	"open-in-new-tab" |
	"copy-to-clipboard" |
	"open-in-default-app" |
	"show-in-explorer" |
	"reveal-in-navigation" |
	"open-pdf";

export function setMenuItem(item: MenuItem, type: "copy-to-clipboard", imageSource: Promise<ArrayBuffer>): MenuItem;
export function setMenuItem(item: MenuItem, type: "copy-to-clipboard", imageSource: string): MenuItem;
export function setMenuItem(item: MenuItem, type: menuType): MenuItem;
export function setMenuItem(item: MenuItem, type: menuType, imageSource?: string | Promise<ArrayBuffer>): MenuItem {
	const types: Record<menuType, { icon: string, title: string, section: "info" | "system" | "open" }> = {
		"copy-to-clipboard": { section: "info", icon: "image-file", title: "interface.label-copy" },
		"open-in-new-tab": { section: "open", icon: "file-plus", title: "interface.menu.open-in-new-tab" },
		"open-in-default-app": { section: "system", icon: "arrow-up-right", title: "plugins.open-with-default-app.action-open-file" },
		"show-in-explorer": {
			section: "system", icon: "arrow-up-right",
			title: "plugins.open-with-default-app.action-show-in-folder" + (Platform.isMacOS ? "-mac" : "")
		},
		"reveal-in-navigation": { section: "system", icon: "folder", title: "plugins.file-explorer.action-reveal-file" },
		"open-pdf": { section: "system", icon: "arrow-up-right", title: "plugins.open-with-default-app.action-open-file" },
	}
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

