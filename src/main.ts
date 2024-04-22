import { Menu, Plugin, Notice, MenuItem, Platform, TFile, MarkdownView } from "obsidian";
import {
  loadImageBlob, onElement, openImageFromMouseEvent,
  ElectronWindow, FileSystemAdapterWithInternalApi
} from "./helpers"
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as internal from 'obsidian-typings';
import { CopyUrlInPreviewSettingTab, CopyUrlInPreviewSettings, DEFAULT_SETTINGS } from "settings";

const IMAGE_URL_PREFIX = "/_capacitor_file_";
const SUCCESS_NOTICE_TIMEOUT = 1_800;
const longTapTimeout = 500;
const deleteTempFileTimeout = 60_000;
const OPEN_PDF_MENU_BORDER_SIZE = 100;
const OPEN_PDF_MENU_TIMEOUT = 5_000;

export default class CopyUrlInPreview extends Plugin {
  longTapTimeoutId?: number;
  openPdfMenu?: Menu;
  preventReopenPdfMenu: boolean;
  lastHoveredLinkTarget: string;

  settings: CopyUrlInPreviewSettings;
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    this.saveData(this.settings);
  }

  async onload() {
    await this.loadSettings();
    this.addSettingTab(new CopyUrlInPreviewSettingTab(this.app, this));
    this.registerDocument(document);
    this.app.workspace.on("window-open",
      (workspaceWindow, window) => {
        this.registerDocument(window.document);
      });
  }

  registerDocument(document: Document) {
    this.register(
      onElement(
        document,
        "mouseover",
        ".pdf-embed iframe, .pdf-embed div.pdf-container, .workspace-leaf-content[data-type=pdf]",
        this.showOpenPdfMenu.bind(this)
      )
    )

    this.register(
      onElement(
        document,
        "mousemove",
        ".pdf-canvas",
        this.showOpenPdfMenu.bind(this)
      )
    )

    if (Platform.isDesktop) {
      this.register(
        onElement(
          document,
          "contextmenu",
          "img",
          this.onClickImage_contextmenu.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "mouseup",
          "img",
          this.onClickImage_mouseup.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "mouseover",
          ".cm-link, .cm-hmd-internal-link",
          this.storeLastHoveredLinkInEditor.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "mouseover",
          "a.internal-link",
          this.storeLastHoveredLinkInPreview.bind(this)
        )
      );
    } else {
      this.register(
        onElement(
          document,
          "touchstart",
          "img",
          this.startWaitingForLongTap.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "touchend",
          "img",
          this.stopWaitingForLongTap.bind(this)
        )
      );

      this.register(
        onElement(
          document,
          "touchmove",
          "img",
          this.stopWaitingForLongTap.bind(this)
        )
      );
    }
  }

  storeLastHoveredLinkInEditor(event: MouseEvent) {
    const editor = this.app.workspace.getActiveViewOfType(MarkdownView)?.editor;
    if (!editor) {
      return;
    }
    const position = editor.posAtMouse(event);
    const token = editor.getClickableTokenAt(position);
    if (!token) {
      return;
    }
    this.lastHoveredLinkTarget = token.text;
  }

  storeLastHoveredLinkInPreview(event: MouseEvent, link: HTMLAnchorElement) {
    this.lastHoveredLinkTarget = link.getAttribute("data-href")!;
  }

  showOpenPdfMenu(event: MouseEvent | PointerEvent, el: HTMLElement) {
    if (!this.settings.pdfMenu || this.openPdfMenu || this.preventReopenPdfMenu) {
      return;
    }

    const rect = el.getBoundingClientRect();
    if (rect.left + OPEN_PDF_MENU_BORDER_SIZE < event.x
      && event.x < rect.right - OPEN_PDF_MENU_BORDER_SIZE
      && rect.top + OPEN_PDF_MENU_BORDER_SIZE < event.y
      && event.y < rect.bottom - OPEN_PDF_MENU_BORDER_SIZE) {
      return;
    }

    const pdfEmbed = el.closest(".pdf-embed");
    let pdfFile: TFile;
    if (pdfEmbed) {
      let pdfLink: string;
      if (pdfEmbed.hasClass("popover")) {
        pdfLink = this.lastHoveredLinkTarget;
      }
      else {
        pdfLink = pdfEmbed.getAttr("src") ?? this.lastHoveredLinkTarget;
      }

      pdfLink = pdfLink?.replace(/#page=\d+$/, '');

      const currentNotePath = this.app.workspace.getActiveFile()!.path;
      pdfFile = this.app.metadataCache.getFirstLinkpathDest(pdfLink!, currentNotePath!)!;
    } else {
      pdfFile = this.app.workspace.getActiveFile()!;
    }

    const menu = new Menu();
    this.registerEscapeButton(menu);
    menu.onHide(() => this.openPdfMenu = undefined);
    menu.addItem((item: MenuItem) => item
      .setIcon("pdf-file")
      .setTitle("Open PDF externally")
      .onClick(async () => {
        this.preventReopenPdfMenu = true;
        setTimeout(() => { this.preventReopenPdfMenu = false; }, OPEN_PDF_MENU_TIMEOUT);
        this.hideOpenPdfMenu();
        if (Platform.isDesktop) {
          this.app.openWithDefaultApp(pdfFile.path);
        } else {
          await (this.app.vault.adapter as FileSystemAdapterWithInternalApi).open(pdfFile.path);
        }
      })
    );
    menu.showAtMouseEvent(event);
    this.openPdfMenu = menu;

    setTimeout(this.hideOpenPdfMenu.bind(this), OPEN_PDF_MENU_TIMEOUT);
  }

  registerEscapeButton(menu: Menu, document: Document = activeDocument) {
    menu.register(
      onElement(
        document,
        "keydown",
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
  }

  hideOpenPdfMenu() {
    if (this.openPdfMenu) {
      this.openPdfMenu.hide();
    }
  }

  // mobile
  startWaitingForLongTap(event: TouchEvent, img: HTMLImageElement) {
    if (this.longTapTimeoutId) {
      clearTimeout(this.longTapTimeoutId);
      this.longTapTimeoutId = undefined;
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
      this.longTapTimeoutId = undefined;
    }
  }

  // mobile
  async processLongTap(event: TouchEvent, img: HTMLImageElement) {
    event.stopPropagation();
    this.longTapTimeoutId = undefined;
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
  onClickImage_contextmenu(event: MouseEvent) {
    const imgElement = event.target;
    if (!(imgElement instanceof HTMLImageElement)) {
      console.error("imgElement is supposed to be a HTMLImageElement. imgElement:");
      console.error(imgElement);
      return;
    }

    event.preventDefault();
    const menu = new Menu();
    const image = imgElement.currentSrc;
    const url = new URL(image);
    const protocol = url.protocol;
    switch (protocol) {
      case "app:":
      case "data:":
      case "http:":
      case "https:":
        menu.addItem((item: MenuItem) => item
          .setIcon("image-file")
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
        );
        if (protocol === "app:" && Platform.isDesktop) {
          // getResourcePath("") also works for root path
          const baseFilePath = this.app.vault.adapter.getFilePath("");
          const baseFilePathName: string = baseFilePath.replace("file://", "");
          const urlPathName: string = url.pathname;
          if (urlPathName.startsWith(baseFilePathName)) {
            let relativePath = urlPathName.replace(baseFilePathName, "");
            relativePath = decodeURI(relativePath);

            menu.addItem((item: MenuItem) => item
              .setIcon("arrow-up-right")
              .setTitle("Open in new tab")
              .onClick(() => {
                openImageFromMouseEvent(event);
              })
            );
            menu.addItem((item: MenuItem) => item
              .setIcon("arrow-up-right")
              .setTitle("Open in default app")
              .onClick(() => this.app.openWithDefaultApp(relativePath))
            );
            menu.addItem((item: MenuItem) => item
              .setIcon("arrow-up-right")
              .setTitle(Platform.isMacOS ? "Reveal in finder" : "Show in system explorer")
              .onClick(() => {
                this.app.showInFolder(relativePath);
              })
            );
            menu.addItem((item: MenuItem) => item
              .setIcon("folder")
              .setTitle("Reveal file in navigation")
              .onClick(() => {
                const file = this.app.vault.getFileByPath(relativePath.substring(1));
                if (!file) {
                  console.warn(`getFileByPath returned null for ${relativePath}`)
                  return;
                }
                this.app.internalPlugins.getEnabledPluginById("file-explorer")?.revealInFolder(file);
              })
            );
          }
        }
        break;
      default:
        new Notice(`no handler for ${protocol} protocol`);
        return;
    }

    this.registerEscapeButton(menu);
    menu.showAtPosition({ x: event.pageX, y: event.pageY });
    this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
  }

  onClickImage_mouseup(event: MouseEvent) {
    if (event.button == 1) { //middle mouse button
      if (this.settings.openInNewTabOnMiddleMouseClick) {
        openImageFromMouseEvent(event);
      }
    }
  }
}
