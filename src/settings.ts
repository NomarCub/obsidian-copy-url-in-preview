import CopyUrlInPreviewPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface CopyUrlInPreviewSettings {
    pdfMenu: boolean;
    openInNewTabOnMiddleMouseClick: boolean;
}

export const DEFAULT_SETTINGS: CopyUrlInPreviewSettings = {
    pdfMenu: true,
    openInNewTabOnMiddleMouseClick: false
}

export class CopyUrlInPreviewSettingTab extends PluginSettingTab {
    plugin: CopyUrlInPreviewPlugin;
    constructor(app: App, plugin: CopyUrlInPreviewPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h3", { text: "Image Context Menus settings" });
        new Setting(containerEl)
            .setName("PDF context menu")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.pdfMenu).onChange((value) => {
                    this.plugin.settings.pdfMenu = value;
                    this.plugin.saveSettings();
                })
            })
        new Setting(containerEl)
            .setName("Middle mouse to open in new tab")
            .addToggle((toggle) => {
                toggle.setValue(this.plugin.settings.openInNewTabOnMiddleMouseClick).onChange((value) => {
                    this.plugin.settings.openInNewTabOnMiddleMouseClick = value;
                    this.plugin.saveSettings();
                });
            })
    }
}