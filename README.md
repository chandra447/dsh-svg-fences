[English](https://github.com/chandra447/dsh-svg-fences/blob/main/README.md) | [中文](https://github.com/chandra447/dsh-svg-fences/blob/main/README.zh.md)

<p align="center">
  <img src="https://raw.githubusercontent.com/chandra447/dsh-svg-fences/main/assets/icon-180.png" width="90" height="90" alt="dsh-svg-fences icon">
</p>

<h1 align="center">dsh-svg-fences</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-svg-fences"><img src="https://img.shields.io/npm/v/dsh-svg-fences" alt="npm version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT license"></a>
  <a href="https://github.com/chandra447/dsh-svg-fences/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/chandra447/dsh-svg-fences/ci.yml?label=ci" alt="ci status"></a>
</p>

<p align="center">
  <img src="https://raw.githubusercontent.com/chandra447/dsh-svg-fences/main/assets/hero.gif" alt="An SVG code fence in DeepSeek Harness turning into a rendered figure" width="760">
</p>

**DeepSeek Harness shows SVG fences as code. This plugin shows them as pictures.**

_A 25 fps motion piece rendered with fframes. [Watch the MP4](assets/hero.mp4) for 1080p._


Your assistant wrote an SVG. DSH showed you 40 lines of XML. This plugin shows you the picture, right where the code block was. The XML is still one click away.

## Install

In the app, open the **Plugins** window, go to **Discover**, search for `dsh-svg-fences`, and install it.

From a terminal, use the profile you run:

```sh
dsh plugin --profile web add dsh-svg-fences
dsh plugin --profile desktop add dsh-svg-fences
```

To uninstall, swap `add` for `remove`.

The package ships a prebuilt `client.js`. Installing runs no build script, so DSH never asks you to approve one (`allowBuilds`). There is no host code and there are no dependencies. The whole thing is about 22 KB of browser JS.

Tested with DeepSeek Harness 0.2.x on macOS. The package asks for Node 22.19 or newer. The part that runs is plain browser JS. Other platforms are untested.

## What you get

- **A figure in place of the fence.** The original code block is hidden while the figure is shown.
- **A small toolbar.** An `svg` label, then `Source`, `Copy`, and `Download`.
- **Source and Render.** `Source` flips back to the code. The same button, now labelled `Render`, flips back to the picture.
- **Copy** puts the original fence text on your clipboard, tokens included.
- **Download** saves an `.svg` file named after the figure's `<title>`, or `figure.svg` if there is none.
- **Zoom.** Click the figure for a larger view with `+`, `−`, and reset. Close it with Escape or a click on the backdrop.
- **Theme aware.** Colors follow DSH's light and dark themes, even if you switch while the zoom view is open.
- **Content, not labels.** The fence language does not matter. If the text is an SVG document, it becomes a figure.
- **Toolbar labels in English or Chinese,** following DSH's language.

## Theme tokens

Write colors as CSS variables inside the fence. The plugin swaps each one for the live theme value before it draws the image, and again whenever the theme changes.

| In your SVG | Reads DSH token | Typical use |
| --- | --- | --- |
| `var(--fg)` | `--dsw-alias-label-primary` | Text, main strokes |
| `var(--muted)` | `--dsw-alias-label-secondary` | Captions, secondary lines |
| `var(--accent)` | the blue accent (`--dsw-alias-link`, with fallbacks) | The one thing to look at |
| `var(--bg)` | `--dsw-alias-bg-base` | Page background |
| `var(--surface)` | `--dsw-alias-bg-layer-1` | Boxes and cards |
| `var(--surface-alt)` | `--dsw-alias-bg-layer-2` | Nested boxes, stripes |
| `var(--border)` | `--dsw-alias-border-l1` | Box outlines |
| `var(--line)` | `--dsw-alias-border-l2` | Connectors, gridlines |
| `var(--dsw-...)` | That token, as is | Anything else in the theme |

Three small rules:

- `var(--name, #888)` falls back to `#888` when the token is missing. With no fallback, the text color is used.
- `currentColor` follows the theme text color. The plugin sets `color` on the root `<svg>` unless you already did.
- The default font is `sans-serif` unless the root sets `font-family`.

Models do not know these names unless you tell them. A line like this in your prompt or project instructions helps:

```text
When you draw SVG, use var(--fg), var(--muted), var(--accent), var(--surface) and var(--border) for colors.
```

A fence like this one follows the theme in both modes, and downloads as `hello-figure.svg`:

````markdown
```svg
<svg viewBox="0 0 260 80" xmlns="http://www.w3.org/2000/svg">
  <title>hello-figure</title>
  <rect x="1" y="1" width="258" height="78" rx="10" fill="var(--surface)" stroke="var(--border)"/>
  <circle cx="40" cy="40" r="14" fill="var(--accent)"/>
  <text x="68" y="45" font-size="15" fill="var(--fg)">Rendered, not printed</text>
</svg>
```
````

| Dark theme | Light theme |
| --- | --- |
| ![A figure rendered in the dark theme](assets/figure-dark.png) | ![The same figure in the light theme](assets/figure-light.png) |

## Works with

- **Mermaid plugins.** Mermaid source starts with words like `graph` or `sequenceDiagram`, never `<svg`, so this plugin leaves those fences alone. Run both.
- **Other fence plugins** that claim blocks by language. This one only acts on blocks whose content is an SVG document.

## Limits

What it does not do, on purpose:

- It does not run anything inside the SVG. The figure is an `<img>` with a `data:image/svg+xml` source, so scripts do not run, links do not click, and external images and fonts do not load. Untrusted fence content cannot run code.
- It does not touch the network. No fetches, no CDN, no renderer to download.
- It does not change the message. The figure is a view over the transcript. Disable the plugin and the code blocks come back.
- It does not render Mermaid, PlantUML, Graphviz, or any other diagram language. Only SVG.
- It skips code blocks that show line numbers.
- It skips SVG that does not parse. You get the normal code block, so you can see what broke.
- It skips sources over 60 KB.
- Download bakes the current theme's colors into the file. Copy keeps the `var(--...)` tokens.

## How it works

- One `MutationObserver` watches the page. Within 250 ms of a change it scans each `div.md-code-block` and reads the text of its `<pre>`.
- A block qualifies when its trimmed text starts with `<` and `DOMParser` reads it as `image/svg+xml` with an `<svg>` root and no `parsererror`. DSH keeps the fence language as a React prop that never reaches the DOM, so the content is the only reliable signal.
- Tokens are read with `getComputedStyle` on the code block itself, because DSH scopes theme variables to containers rather than `:root`. Each `var(--name)` becomes its computed value, and `xmlns`, `color`, and `font-family` are added to the root when missing.
- The result is encoded as a `data:image/svg+xml` URI on an `<img>` placed after the block. A data attribute hides the original block with CSS. If the image fails to load, the block comes back.
- A second observer watches attributes on `<html>` and `<body>`, where DSH sets `data-ds-dark-theme`. When the resolved palette changes, every figure is re-encoded.

## Also from this pair

[dsh-table-charts](https://github.com/chandra447/dsh-table-charts) draws a bar chart under Markdown tables that look like data. It is built the same way, as a prebuilt `client.js` with no dependencies and no server.

## Credits

The approach comes from the figure pipeline in [oh-my-pi](https://github.com/can1357/oh-my-pi). It lifts SVG fences out of assistant markdown, resolves theme tokens before rasterizing, offers a Source toggle, and turns tables into charts. This plugin is a browser-side port of those ideas for DSH, written from scratch. It contains no oh-my-pi code.

The hero animation was rendered with [fframes](https://github.com/dmtrKovalenko/fframes), a Rust and SVG video renderer. The stills show the plugin's real rendering with DSH's styles.

The DeepSeek whale in the demo comes from [LobeHub Icons](https://github.com/lobehub/lobe-icons) (MIT). DeepSeek and its logo are trademarks of DeepSeek. See [third-party notices](THIRD-PARTY.md).

## License

[MIT](LICENSE) © Chandra Doredla
