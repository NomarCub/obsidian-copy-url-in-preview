import { Menu, Plugin, Notice, MenuItem, Platform, TFile, MarkdownView } from "obsidian";
import {
	loadImageBlob, onElement, openImageFromMouseEvent,
	ElectronWindow, FileSystemAdapterWithInternalApi,
	imageElementFromMouseEvent, getRelativePath,
	CanvasNodeWithUrl
} from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as internal from 'obsidian-typings';
import { CopyUrlInPreviewSettingTab, CopyUrlInPreviewSettings, DEFAULT_SETTINGS } from "settings";

const IMAGE_URL_PREFIX = "/_capacitor_file_";
const SUCCESS_NOTICE_TIMEOUT = 1_800;
const longTapTimeout = 500;
const deleteTempFileTimeout = 60_000;
const OPEN_PDF_MENU_BORDER_SIZE = 100;
const OPEN_PDF_MENU_TIMEOUT = 5_000;

const strings = {
	menuItems: {
		copyImageToClipboard: "Copy image to clipboard"
	},
	messages: {
		imageCopied: "Image copied to the clipboard!",
		imageCopyFailed: "Error, could not copy the image!",
	}
}

export default class CopyUrlInPreview extends Plugin {
	longTapTimeoutId?: number;
	openPdfMenu?: Menu;
	preventReopenPdfMenu: boolean;
	lastHoveredLinkTarget: string;

	settings: CopyUrlInPreviewSettings;
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async copyImage(url: string | ArrayBuffer) {
		const blob = url instanceof ArrayBuffer ? new Blob([url], { type: "image/png", }) : await loadImageBlob(url);
		try {
			const data = new ClipboardItem({ [blob.type]: blob, });
			await navigator.clipboard.write([data]);
			new Notice(strings.messages.imageCopied, SUCCESS_NOTICE_TIMEOUT);
		} catch (e) {
			console.log(e);
			new Notice(strings.messages.imageCopyFailed);
		}
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CopyUrlInPreviewSettingTab(this.app, this));
		this.registerDocument(document);
		this.app.workspace.on("window-open", (_workspaceWindow, window) => {
			this.registerDocument(window.document);
		});
		// register the image menu for canvas
		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
			if (source === "canvas-menu" && file instanceof TFile
				&& file.extension.match(/(avif|bmp|gif|jpe?g|png|svg|webp)/i)) {
				menu.addItem((item) => item
					.setIcon("image-file")
					.setSection("system")
					.setTitle(strings.menuItems.copyImageToClipboard)
					.onClick(async () => { await this.copyImage(await this.app.vault.readBinary(file)); }));
			}
		}));
		this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu, node: CanvasNodeWithUrl) => {
			if (node.unknownData?.type === "link") {
				const url = node.unknownData?.url;
				menu.addItem((item) => item
					.setSection("canvas")
					.setIcon("image-file")
					.setTitle(strings.menuItems.copyImageToClipboard)
					.onClick(async () => { await this.copyImage(url); }));
			}
		}));
		this.registerEvent(this.app.workspace.on("url-menu", (menu, url) => {
			if (url.match(/(avif|bmp|gif|jpe?g|png|svg|webp)$/gi)) {
				menu.addItem((item) => item
					.setIcon("image-file")
					.setTitle(strings.menuItems.copyImageToClipboard)
					.onClick(async () => {
						await this.copyImage(url);
					}));
			}
		}));
	}

	registerDocument(document: Document) {
		this.register(onElement(
			document, "mouseover", ".pdf-embed iframe, .pdf-embed div.pdf-container, .workspace-leaf-content[data-type=pdf]",
			this.showOpenPdfMenu.bind(this)
		));

		this.register(onElement(
			document, "mousemove", ".pdf-canvas",
			this.showOpenPdfMenu.bind(this)
		));

		if (Platform.isDesktop) {
			this.register(onElement(
				document, "contextmenu", "img",
				this.onImageContextMenu.bind(this)
			));

			this.register(onElement(
				document, "mouseup", "img",
				this.onImageMouseUp.bind(this)
			));

			this.register(onElement(
				document, "mouseover", ".cm-link, .cm-hmd-internal-link",
				this.storeLastHoveredLinkInEditor.bind(this)
			));

			this.register(onElement(
				document, "mouseover", "a.internal-link",
				this.storeLastHoveredLinkInPreview.bind(this)
			));
		} else {
			this.register(onElement(
				document, "touchstart", "img",
				this.startWaitingForLongTap.bind(this)
			));

			this.register(onElement(
				document, "touchend", "img",
				this.stopWaitingForLongTap.bind(this)
			));

			this.register(onElement(
				document, "touchmove", "img",
				this.stopWaitingForLongTap.bind(this)
			));
		}
	}

	storeLastHoveredLinkInEditor(event: MouseEvent) {
		const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
		if (!editor) {
			return;
		}
		const position = editor.posAtMouse(event);
		const token = editor.getClickableTokenAt(position);
		if (!token) {
			return;
		}
		this.lastHoveredLinkTarget = token.text;
	}

	storeLastHoveredLinkInPreview(_event: MouseEvent, link: HTMLAnchorElement) {
		this.lastHoveredLinkTarget = link.getAttribute("data-href")!;
	}

	showOpenPdfMenu(event: MouseEvent | PointerEvent, el: HTMLElement) {
		if (!this.settings.pdfMenu || this.openPdfMenu || this.preventReopenPdfMenu) {
			return;
		}
		if (!this.settings.enableDefaultOnCanvas && this.app.workspace.getActiveFile()?.extension === "canvas") {
			return;
		}

		const rect = el.getBoundingClientRect();
		if (rect.left + OPEN_PDF_MENU_BORDER_SIZE < event.x
			&& event.x < rect.right - OPEN_PDF_MENU_BORDER_SIZE
			&& rect.top + OPEN_PDF_MENU_BORDER_SIZE < event.y
			&& event.y < rect.bottom - OPEN_PDF_MENU_BORDER_SIZE) {
			return;
		}

		const pdfEmbed = el.closest(".pdf-embed");
		let pdfFile: TFile;
		if (pdfEmbed) {
			let pdfLink: string;
			if (pdfEmbed.hasClass("popover")) {
				pdfLink = this.lastHoveredLinkTarget;
			}
			else {
				pdfLink = pdfEmbed.getAttr("src") ?? this.lastHoveredLinkTarget;
			}

			pdfLink = pdfLink?.replace(/#page=\d+$/, '');

			const currentNotePath = this.app.workspace.getActiveFile()!.path;
			pdfFile = this.app.metadataCache.getFirstLinkpathDest(pdfLink!, currentNotePath)!;
		} else {
			pdfFile = this.app.workspace.getActiveFile()!;
		}

		const menu = new Menu();
		this.registerEscapeButton(menu);
		menu.onHide(() => this.openPdfMenu = undefined);
		menu.addItem((item: MenuItem) => item
			.setIcon("pdf-file")
			.setTitle("Open PDF externally")
			.onClick(async () => {
				this.preventReopenPdfMenu = true;
				setTimeout(() => { this.preventReopenPdfMenu = false; }, OPEN_PDF_MENU_TIMEOUT);
				this.hideOpenPdfMenu();
				if (Platform.isDesktop) {
					this.app.openWithDefaultApp(pdfFile.path);
				} else {
					await (this.app.vault.adapter as FileSystemAdapterWithInternalApi).open(pdfFile.path);
				}
			})
		);
		menu.showAtMouseEvent(event);
		this.openPdfMenu = menu;

		setTimeout(this.hideOpenPdfMenu.bind(this), OPEN_PDF_MENU_TIMEOUT);
	}

	registerEscapeButton(menu: Menu, document: Document = activeDocument) {
		menu.register(onElement(
			document, "keydown", "*",
			(e: KeyboardEvent) => {
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopPropagation();
					menu.hide();
				}
			}));
	}

	hideOpenPdfMenu() {
		if (this.openPdfMenu) {
			this.openPdfMenu.hide();
		}
	}

	// mobile
	startWaitingForLongTap(event: TouchEvent, img: HTMLImageElement) {
		if (this.longTapTimeoutId) {
			clearTimeout(this.longTapTimeoutId);
			this.longTapTimeoutId = undefined;
		} else {
			if (event.targetTouches.length == 1) {
				this.longTapTimeoutId = window.setTimeout(this.processLongTap.bind(this, event, img), longTapTimeout);
			}
		}
	}

	// mobile
	stopWaitingForLongTap() {
		if (this.longTapTimeoutId) {
			clearTimeout(this.longTapTimeoutId);
			this.longTapTimeoutId = undefined;
		}
	}

	// mobile
	async processLongTap(event: TouchEvent, img: HTMLImageElement) {
		event.stopPropagation();
		this.longTapTimeoutId = undefined;
		const adapter = this.app.vault.adapter as FileSystemAdapterWithInternalApi;
		const electronWindow = window as unknown as ElectronWindow;
		const basePath = adapter.getFullPath("");
		const webviewServerUrl = electronWindow.WEBVIEW_SERVER_URL;
		const localImagePrefixUrl = webviewServerUrl + IMAGE_URL_PREFIX + basePath;
		if (img.src.startsWith(localImagePrefixUrl)) {
			const encodedImageFileRelativePath = img.src.replace(localImagePrefixUrl, "");
			const imageFileRelativePath = decodeURIComponent(encodedImageFileRelativePath);
			await adapter.open(imageFileRelativePath);
		} else {
			try {
				const blob = await loadImageBlob(img.src);
				if (!blob.type.startsWith("image/")) {
					new Notice(`Unsupported mime type ${blob.type}`);
					return;
				}
				const extension = blob.type.replace("image/", "");
				const randomGuid = window.URL.createObjectURL(new Blob([])).split("/").pop();
				const tempFileName = `/.temp-${randomGuid}.${extension}`;
				const buffer = await blob.arrayBuffer();
				await adapter.writeBinary(tempFileName, buffer);
				setTimeout(() => adapter.remove(tempFileName), deleteTempFileTimeout);
				new Notice("Image was temporarily saved and will be removed in 1 minute");
				await adapter.open(tempFileName);
			} catch {
				new Notice("Cannot open image");
			}
		}
	}

	// Android gives a PointerEvent, a child to MouseEvent.
	// Positions are not accurate from PointerEvent.
	// There's also TouchEvent
	// The event has target, path, toEvent (null on Android) for finding the link
	onImageContextMenu(event: MouseEvent) {
		const imageElement = imageElementFromMouseEvent(event);
		if (!imageElement) return;
		// check if the image is on a canvas
		if (!this.settings.enableDefaultOnCanvas && this.app.workspace.getActiveFile()?.extension === "canvas") {
			return;
		}

		const image = imageElement.currentSrc;
		const url = new URL(image);
		const protocol = url.protocol;
		const protocols = ["app:", "data:", "http:", "https:"];

		if (!protocols.includes(protocol)) {
			new Notice(`no handler for ${protocol} protocol`);
			return;
		}

		event.preventDefault();
		const menu = new Menu();
		menu.addItem((item: MenuItem) => item
			.setIcon("image-file")
			.setTitle(strings.menuItems.copyImageToClipboard)
			.onClick(async () => { await this.copyImage(image); })
		);
		const relativePath = getRelativePath(url, this.app);
		if (protocol === "app:" && Platform.isDesktop && relativePath) {
			menu.addItem((item: MenuItem) => item
				.setIcon("arrow-up-right")
				.setTitle("Open in new tab")
				.onClick(() => { openImageFromMouseEvent(event, this.app); })
			);
			menu.addItem((item: MenuItem) => item
				.setIcon("arrow-up-right")
				.setTitle("Open in default app")
				.onClick(() => this.app.openWithDefaultApp(relativePath))
			);
			menu.addItem((item: MenuItem) => item
				.setIcon("arrow-up-right")
				.setTitle(Platform.isMacOS ? "Reveal in Finder" : "Show in system explorer")
				.onClick(() => { this.app.showInFolder(relativePath); })
			);
			menu.addItem((item: MenuItem) => item
				.setIcon("folder")
				.setTitle("Reveal file in navigation")
				.onClick(() => {
					const file = this.app.vault.getFileByPath(relativePath);
					if (!file) {
						console.warn(`getFileByPath returned null for ${relativePath}`);
						return;
					}
					this.app.internalPlugins.getEnabledPluginById("file-explorer")?.revealInFolder(file);
				})
			);
		}

		this.registerEscapeButton(menu);

		menu.showAtPosition({ x: event.pageX, y: event.pageY });
		this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
	}

	onImageMouseUp(event: MouseEvent) {
		const middleButtonNumber = 1;
		if (event.button == middleButtonNumber && this.settings.middleClickNewTab) {
			openImageFromMouseEvent(event, this.app);
		}
	}
}
