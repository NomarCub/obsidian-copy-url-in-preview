import { type IconName, type MenuItem, Platform } from "obsidian";

type ItemType =
    | "open-in-new-tab"
    | "copy-to-clipboard"
    | "open-in-default-app"
    | "show-in-explorer"
    | "reveal-in-navigation"
    | "reveal-in-navigation-tree"
    | "rename-file";

export const MENU_SECTIONS = ["file", "open", "info", "system"] as const;

interface Item {
    section: (typeof MENU_SECTIONS)[number];
    icon: IconName;
    title: string;
}

const types: Record<ItemType, Item> = {
    "copy-to-clipboard": { section: "info", icon: "image-file", title: "interface.label-copy" },
    "open-in-new-tab": { section: "open", icon: "file-plus", title: "interface.menu.open-in-new-tab" },
    "open-in-default-app": {
        section: "system",
        icon: "arrow-up-right",
        title: "plugins.open-with-default-app.action-open-file",
    },
    "show-in-explorer": {
        section: "system",
        icon: "arrow-up-right",
        title: `plugins.open-with-default-app.action-show-in-folder${Platform.isMacOS ? "-mac" : ""}`,
    },
    "reveal-in-navigation": {
        section: "system",
        icon: "folder",
        title: "plugins.file-explorer.action-reveal-file",
    },
    "reveal-in-navigation-tree": {
        section: "system",
        icon: "folder",
        title: "Reveal in File Tree Alternative",
    },
    "rename-file": { section: "info", icon: "pencil", title: "interface.menu.rename" },
};

export function setItem(item: MenuItem, type: ItemType): MenuItem {
    return item
        .setSection(types[type].section)
        .setIcon(types[type].icon)
        .setTitle(i18next.t(types[type].title));
}
