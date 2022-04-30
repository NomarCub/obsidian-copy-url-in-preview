import { Menu, Plugin, Notice, MenuItem, Platform } from "obsidian";
import { ElectronWindow, FileSystemAdapterWithInternalApi, loadImageBlob, onElement } from "./helpers"

const IMAGE_URL_PREFIX = "/_capacitor_file_";
const SUCCESS_NOTICE_TIMEOUT = 1800;
const longTapTimeout = 500;
const deleteTempFileTimeout = 60000;

export default class CopyUrlInPreview extends Plugin {
  longTapTimeoutId: number | null = null;

  onload() {
    this.register(
      onElement(
        document,
        "contextmenu" as keyof HTMLElementEventMap,
        "a.external-link",
        this.onClick.bind(this)
      )
    )
    if (Platform.isDesktop) {
      this.register(
        onElement(
          document,
          "contextmenu" as keyof HTMLElementEventMap,
          "img",
          this.onClick.bind(this)
        )
      )
    } else {
      this.register(
        onElement(
          document,
          "touchstart" as keyof HTMLElementEventMap,
          "img",
          this.startWaitingForLongTap.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "touchend" as keyof HTMLElementEventMap,
          "img",
          this.stopWaitingForLongTap.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "touchmove" as keyof HTMLElementEventMap,
          "img",
          this.stopWaitingForLongTap.bind(this)
        )
      );
    }
  }

  // mobile
  startWaitingForLongTap(event: TouchEvent, img: HTMLImageElement) {
    if (this.longTapTimeoutId) {
      clearTimeout(this.longTapTimeoutId);
      this.longTapTimeoutId = null;
    } else {
      if (event.targetTouches.length == 1) {
        this.longTapTimeoutId = window.setTimeout(this.processLongTap.bind(this, event, img), longTapTimeout);
      }
    }
  }

  // mobile
  stopWaitingForLongTap() {
    if (this.longTapTimeoutId) {
      clearTimeout(this.longTapTimeoutId);
      this.longTapTimeoutId = null;
    }
  }

  // mobile
  async processLongTap(event: TouchEvent, img: HTMLImageElement) {
    event.stopPropagation();
    this.longTapTimeoutId = null;
    const adapter = this.app.vault.adapter as FileSystemAdapterWithInternalApi;
    const electronWindow = window as unknown as ElectronWindow;
    const basePath = adapter.getFullPath("");
    const webviewServerUrl = electronWindow.WEBVIEW_SERVER_URL;
    const localImagePrefixUrl = webviewServerUrl + IMAGE_URL_PREFIX + basePath;
    if (img.src.startsWith(localImagePrefixUrl)) {
      const encodedImageFileRelativePath = img.src.replace(localImagePrefixUrl, "");
      const imageFileRelativePath = decodeURIComponent(encodedImageFileRelativePath);
      await adapter.open(imageFileRelativePath);
    } else {
      try {
        const blob = await loadImageBlob(img.src);
        if (!blob.type.startsWith("image/")) {
          new Notice(`Unsupported mime type ${blob.type}`);
          return;
        }
        const extension = blob.type.replace("image/", "");
        const randomGuid = window.URL.createObjectURL(new Blob([])).split("/").pop();
        const tempFileName = `/.temp-${randomGuid}.${extension}`;
        const buffer = await blob.arrayBuffer();
        await adapter.writeBinary(tempFileName, buffer);
        setTimeout(() => adapter.remove(tempFileName), deleteTempFileTimeout);
        new Notice("Image was temporarily saved and will be removed in 1 minute");
        await adapter.open(tempFileName);
      } catch {
        new Notice("Cannot open image");
      }
    }
  }

  // Android gives a PointerEvent, a child to MouseEvent.
  // Positions are not accurate from PointerEvent.
  // There's also TouchEvent
  // The event has target, path, toEvent (null on Android) for finding the link
  onClick(event: MouseEvent) {
    event.preventDefault();
    const target = (event.target as Element);
    const imgType = target.localName;
    const menu = new Menu(this.app);
    switch (imgType) {
      case "img": {
        const image = (target as HTMLImageElement).currentSrc;
        const thisURL = new URL(image);
        const Proto = thisURL.protocol;
        switch (Proto) {
          case "app:":
          case "data:":
          case "http:":
          case "https:":
            menu.addItem((item: MenuItem) =>
              item.setIcon("image-file")
                .setTitle("Copy image to clipboard")
                .onClick(async () => {
                  try {
                    const blob = await loadImageBlob(image);
                    const data = new ClipboardItem({ [blob.type]: blob });
                    await navigator.clipboard.write([data]);
                    new Notice("Image copied to the clipboard!", SUCCESS_NOTICE_TIMEOUT);
                  } catch {
                    new Notice("Error, could not copy the image!");
                  }
                })
            )
            break;
          default:
            new Notice(`no handler for ${Proto} protocol`);
            return;
        }
        break;
      }
      case "a": {
        const link = (target as HTMLAnchorElement).href;
        menu.addItem((item: MenuItem) =>
          item.setIcon("link")
            .setTitle("Copy URL")
            .onClick(() => {
              navigator.clipboard.writeText(link);
              new Notice("URL copied to your clipboard", SUCCESS_NOTICE_TIMEOUT);
            })
        );
        break;
      }
      default:
        new Notice("No handler for this image type!");
        return;
    }
    menu.register(
      onElement(
        document,
        "keydown" as keyof HTMLElementEventMap,
        "*",
        (e: KeyboardEvent) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            menu.hide();
          }
        }
      )
    );
    menu.showAtPosition({ x: event.pageX, y: event.pageY });
    this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
  }
}
