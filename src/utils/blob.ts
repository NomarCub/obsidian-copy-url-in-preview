export const BLOB_TIMEOUT = 5_000;

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
