import { Menu, Plugin, Notice, MenuItem, Platform } from "obsidian";

interface Listener {
  (this: Document, ev: Event): any;
}

async function copyImage(imgSrc: string) {
  return new Promise<void>((resolve, reject) => {
    let image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      canvas.toBlob((blob: any) => {
        // @ts-ignore
        const data = new ClipboardItem({ [blob.type]: blob });
        // @ts-ignore
        navigator.clipboard.write([data]);
        resolve();
      });
    };
    image.onerror = () => {
      reject();
    }
    image.crossOrigin = 'anonymous';
    image.src = imgSrc;
  });
}

function onElement(
  el: Document,
  event: keyof HTMLElementEventMap,
  selector: string,
  listener: Listener,
  options?: { capture?: boolean; }
) {
  el.on(event, selector, listener, options);
  return () => el.off(event, selector, listener, options);
}

export default class CopyUrlInPreview extends Plugin {
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
    }
  }

  // Android gives a PointerEvent, a child to MouseEvent.
  // Positions are not accurate from PointerEvent.
  // There's also TouchEvent
  // The event has target, path, toEvent (null on Android) for finding the link
  onClick(event: MouseEvent) {
    event.preventDefault();
    const target = (event.target as any);
    const elType: String = target.localName;
    const menu = new Menu(this.app);
    switch (elType) {
      case 'img':
        const image = target.currentSrc;
        const thisURL = new URL(image);
        const Proto: String = thisURL.protocol;
        switch (Proto) {
          case 'app:':
          case 'data:':
          case 'http:':
          case 'https:':
            menu.addItem((item: MenuItem) =>
              item.setIcon("image-file")
                .setTitle("Copy image to clipboard")
                .onClick(async () => {
                  await copyImage(image)
                  .then(res => new Notice("Image copied to the clipboard!"))
                  .catch(err => new Notice("Error, could not copy the image!"))
                })
            );
            break;
          default:
            new Notice("no handler for `" + Proto +"` protocol");
            return;
        }
        break;
      case 'a':
        let link = target.href;
        menu.addItem((item: MenuItem) =>
          item.setIcon("link")
            .setTitle("Copy URL")
            .onClick(() => {
              navigator.clipboard.writeText(link);
              new Notice("URL copied to your clipboard");
            })
        );
        break;
      default:
        new Notice("no handler for this element type");
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
