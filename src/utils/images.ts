import { Notice, TFile } from "obsidian";
import {
    BLOB_TIMEOUT,
    copyBlobToClipboard,
    getExternalImageBlob,
    getExternalImageBlobWithCanvas,
} from "./blob";
import { withTimeout } from "./helpers";

export type ImageType = string | TFile;

const NOTICE_TIMEOUT = 1_800;

export function isImageFile(path: string): boolean {
    const imageFileExtensions = ["avif", "bmp", "gif", "jpg", "jpeg", "png", "svg", "webp", "heic"];
    path = path.toLowerCase();
    return imageFileExtensions.some((ext) => path.endsWith(`.${ext}`));
}

export async function copyImageToClipboard(image: ImageType): Promise<void> {
    const successNotice = (): void => {
        new Notice(i18next.t("interface.copied_generic"), NOTICE_TIMEOUT);
    };
    const failureNotice = (): void => {
        new Notice(i18next.t("Failed to copy image to clipboard"), NOTICE_TIMEOUT);
    };

    if (image instanceof TFile) {
        const blob = new Blob([await image.vault.readBinary(image)], { type: `image/${image.extension}` });
        if (await copyBlobToClipboard(blob)) {
            successNotice();
            return;
        } else {
            failureNotice();
            return;
        }
    }

    // 1. original image, normal fetch
    let blob = await getExternalImageBlob(image);
    if (blob && (await copyBlobToClipboard(blob))) {
        successNotice();
        return;
    }

    // 2. original image, fallback using bypassing CORS restrictions
    // see https://allorigins.win/
    // see also
    // https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
    // https://www.npmjs.com/package/html-to-image
    // also consider the Obsidian API that has no CORS restriction, but also no blob type: https://docs.obsidian.md/Reference/TypeScript+API/requestUrl
    const corsFreeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(image)}`;
    blob = await getExternalImageBlob(corsFreeUrl);
    if (blob && (await copyBlobToClipboard(blob))) {
        successNotice();
        return;
    }

    // 3. image copied to a canvas, then converted to blob as fallback
    blob = await withTimeout(BLOB_TIMEOUT, getExternalImageBlobWithCanvas(image));
    if (blob && (await copyBlobToClipboard(blob))) {
        successNotice();
        return;
    }

    // 4. image copied to a canvas, then converted to blob, bypassing CORS restrictions as fallback
    blob = await withTimeout(BLOB_TIMEOUT, getExternalImageBlobWithCanvas(corsFreeUrl));
    if (blob && (await copyBlobToClipboard(blob))) {
        successNotice();
        return;
    }

    failureNotice();
}
