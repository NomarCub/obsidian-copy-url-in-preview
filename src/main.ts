import { Menu, Plugin, Notice, Platform, TFile } from "obsidian";
import {
    loadImageBlob, onElementToOff, openImageInNewTabFromEvent, imageElementFromMouseEvent,
    getRelativePath, timeouts, openTfileInNewTab, setMenuItem,
    copyImageToClipboard,
} from "./helpers";
import { CanvasNodeWithUrl, FileSystemAdapterWithInternalApi, ElectronWindow } from "types";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as internal from "obsidian-typings";
import { CopyUrlInPreviewSettingTab, CopyUrlInPreviewSettings, DEFAULT_SETTINGS } from "settings";

export default class CopyUrlInPreview extends Plugin {
    longTapTimeoutId?: number;
    canvasCardMenu?: HTMLElement;
    settings!: CopyUrlInPreviewSettings;
    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as CopyUrlInPreviewSettings);
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }

    override async onload(): Promise<void> {
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
              && (file.extension.match(imageFileRegex) ?? file.extension === "pdf")) {
                menu.addItem(item => setMenuItem(item, "open-in-new-tab")
                    .onClick(() => { openTfileInNewTab(this.app, file); }),
                );
                menu.addItem(item => setMenuItem(item, "copy-to-clipboard", this.app.vault.readBinary(file)));
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

    registerDocument(document: Document): void {
        let offs: (() => void)[];

        if (Platform.isDesktop) {
            offs = [
                onElementToOff(document, "contextmenu", "img",
                    this.onImageContextMenu.bind(this)),
                onElementToOff(document, "mouseup", "img",
                    this.onImageMouseUp.bind(this)),
            ];
        } else {
            offs = [
                onElementToOff(document, "touchstart", "img",
                    this.startWaitingForLongTap.bind(this)),
                onElementToOff(document, "touchend", "img",
                    this.stopWaitingForLongTap.bind(this)),
                onElementToOff(document, "touchmove", "img",
                    this.stopWaitingForLongTap.bind(this)),
            ];
        }

        this.register(() => {
            offs.forEach(f => { f(); });
        });
    }

    // mobile
    startWaitingForLongTap(event: TouchEvent, img: HTMLElement): void {
        if (!(img instanceof HTMLImageElement)) return;

        if (this.longTapTimeoutId) {
            clearTimeout(this.longTapTimeoutId);
            this.longTapTimeoutId = undefined;
        } else {
            if (event.targetTouches.length === 1) {
                this.longTapTimeoutId = window.setTimeout(async () => {
                    await copyImageToClipboard(img.currentSrc);
                }, timeouts.longTap);
            }
        }
    }

    // mobile
    stopWaitingForLongTap(): void {
        if (this.longTapTimeoutId) {
            clearTimeout(this.longTapTimeoutId);
            this.longTapTimeoutId = undefined;
        }
    }

    // Android gives a PointerEvent, a child to MouseEvent.
    // Positions are not accurate from PointerEvent.
    // There's also TouchEvent
    // The event has target, path, toEvent (null on Android) for finding the link
    onImageContextMenu(event: MouseEvent): void {
        const imageElement = imageElementFromMouseEvent(event);
        if (!imageElement) return;
        // check if the image is on a canvas
        if ((!this.settings.enableDefaultOnCanvas && this.app.workspace.getActiveFile()?.extension === "canvas")
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
                .onClick(() => { openImageInNewTabFromEvent(this.app, event); }),
            );
            if (Platform.isDesktop) {
                menu.addItem(item => setMenuItem(item, "open-in-default-app")
                    .onClick(() => { this.app.openWithDefaultApp(relativePath); }),
                );
                menu.addItem(item => setMenuItem(item, "show-in-explorer")
                    .onClick(() => { this.app.showInFolder(relativePath); }),
                );
                if (this.settings.revealInNavigation) {
                    menu.addItem(item => setMenuItem(item, "reveal-in-navigation")
                        .onClick(() => {
                            const file = this.app.vault.getFileByPath(relativePath);
                            if (!file) {
                                console.warn(`getFileByPath returned null for ${relativePath}`);
                                return;
                            }
                            this.app.internalPlugins.getEnabledPluginById("file-explorer")?.revealInFolder(file);
                        }),
                    );
                }
                // see: https://github.com/ozntel/file-tree-alternative
                if (this.app.plugins.enabledPlugins.has("file-tree-alternative")) {
                    menu.addItem(item => setMenuItem(item, "reveal-in-navigation-tree")
                        .onClick(() => {
                            const file = this.app.vault.getFileByPath(relativePath);
                            if (!file) {
                                console.warn(`getFileByPath returned null for ${relativePath}`);
                                return;
                            }
                            window.dispatchEvent(new CustomEvent(
                                "fta-reveal-file", { detail: { file: file } }));
                        }),
                    );
                }
            }
        }
        menu.addItem(item => setMenuItem(item, "copy-to-clipboard", image));

        menu.showAtPosition({ x: event.pageX, y: event.pageY });
        this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
    }

    onImageMouseUp(event: MouseEvent): void {
        const middleButtonNumber = 1;
        if (event.button == middleButtonNumber && this.settings.middleClickNewTab) {
            openImageInNewTabFromEvent(this.app, event);
        }
    }
}
