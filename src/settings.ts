import CopyUrlInPreviewPlugin from "main";
import { App, PluginSettingTab, Setting } from "obsidian";

export interface CopyUrlInPreviewSettings {
	pdfMenu: boolean;
	middleClickNewTab: boolean;
	enableDefaultOnCanvas: boolean;
}

export const DEFAULT_SETTINGS: CopyUrlInPreviewSettings = {
	pdfMenu: false,
	middleClickNewTab: true,
	enableDefaultOnCanvas: false
};

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
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.pdfMenu).onChange(value => {
					this.plugin.settings.pdfMenu = value;
					void this.plugin.saveSettings();
				});
			});
		new Setting(containerEl)
			.setName("Middle mouse click on image link to open in new tab")
			.addToggle(toggle => {
				toggle.setValue(this.plugin.settings.middleClickNewTab).onChange(value => {
					this.plugin.settings.middleClickNewTab = value;
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
