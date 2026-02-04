import { type App, normalizePath, type TFile } from "obsidian";

export function getTfileFromUrl(app: App, url: URL): TFile | null {
    let basePath = normalizePath(app.vault.adapter.basePath);
    basePath = basePath.replace("file://", "");

    let urlPath = url.pathname;
    urlPath = urlPath.replace("/_capacitor_file_", ""); // clear url on mobile
    urlPath = urlPath
        .split("/")
        .filter((part) => part !== "")
        .join("/");

    const decodedPath = decodeURI(urlPath);
    if (decodedPath.startsWith(basePath)) {
        const relativePath = decodedPath.slice(basePath.length + 1);
        return app.vault.getFileByPath(relativePath);
    }

    return null;
}

export function openTfileInNewTab(app: App, tfile: TFile): void {
    void app.workspace.getLeaf(true).openFile(tfile, { active: true });
}
