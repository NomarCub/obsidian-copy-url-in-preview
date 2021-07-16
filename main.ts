import {
  Menu, Plugin, Notice, MenuItem
} from "obsidian";

const { clipboard, nativeImage } = require('electron');
const http = require('http');
const https = require('https');

interface Listener {
  (this: Document, ev: Event): any;
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
    );
    this.register(
      onElement(
        document,
        "contextmenu" as keyof HTMLElementEventMap,
        "img",
        this.onClick.bind(this)
      )
    );
  }

  // Android gives a PointerEvent, a child to MouseEvent.
  // Positions are not accurate from PointerEvent.
  // There's also TouchEvent
  // The event has target, path, toEvent (null on Android) for finding the link
  onClick(event: MouseEvent) {
    event.preventDefault();
    const target = (event.target as any);
    const elType = <String>target.localName;

    const menu = new Menu(this.app);
    switch (elType) {
      case 'img':
        const image = target.currentSrc;
        var theImage = nativeImage.createEmpty();
        const thisURL = new URL(image);
        const thisHREF = thisURL.href;
        const Proto = <String>thisURL.protocol;
        switch (Proto) {
          case 'app:':
            // console.log('local vault image');
            var imPath = decodeURIComponent(image);
            var imPath = imPath.replace(/^app:\/\/local\//, '');
            var imPath = imPath.replace(/\?.*$/, '');
            theImage = nativeImage.createFromPath(imPath);
            break;
          case 'http:':
            // console.log('remote HTTP image: %s', thisHREF);
            http.get(thisHREF, (resp: any) => {
              resp.setEncoding('base64');
              var body = "data:" + resp.headers["content-type"] + ";base64,";
              resp.on('data', (data: any) => { body += data});
              resp.on('end', () => {
                theImage = nativeImage.createFromDataURL(body);
              });
            }).on('error', (e: Error) => {
              console.log(`error: ${e.message}`);
            });
            break;
          case 'https:':
            // console.log('remote HTTPS image: %s', thisHREF);
            https.get(thisHREF, (resp: any) => {
              resp.setEncoding('base64');
              var body = "data:" + resp.headers["content-type"] + ";base64,";
              resp.on('data', (data: any) => { body += data});
              resp.on('end', () => {
                theImage = nativeImage.createFromDataURL(body);
              });
            }).on('error', (e: Error) => {
              console.log(`error: ${e.message}`);
            });
            break;
          default:
            new Notice("no handler for `" + Proto +"` protocol");
            return;
        }
        menu.addItem((item: MenuItem) =>
          item.setIcon("link")
            .setTitle("Copy image")
            .onClick(() => {
              clipboard.writeImage(theImage);
              new Notice("Image copied to your clipboard");
            })
        );
        break;
      case 'a':
        let link = target.href;
        menu.addItem((item: MenuItem) =>
          item.setIcon("link")
            .setTitle("Copy url")
            .onClick(() => {
              navigator.clipboard.writeText(link);
              new Notice("Url copied to your clipboard");
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
