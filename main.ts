import {
	Menu, Plugin, Notice, MenuItem
} from "obsidian";

interface Listener {
	(this: HTMLElement, ev: Event, delegateTarget: HTMLElement): any;
}
interface HTMLElement {
	on(this: HTMLElement, type: string, selector: string, listener: Listener, options?: { capture?: boolean; }): void;
	off(this: HTMLElement, type: string, selector: string, listener: Listener, options?: { capture?: boolean; }): void;
}

function onElement(
	el: HTMLElement,
	event: string,
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
				"contextmenu",
				".external-link",
				this.onClick.bind(this),
				{ capture: true }
			)
		);
	}

	// Android gives a PointerEvent, a child to MouseEvent.
	// Positions are not accurate from PointerEvent.
	// There's also TouchEvent
	// The event has target, path, toEvent (null on Android) for finding the link
	onClick(event: (MouseEvent) & { target: { href: string }, contextMenu: Menu }) {
		const menu = new Menu(this.app);
		menu.addItem((item: MenuItem) =>
			item.setIcon("link")
				.setTitle("Copy url")
				.onClick(() => {
					navigator.clipboard.writeText(event.target.href);
					new Notice("Url copied to your clipboard");
				})
		);
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
				},
				{ capture: true }
			)
		);
		menu.showAtPosition({ x: event.pageX, y: event.pageY });

		this.app.workspace.trigger("copy-url-in-preview:contextmenu", menu);
	}
}
