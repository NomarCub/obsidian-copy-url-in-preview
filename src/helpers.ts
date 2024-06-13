import { App, Notice, TFile } from "obsidian";
import { Listener } from "types";

export const timeouts = {
	loadImageBlob: 5_000,
	longTap: 500,
	deleteTempFile: 60_000,
	openPdfMenu: 5_000,
	successNotice: 1_800
};
export const strings = {
	menuItems: {
		copyImageToClipboard: "Copy image to clipboard"
	},
	messages: {
		imageCopied: "Image copied to the clipboard!",
		imageCopyFailed: "Error, could not copy the image!",
	}
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

export async function copyImageToClipboard(url: string | ArrayBuffer) {
	const blob = url instanceof ArrayBuffer
		? new Blob([url], { type: "image/png", })
		: await loadImageBlob(url);
	try {
		const data = new ClipboardItem({ [blob.type]: blob, });
		await navigator.clipboard.write([data]);
		new Notice(strings.messages.imageCopied, timeouts.successNotice);
	} catch (e) {
		console.error(e);
		new Notice(strings.messages.imageCopyFailed);
	}
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
	return withTimeout(timeouts.loadImageBlob, loadImageBlobCore())
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
	app.workspace.getLeaf(true).openFile(tfile, { active: true });
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

