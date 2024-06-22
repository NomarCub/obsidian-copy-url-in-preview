import { Menu, Plugin, Notice, Platform, TFile, MarkdownView } from "obsidian";
import {
	loadImageBlob, onElement, openImageInNewTabFromEvent, imageElementFromMouseEvent,
	getRelativePath, timeouts, openTfileInNewTab, setMenuItem, registerEscapeButton
} from "./helpers";
import { CanvasNodeWithUrl, FileSystemAdapterWithInternalApi, ElectronWindow } from "types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as internal from 'obsidian-typings';
import { CopyUrlInPreviewSettingTab, CopyUrlInPreviewSettings, DEFAULT_SETTINGS } from "settings";

export default class CopyUrlInPreview extends Plugin {
	longTapTimeoutId?: number;
	openPdfMenu?: Menu;
	preventReopenPdfMenu: boolean = false;
	lastHoveredLinkTarget?: string;
	canvasCardMenu?: HTMLElement;
	settings!: CopyUrlInPreviewSettings;
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as CopyUrlInPreviewSettings);
	}
	async saveSettings() {
		await this.saveData(this.settings);
	}

	async onload() {
		await this.loadSettings();
		this.addSettingTab(new CopyUrlInPreviewSettingTab(this.app, this));
		this.registerDocument(document);
		const imageFileRegex = /(avif|bmp|gif|jpe?g|png|svg|webp)$/gi;
		this.app.workspace.on("window-open", (_workspaceWindow, window) => {
			this.registerDocument(window.document);
		});
		// register the image menu for canvas
		this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
			if (source === "canvas-menu" && file instanceof TFile
				&& (file.extension.match(imageFileRegex) || file.extension === "pdf")) {
				menu.addItem(item => setMenuItem(item, "open-in-new-tab")
					.onClick(() => { openTfileInNewTab(this.app, file); })
				);
				menu.addItem(item => setMenuItem(item, "copy-to-clipboard", this.app.vault.readBinary(file)))
			}
		}));
		this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu, node) => {
			const data = (node as CanvasNodeWithUrl).unknownData;
			if (data.type === "link") {
				const url = data.url;
				menu.addItem(item => setMenuItem(item, "copy-to-clipboard", url)
					.setSection("canvas"));
			}
		}));
		this.registerEvent(this.app.workspace.on("url-menu", (menu, url) => {
			if (url.match(imageFileRegex)) {
				menu.addItem(item => setMenuItem(item, "copy-to-clipboard", url));
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

	storeLastHoveredLinkInPreview(_event: MouseEvent, link: HTMLElement) {
		this.lastHoveredLinkTarget = link.getAttribute("data-href") ?? undefined;
	}

	showOpenPdfMenu(event: MouseEvent | PointerEvent, el: HTMLElement) {
		if (!this.settings.pdfMenu || this.openPdfMenu || this.preventReopenPdfMenu) {
			return;
		}
		const isInCanvas = this.app.workspace.getActiveFile()?.extension === "canvas"
		if (!this.settings.enableDefaultOnCanvas && isInCanvas) {
			return;
		}

		const rect = el.getBoundingClientRect();
		const openPdfMenuBorderSize = 100;

		if (!isInCanvas
			&& rect.left + openPdfMenuBorderSize < event.x
			&& event.x < rect.right - openPdfMenuBorderSize
			&& rect.top + openPdfMenuBorderSize < event.y
			&& event.y < rect.bottom - openPdfMenuBorderSize) {
			return;
		}

		const pdfEmbed = el.closest(".pdf-embed");
		// check if the pdf is on a canvas
		// the context menu crash on loaded pdfs
		if (pdfEmbed?.className === "canvas-node-content pdf-embed is-loaded") { return; }
		let pdfFile: TFile;
		if (pdfEmbed) {
			let pdfLink: string | undefined;
			if (pdfEmbed.hasClass("popover")) {
				pdfLink = this.lastHoveredLinkTarget;
			}
			else {
				pdfLink = pdfEmbed.getAttr("src") ?? this.lastHoveredLinkTarget;
			}

			if (pdfLink) {
				pdfLink = pdfLink.replace(/#page=\d+$/, '');
				const currentNotePath = this.app.workspace.getActiveFile()!.path;
				pdfFile = this.app.metadataCache.getFirstLinkpathDest(pdfLink, currentNotePath)!;
			}
		} else {
			pdfFile = this.app.workspace.getActiveFile()!;
		}
		// hide the menu on canvas
		if (isInCanvas) {
			const canvasCardMenu = activeDocument.querySelector<HTMLElement>(".menu");
			if (canvasCardMenu) {
				canvasCardMenu.style.display = "none";
				this.canvasCardMenu = canvasCardMenu;
			}
		}
		const menu = new Menu();
		registerEscapeButton(menu);
		menu.onHide(() => this.openPdfMenu = undefined);

		menu.addItem(item => setMenuItem(item, "open-pdf")
			.onClick(async () => {
				this.preventReopenPdfMenu = true;
				setTimeout(() => { this.preventReopenPdfMenu = false; }, timeouts.openPdfMenu);
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

		setTimeout(this.hideOpenPdfMenu.bind(this), timeouts.openPdfMenu);
	}

	hideOpenPdfMenu() {
		if (this.openPdfMenu) {
			this.openPdfMenu.hide();
		}
		if (this.canvasCardMenu) {
			this.canvasCardMenu.style.display = "";
		}
	}

	// mobile
	startWaitingForLongTap(event: TouchEvent, img: HTMLElement) {
		if (!(img instanceof HTMLImageElement)) return;

		if (this.longTapTimeoutId) {
			clearTimeout(this.longTapTimeoutId);
			this.longTapTimeoutId = undefined;
		} else {
			if (event.targetTouches.length == 1) {
				this.longTapTimeoutId = window.setTimeout(() => {
					this.processLongTap.bind(this, event, img)
				}, timeouts.longTap);
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
		const localImagePrefixUrl = webviewServerUrl + "/_capacitor_file_" + basePath;
		if (img.src.startsWith(localImagePrefixUrl)) {
			const encodedImageFileRelativePath = img.src.replace(localImagePrefixUrl, "");
			const imageFileRelativePath = decodeURIComponent(encodedImageFileRelativePath);
			await adapter.open(imageFileRelativePath);
		} else {
			try {
				const blob = await loadImageBlob(img.src);
				if (!blob) throw new Error("blob was null");

				if (!blob.type.startsWith("image/")) {
					new Notice(`Unsupported mime type ${blob.type}`);
					return;
				}
				const extension = blob.type.replace("image/", "");
				const randomGuid = window.URL.createObjectURL(new Blob([])).split("/").pop();
				const tempFileName = `/.temp-${randomGuid}.${extension}`;
				const buffer = await blob.arrayBuffer();
				await adapter.writeBinary(tempFileName, buffer);
				setTimeout(() => void adapter.remove(tempFileName), timeouts.deleteTempFile);
				new Notice("Image was temporarily saved and will be removed in 1 minute");
				await adapter.open(tempFileName);
			} catch (e) {
				new Notice("Cannot open image");
				console.error(e);
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
		if (!this.settings.enableDefaultOnCanvas && this.app.workspace.getActiveFile()?.extension === "canvas"
			|| event.targetNode?.parentElement?.className === "canvas-node-content media-embed image-embed is-loaded") {
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
		const relativePath = getRelativePath(url, this.app);
		menu.addSections(["open", "info", "system"]);
		if (protocol === "app:" && relativePath) {
			menu.addItem(item => setMenuItem(item, "open-in-new-tab")
				.onClick(() => { openImageInNewTabFromEvent(this.app, event); })
			);
			if (Platform.isDesktop) {
				menu.addItem(item => setMenuItem(item, "open-in-default-app")
					.onClick(() => { this.app.openWithDefaultApp(relativePath); })
				);
				menu.addItem(item => setMenuItem(item, "show-in-explorer")
					.onClick(() => { this.app.showInFolder(relativePath); })
				);
				menu.addItem(item => setMenuItem(item, "reveal-in-navigation")
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
		}
		menu.addItem(item => setMenuItem(item, "copy-to-clipboard", image));

		menu.showAtPosition({ x: event.pageX, y: event.pageY });
		this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
	}

	onImageMouseUp(event: MouseEvent) {
		const middleButtonNumber = 1;
		if (event.button == middleButtonNumber && this.settings.middleClickNewTab) {
			openImageInNewTabFromEvent(this.app, event);
		}
	}
}
