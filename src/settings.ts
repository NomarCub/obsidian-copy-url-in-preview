import { type App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type CopyUrlInPreviewPlugin from "./main.ts";

export interface CopyUrlInPreviewSettings {
    middleClickNewTab: boolean;
    revealInNavigation: boolean;
    enableDefaultOnCanvas: boolean;
}

export const DEFAULT_SETTINGS: CopyUrlInPreviewSettings = {
    middleClickNewTab: true,
    revealInNavigation: true,
    enableDefaultOnCanvas: false,
};

export class CopyUrlInPreviewSettingTab extends PluginSettingTab {
    override plugin: CopyUrlInPreviewPlugin;

    constructor(app: App, plugin: CopyUrlInPreviewPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    override getSettingDefinitions(): SettingDefinitionItem<keyof CopyUrlInPreviewSettings>[] {
        return [
            {
                name: "Middle mouse click on image link to open in new tab",
                control: {
                    type: "toggle",
                    key: "middleClickNewTab",
                    defaultValue: DEFAULT_SETTINGS.middleClickNewTab,
                },
            },
            {
                name: "Reveal file in navigation menu item",
                desc:
                    "You might want to disable this if you use a plugin for replacing default Obsidian file navigation.\n" +
                    "This plugin supports File Tree Alternative by displaying a reveal menu item for it if installed.",
                control: {
                    type: "toggle",
                    key: "revealInNavigation",
                    defaultValue: DEFAULT_SETTINGS.revealInNavigation,
                },
            },
            {
                name: "Enable regular context menu on canvas",
                desc:
                    "The regular context menu sometimes duplicates the context menu on the canvas, so it's disabled there by default.\n" +
                    "There is a separate context menu for images directly on the canvas, but if that's not enough (for example for images in notes on canvas), you can enable the regular context menu here too.",
                control: {
                    type: "toggle",
                    key: "enableDefaultOnCanvas",
                    defaultValue: DEFAULT_SETTINGS.enableDefaultOnCanvas,
                },
            },
        ];
    }
}
