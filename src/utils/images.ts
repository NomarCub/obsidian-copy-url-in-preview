import { Notice } from "obsidian";
import type { ImageType } from "../types";
import { copyBlobToClipboard, resolveImage } from "./blob";

export function isImageFile(path: string): boolean {
    const imageFileExtensions = ["avif", "bmp", "gif", "jpg", "jpeg", "png", "svg", "webp", "heic"];
    path = path.toLowerCase();
    return imageFileExtensions.some((ext) => path.endsWith(`.${ext}`));
}

export async function copyImageToClipboard(image: ImageType): Promise<void> {
    const timeout = 1_800;

    if (await resolveImage(image, copyBlobToClipboard)) {
        new Notice(i18next.t("interface.copied_generic"), timeout);
    } else {
        new Notice(i18next.t("Failed to copy image to clipboard"), timeout);
    }
}
