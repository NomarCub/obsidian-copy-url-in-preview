import { CanvasNode, FileSystemAdapter } from "obsidian"

export interface ElectronWindow extends Window {
    WEBVIEW_SERVER_URL: string
}

export interface FileSystemAdapterWithInternalApi extends FileSystemAdapter {
    open(path: string): Promise<void>
}

export interface CanvasNodeWithUrl extends CanvasNode {
    unknownData: {
        url: string
        type: string
    }
}

export interface Listener {
    (this: Document, ev: Event): unknown;
}
