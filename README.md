# Image Context Menus

This plugin provides the following context menus for images in [Obsidian](https://obsidian.md/):
- Copy to clipboard
- Open in default app
- Show in system explorer
- Reveal file in navigation
  - Reveal in [File Tree Alternative](https://github.com/ozntel/file-tree-alternative)
- Open in new tab
  - also available through middle mouse button click
- Rename

For online image embeds, only the "Copy to clipboard" option is available.  
Context menus are also added to the canvas.  
Most features work on mobile, but were only tested on Android.

See these other plugins for related functionality:
- [Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit)
- [Pixel Perfect Image](https://github.com/johansan/pixel-perfect-image)
- [Ozan's Image in Editor](https://github.com/ozntel/oz-image-in-editor-obsidian)

Copying images:

[Copying images video](https://user-images.githubusercontent.com/1992842/132140547-fead74c1-4bec-489a-945c-f28cbba43493.mp4)

> This plugin used to be called "Copy Image and URL context menu". It had link URL copying functionality (see [1.5.2](https://github.com/NomarCub/obsidian-copy-url-in-preview/tree/1.5.2) and prior), but that was removed when it was included in Obsidian 1.5.  
> It also used to have an `Open PDF externally` hover context menu for embedded PDFs, which was also removed when better Obsidian native functionality appeared (see [1.9.1](https://github.com/NomarCub/obsidian-copy-url-in-preview/tree/1.9.1)).

## Installation

You can install the plugin via the Community Plugins tab within the Obsidian app.  
Here's the plugin on [Obsidian's Community Plugins website]((https://obsidian.md/plugins?id=copy-url-in-preview)).  
You can install the plugin manually by copying a release to your `.obsidian/plugins/copy-url-in-preview` folder.

## This plugin on other sites

[Obsidian Stats page](https://www.moritzjung.dev/obsidian-stats/plugins/copy-url-in-preview/)  
[Obsidian Addict page](https://obsidianaddict.com/plugin/copy-url-in-preview/)  
[Obsidian Hub page](https://publish.obsidian.md/hub/02+-+Community+Expansions/02.05+All+Community+Expansions/Plugins/copy-url-in-preview)

## Development

This plugin follows the structure of the [Obsidian Sample Plugin](https://github.com/obsidianmd/obsidian-sample-plugin), see further details there.  
Contributions are welcome.

## Credits

Original plugin by [NomarCub](https://github.com/NomarCub).  
If you like this plugin you can sponsor me here on GitHub: [![Sponsor NomarCub](https://img.shields.io/static/v1?label=Sponsor%20NomarCub&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/NomarCub), on Ko-fi here: <a href='https://ko-fi.com/nomarcub' target='_blank'><img height='26' style='border:0px;height:26px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>, or on PayPal here: [![Paypal](https://img.shields.io/badge/paypal-nomarcub-yellow?style=social&logo=paypal)](https://paypal.me/nomarcub).

- [Renaming and mobile feature parity](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/55) developed by [Rikiub%](https://github.com/Rikiub)
- [Open in new tab](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/37) developed by [waterproofsodium](https://github.com/waterproofsodium)
- [Copying](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/2) [images](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/3) developed by [luckman212](https://github.com/luckman212).
- [Android image sharing](https://github.com/NomarCub/obsidian-copy-url-in-preview/issues/5) developed by [mnaoumov](https://github.com/mnaoumov).
- [Open PDF externally](https://github.com/NomarCub/obsidian-copy-url-in-preview/issues/9) feature developed by [mnaoumov](https://github.com/mnaoumov).
- [Canvas functionality, translations and fixes](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/40) by [Mara-Li](https://github.com/Mara-Li)

Thank you to the makers of the [Tag Wrangler plugin](https://github.com/pjeby/tag-wrangler), as it was a great starting point for working with context menus in Obsidian.
