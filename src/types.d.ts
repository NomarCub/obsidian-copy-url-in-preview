import { CanvasNode } from "obsidian";
import type { i18n } from "i18next";

export interface ElectronWindow extends Window {
    WEBVIEW_SERVER_URL: string;
}

export interface CanvasNodeWithUrl extends CanvasNode {
    unknownData: {
        url: string;
        type: string;
    };
}

declare global {
    const i18next: i18n;
}
