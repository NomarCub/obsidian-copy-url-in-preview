import {
	Menu, Plugin, Notice, MenuItem
} from "obsidian";

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
	}

	// Android gives a PointerEvent, a child to MouseEvent.
	// Positions are not accurate from PointerEvent.
	// There's also TouchEvent
	// The event has target, path, toEvent (null on Android) for finding the link
	onClick(event: MouseEvent) {
		if (!(event.target instanceof HTMLAnchorElement)) {
			return;
		}

		event.preventDefault();

		let link = event.target.href;

		const menu = new Menu(this.app);
		menu.addItem((item: MenuItem) =>
			item.setIcon("link")
				.setTitle("Copy url")
				.onClick(() => {
					navigator.clipboard.writeText(link);
					new Notice("Url copied to your clipboard");
				})
		);
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
