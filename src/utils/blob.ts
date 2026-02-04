import { TFile } from "obsidian";
import type { ImageType } from "../types";
import { withTimeout } from "./helpers";

const BLOB_TIMEOUT = 5_000;

export async function resolveImage(
    image: ImageType,
    callback: (blob: Blob) => Promise<boolean>,
): Promise<boolean> {
    if (image instanceof TFile) {
        const blob = new Blob([await image.vault.readBinary(image)], { type: `image/${image.extension}` });
        if (await callback(blob)) {
            return true;
        } else {
            return true;
        }
    }

    // 1. original image, normal fetch
    let blob = await getExternalImageBlob(image);
    if (blob && (await callback(blob))) {
        return true;
    }

    // 2. original image, fallback using bypassing CORS restrictions
    // see https://allorigins.win/
    // see also
    // https://developer.mozilla.org/en-US/docs/Web/HTML/CORS_enabled_image
    // https://www.npmjs.com/package/html-to-image
    // also consider the Obsidian API that has no CORS restriction, but also no blob type: https://docs.obsidian.md/Reference/TypeScript+API/requestUrl
    const corsFreeUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(image)}`;
    blob = await getExternalImageBlob(corsFreeUrl);
    if (blob && (await callback(blob))) {
        return true;
    }

    // 3. image copied to a canvas, then converted to blob as fallback
    blob = await withTimeout(BLOB_TIMEOUT, getExternalImageBlobWithCanvas(image));
    if (blob && (await callback(blob))) {
        return true;
    }

    // 4. image copied to a canvas, then converted to blob, bypassing CORS restrictions as fallback
    blob = await withTimeout(BLOB_TIMEOUT, getExternalImageBlobWithCanvas(corsFreeUrl));
    if (blob && (await callback(blob))) {
        return true;
    }

    return false;
}

/** Copy image blob to clipboard. Falls back to PNG if blob type is not supported.
 * @returns success */
export async function copyBlobToClipboard(blob: Blob): Promise<boolean> {
    try {
        // checking with ClipboardItem.supports here was inconsistent:
        //   Android returns no support for GIFs but copying works
        // copying SVGs this way didn't work on Windows
        if (blob.type !== "image/svg+xml") {
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            return true;
        }
    } catch (e) {
        console.warn("Failed copying image with original mimetype, using PNG fallback - ", e);
    }

    try {
        blob = new Blob([blob], { type: "image/png" });
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        return true;
    } catch (e) {
        console.warn("Failed copying image with PNG mimetype - ", e);
    }

    return false;
}

export async function getExternalImageBlob(url: string): Promise<Blob | null> {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(BLOB_TIMEOUT) });
        return await response.blob();
    } catch (e) {
        console.warn("Failed to fetch image - ", e);
    }
    return null;
}

export function getExternalImageBlobWithCanvas(url: string): Promise<Blob | null> {
    return new Promise<Blob | null>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";

        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            canvas.getContext("2d")!.drawImage(image, 0, 0);
            canvas.toBlob((blob) => {
                resolve(blob);
            });
        };
        image.onerror = () => {
            resolve(null);
        };
        image.src = url;
    });
}
