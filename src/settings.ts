import CopyUrlInPreviewPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

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

    display(): void {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h3", { text: "Image Context Menus settings" });
        new Setting(containerEl)
            .setName("Middle mouse click on image link to open in new tab")
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.middleClickNewTab).onChange(value => {
                    this.plugin.settings.middleClickNewTab = value;
                    void this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Reveal file in navigation menu item")
            .setDesc("You might want to disable this if you use a plugin for replacing default Obsidian file navigation. This plugin supports File Tree Alternative by displaying a reveal menu item for it if installed.")
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.revealInNavigation).onChange(value => {
                    this.plugin.settings.revealInNavigation = value;
                    void this.plugin.saveSettings();
                });
            });
        new Setting(containerEl)
            .setName("Enable regular context menu on canvas")
            .setDesc("The regular context menu sometimes duplicates the context menu on the canvas, so it's disabled there by default.\n"
              + "There is a separate context menu for images directly on the canvas, but if that's not enough (for example for images in notes on canvas), you can enable the regular context menu here too.")
            .addToggle(toggle => {
                toggle.setValue(this.plugin.settings.enableDefaultOnCanvas).onChange(value => {
                    this.plugin.settings.enableDefaultOnCanvas = value;
                    void this.plugin.saveSettings();
                });
            });
    }
}
