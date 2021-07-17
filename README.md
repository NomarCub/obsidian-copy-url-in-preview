# Danger. Ugly code ahead 😱

- My fork of https://github.com/NomarCub/obsidian-copy-url-in-preview
- Adds a right-click → Copy image function

![image](https://user-images.githubusercontent.com/1992842/126041872-da60dbaa-2bdc-4511-9d05-6ec77157ed46.png)

# Installation instructions for testing

1. Open a Terminal

```shell
$ git clone --branch copy-images https://github.com/luckman212/obsidian-copy-url-in-preview
$ cd obsidian-copy-url-in-preview
$ npm i; npm run build
```

2. Copy the files to your Obsidian plugins dir:

- If you already have **copy-url-in-preview** installed: copy `main.js` to your `<vault>/plugins/copy-url-in-preview/` directory (overwriting the original).
- If you _don't_: create a new folder in your plugins directory, and put `main.js` and `manifest.json` in it.

3. (Re)launch Obsidian
