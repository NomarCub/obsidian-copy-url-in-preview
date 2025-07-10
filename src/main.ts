import { Menu, Notice, Platform, Plugin, TFile } from "obsidian";
// biome-ignore lint/correctness/noUnusedImports: <obsidian internals>
import * as _obsidian_typings from "obsidian-typings";

import {
	clearUrl,
	getTfileFromUrl,
	isImageFile,
	onElementToOff,
	openTfileInNewTab,
	setMenuItem,
} from "./helpers";
import {
	type CopyUrlInPreviewSettings,
	CopyUrlInPreviewSettingTab,
	DEFAULT_SETTINGS,
} from "./settings";
import type { CanvasNodeWithUrl } from "./types";

export default class CopyUrlInPreview extends Plugin {
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
        this.app.workspace.on("window-open", (_workspaceWindow, window) => {
            this.registerDocument(window.document);
        });

        // register the image menu for canvas
        this.registerEvent(this.app.workspace.on("file-menu", (menu, file, source) => {
            if (source === "canvas-menu" && file instanceof TFile
              && (isImageFile(`.${file.extension}`))) {
                menu.addItem(item => setMenuItem(item, "open-in-new-tab")
                    .onClick(() => { openTfileInNewTab(this.app, file); }),
                );
                menu.addItem(item => setMenuItem(item, "copy-to-clipboard", this.app.vault.readBinary(file)));
            }
        }));
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu, node) => {
            const data = (node as CanvasNodeWithUrl).unknownData;
            if (data.type === "link") {
                const url = clearUrl(data.url);
                if (!isImageFile(url)) return;

                menu.addItem(item => setMenuItem(item, "copy-to-clipboard", url)
                    .setSection("canvas"));
            }
        }));
        this.registerEvent(this.app.workspace.on("url-menu", (menu, url) => {
            url = clearUrl(url);

            if (isImageFile(url)) {
                menu.addItem(item => setMenuItem(item, "copy-to-clipboard", url));
            }
        }));
    }

    registerDocument(document: Document): void {
        const offs = [
            onElementToOff(
                document,
                "contextmenu",
                "img",
                this.onImageContextMenu.bind(this),
                { capture: true },
            ),
            onElementToOff(
                document,
                "mouseup",
                "img",
                this.onImageMouseUp.bind(this),
            ),
        ];

        this.register(() => {
            for (const f of offs) {
                f();
            }
        });
    }

    // Android gives a PointerEvent, a child to MouseEvent.
    // Positions are not accurate from PointerEvent.
    // There's also TouchEvent
    // The event has target, path, toEvent (null on Android) for finding the link
    onImageContextMenu(event: MouseEvent | PointerEvent): void {
        // check if the image is on a canvas
        if (
            (!this.settings.enableDefaultOnCanvas && this.app.workspace.getActiveFile()?.extension === "canvas")
        ) {
            return;
        }

        event.preventDefault();

        const imageElement = event.target as HTMLImageElement;

        const url = new URL(imageElement.src);
        const protocols = ["app:", "data:", "http:", "https:"];

        if (!protocols.includes(url.protocol)) {
            new Notice(`No handler for ${url.protocol} protocol`);
            return;
        }

        const menu = new Menu();
        const internalFile = getTfileFromUrl(this.app, url);

        menu.addSections(["file", "open", "info", "system"]);

        if (internalFile) {
            menu.addItem(item => setMenuItem(item, "rename-file")
                .onClick(() =>
                    this.app.fileManager.promptForFileRename(internalFile),
                ),
            );
        }

        menu.addItem(item => setMenuItem(item, "copy-to-clipboard", imageElement.src));

        if (internalFile) {
            // Add image filename to match with mobile menus
            if (Platform.isMobile) {
                menu.addItem(item => item
                    .setTitle(internalFile.name)
                    .setSection("file")
                    .setIsLabel(true),
                );
            }

            menu.addItem(item => setMenuItem(item, "open-in-new-tab")
                .onClick(() => {
                    openTfileInNewTab(this.app, internalFile);
                }),
            );

            if (Platform.isDesktop) {
                menu.addItem(item => setMenuItem(item, "open-in-default-app")
                    .onClick(() => {
                        this.app.openWithDefaultApp(internalFile.path);
                    }),
                );

                menu.addItem(item => setMenuItem(item, "show-in-explorer")
                    .onClick(() => {
                        this.app.showInFolder(internalFile.path);
                    }),
                );
            }

            if (this.settings.revealInNavigation) {
                menu.addItem(item => setMenuItem(item, "reveal-in-navigation")
                    .onClick(() => {
                        this.app.internalPlugins.getEnabledPluginById("file-explorer")?.revealInFolder(internalFile);
                    }),
                );
            }
            // see: https://github.com/ozntel/file-tree-alternative
            if (this.app.plugins.enabledPlugins.has("file-tree-alternative")) {
                menu.addItem(item => setMenuItem(item, "reveal-in-navigation-tree")
                    .onClick(() => {
                        self.dispatchEvent(new CustomEvent(
                            "fta-reveal-file", { detail: { file: internalFile } }));
                    }),
                );
            }
        }

        menu.showAtPosition({
            x: event.pageX,
            y: event.pageY,
        });
    }

    onImageMouseUp(event: MouseEvent): void {
        const imageElement = event.target as HTMLImageElement;

        const middleButtonNumber = 1;

        if (event.button === middleButtonNumber && this.settings.middleClickNewTab) {
            const tfile = getTfileFromUrl(this.app, new URL(imageElement.src));
            if (!tfile) return;

            openTfileInNewTab(this.app, tfile);
        }
    }
}
