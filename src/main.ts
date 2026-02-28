import { Menu, Notice, Platform, Plugin, TFile } from "obsidian";
import type {} from "obsidian-typings";
import { type CopyUrlInPreviewSettings, CopyUrlInPreviewSettingTab, DEFAULT_SETTINGS } from "./settings";
import type { CanvasNodeWithUrl } from "./types";
import { clearUrl, onElementToOff } from "./utils/helpers";
import { copyImageToClipboard, isImageFile } from "./utils/images";
import { MENU_SECTIONS, setItem } from "./utils/menu";
import { getTfileFromUrl, openTfileInNewTab } from "./utils/tfile";

export default class CopyUrlInPreview extends Plugin {
    canvasCardMenu?: HTMLElement;
    settings!: CopyUrlInPreviewSettings;

    async loadSettings(): Promise<void> {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            (await this.loadData()) as CopyUrlInPreviewSettings,
        );
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
        this.registerEvent(
            this.app.workspace.on("file-menu", (menu, file, source) => {
                if (source === "canvas-menu" && file instanceof TFile && isImageFile(`.${file.extension}`)) {
                    menu.addItem((item) =>
                        setItem(item, "open-in-new-tab").onClick(() => {
                            openTfileInNewTab(this.app, file);
                        }),
                    );
                    menu.addItem((item) =>
                        setItem(item, "copy-to-clipboard").onClick(() => {
                            void copyImageToClipboard(file);
                        }),
                    );
                }
            }),
        );
        this.registerEvent(
            this.app.workspace.on("canvas:node-menu", (menu, node) => {
                const data = (node as CanvasNodeWithUrl).unknownData;

                if (data.type === "link") {
                    const url = clearUrl(data.url);
                    if (!isImageFile(url)) return;

                    menu.addItem((item) =>
                        setItem(item, "copy-to-clipboard")
                            .setSection("canvas")
                            .onClick(() => {
                                void copyImageToClipboard(url);
                            }),
                    );
                }
            }),
        );
        this.registerEvent(
            this.app.workspace.on("url-menu", (menu, url) => {
                url = clearUrl(url);
                if (!isImageFile(url)) return;

                menu.addItem((item) =>
                    setItem(item, "copy-to-clipboard").onClick(() => {
                        void copyImageToClipboard(url);
                    }),
                );
            }),
        );
    }

    registerDocument(document: Document): void {
        const offs = [
            onElementToOff(document, "contextmenu", "img", this.onImageContextMenu.bind(this), {
                capture: true,
            }),
            onElementToOff(document, "mouseup", "img", this.onImageMouseUp.bind(this)),
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
    onImageContextMenu(event: MouseEvent): void {
        // check if the image is on a canvas
        if (
            !this.settings.enableDefaultOnCanvas &&
            this.app.workspace.getActiveFile()?.extension === "canvas"
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

        const menu = Menu.forEvent(event);
        const internalFile = getTfileFromUrl(this.app, url);
        // most functionality is already implemented in editing mode
        // so we only add menus if the image is in a reading view
        const isInReadingView = !!imageElement.closest(".markdown-reading-view");

        menu.addSections(Array.from(MENU_SECTIONS));

        if (internalFile && isInReadingView) {
            menu.addItem((item) =>
                setItem(item, "rename-file").onClick(() =>
                    this.app.fileManager.promptForFileRename(internalFile),
                ),
            );

            menu.addItem((item) =>
                setItem(item, "copy-to-clipboard").onClick(() => {
                    void copyImageToClipboard(internalFile);
                }),
            );

            // Add image filename to match with mobile menus
            if (Platform.isMobile) {
                menu.addItem((item) => item.setTitle(internalFile.name).setSection("file").setIsLabel(true));
            }

            menu.addItem((item) =>
                setItem(item, "open-in-new-tab").onClick(() => {
                    openTfileInNewTab(this.app, internalFile);
                }),
            );

            if (Platform.isDesktop) {
                menu.addItem((item) =>
                    setItem(item, "open-in-default-app").onClick(() => {
                        this.app.openWithDefaultApp(internalFile.path);
                    }),
                );

                menu.addItem((item) =>
                    setItem(item, "show-in-explorer").onClick(() => {
                        this.app.showInFolder(internalFile.path);
                    }),
                );
            }

            if (this.settings.revealInNavigation) {
                menu.addItem((item) =>
                    setItem(item, "reveal-in-navigation").onClick(() => {
                        this.app.internalPlugins
                            .getEnabledPluginById("file-explorer")
                            ?.revealInFolder(internalFile);
                    }),
                );
            }
            // see: https://github.com/ozntel/file-tree-alternative
            if (this.app.plugins.enabledPlugins.has("file-tree-alternative")) {
                menu.addItem((item) =>
                    setItem(item, "reveal-in-navigation-tree").onClick(() => {
                        self.dispatchEvent(
                            new CustomEvent("fta-reveal-file", { detail: { file: internalFile } }),
                        );
                    }),
                );
            }
        } else if (!internalFile) {
            // external link
            if (isInReadingView) {
                menu.addItem((item) =>
                    setItem(item, "copy-to-clipboard").onClick(() => {
                        void copyImageToClipboard(imageElement.src);
                    }),
                );
            }

            menu.addItem((item) =>
                setItem(item, "copy-url").onClick(() => {
                    void navigator.clipboard.writeText(url.href);
                    new Notice(i18next.t("interface.copied", { item: "URL" }), 1_000);
                }),
            );
        }

        menu.showAtMouseEvent(event);
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
