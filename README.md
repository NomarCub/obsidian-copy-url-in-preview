# Image Context Menus

This plugin provides the following context menus for images in [Obsidian](https://obsidian.md/):
- Copy image to clipboard
- Open image in default app
- Show in system explorer
- Reveal file in navigation
- Open in new tab
  - also available through middle mouse button click

It also has an `Open PDF externally` context menu for PDFs.

> This plugin used to be called "Copy Image and URL context menu". It had link URL copying functionality (see [1.5.2](https://github.com/NomarCub/obsidian-copy-url-in-preview/tree/1.5.2) and prior), but that was removed when it was included in Obsidian 1.5.

See these other plugins for related functionality:
- [Ozan's Image in Editor Plugin](https://github.com/ozntel/oz-image-in-editor-obsidian)
- [Image Toolkit](https://github.com/sissilab/obsidian-image-toolkit)

Copying images:

[Copying images video](https://user-images.githubusercontent.com/1992842/132140547-fead74c1-4bec-489a-945c-f28cbba43493.mp4)

Opening PDFs externally:

![Opening PDFs externally on desktop](https://user-images.githubusercontent.com/5298006/171170626-5a94f5dc-61fc-4661-a9f2-38a0fb0181f5.gif)

All features work on mobile, but were only tested on Android. Mobile uses the native image sharing functionality instead of the clipboard, and it downloads online images temporarily so they can be shared.

## Installation

You can install the plugin via the Community Plugins tab within the Obsidian app.  
[Here](https://obsidian.md/plugins?id=copy-url-in-preview)'s the plugin in Obsidian's Community Plugins website.  
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
If you like this plugin you can sponsor me here on GitHub: [![Sponsor NomarCub](https://img.shields.io/static/v1?label=Sponsor%20NomarCub&message=%E2%9D%A4&logo=GitHub&color=%23fe8e86)](https://github.com/sponsors/NomarCub), on Ko-fi here: <a href='https://ko-fi.com/nomarcub' target='_blank'><img height='35' src='https://az743702.vo.msecnd.net/cdn/kofi3.png?v=0' alt='Buy Me a Coffee at ko-fi.com' /></a>, or on PayPal here: [![Paypal](https://img.shields.io/badge/paypal-nomarcub-yellow?style=social&logo=paypal)](https://paypal.me/nomarcub).

- [Open in new tab](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/37) developed by [waterproofsodium](https://github.com/waterproofsodium)
- [Copying](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/2) [images](https://github.com/NomarCub/obsidian-copy-url-in-preview/pull/3) developed by [luckman212](https://github.com/luckman212).
- [Android image sharing](https://github.com/NomarCub/obsidian-copy-url-in-preview/issues/5) developed by [mnaoumov](https://github.com/mnaoumov).
- [Open PDF externally](https://github.com/NomarCub/obsidian-copy-url-in-preview/issues/9) feature developed by [mnaoumov](https://github.com/mnaoumov).

Thank you to the makers of the [Tag Wrangler plugin](https://github.com/pjeby/tag-wrangler), as it was a great starting point for working with context menus in Obsidian.
