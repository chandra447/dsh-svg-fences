# dsh-svg-fences

[English](README.md) | [中文](README.zh.md)

[![npm](https://img.shields.io/npm/v/dsh-svg-fences)](https://www.npmjs.com/package/dsh-svg-fences)
[![license](https://img.shields.io/badge/license-MIT-blue)](LICENSE)
[![ci](https://img.shields.io/github/actions/workflow/status/chandra447/dsh-svg-fences/ci.yml?label=ci)](https://github.com/chandra447/dsh-svg-fences/actions)

![在 DeepSeek Harness 回复中渲染为图形的 SVG 代码块](assets/figure-dark.png)

助手写了一段 SVG，DSH 给你看了四十行 XML。

这个插件直接把图画出来，就在对话里。跟随主题，可以切回源码，不占用任何提示词。

```
之前                                 之后
┌──────────────────────────┐        ┌──────────────────────────┐
│ <svg viewBox="0 0 720…"> │        │  request → gateway → …   │
│   <rect x="28" y="90" …> │  ───▶  │  （真正的图）             │
│   <text x="88" …>        │        │  Source  Copy  Download  │
│   … 还有 38 行 …          │        └──────────────────────────┘
└──────────────────────────┘
```

## 安装

在 DSH 的插件窗口里安装，或者用命令行：

```sh
dsh plugin --profile web add dsh-svg-fences
dsh plugin --profile desktop add dsh-svg-fences
```

这是预构建包。安装时不编译任何东西，所以不会弹出 `allowBuilds` 确认。如果插件没有出现，重新加载窗口即可。

## 你会得到

- 任何内容是一份完整 `<svg>` 文档的代码块，都会在原位置渲染成图。
- `Source` 切回源码，`Render` 再切回图形。
- `Copy` 复制原始源码。`Download` 按 SVG 的 `<title>` 命名保存 `.svg` 文件。
- 点击图形可以放大，有 +、− 和重置。按 Escape 或点击背景关闭。
- 图形跟随深色和浅色主题，切换主题会立即重新编码，无需刷新。
- 图形是一张惰性的 `data:` 图片。不执行脚本，不请求外部资源，不走网络。代码块能画图，但回不了家。

## 用主题作画

代码块里可以直接写短 token。插件会把它们解析成 DSH 当前实际使用的值。

```svg
<svg viewBox="0 0 240 80" xmlns="http://www.w3.org/2000/svg">
  <rect x="8" y="8" width="224" height="64" rx="10"
        fill="var(--surface)" stroke="var(--border)"/>
  <text x="120" y="46" text-anchor="middle"
        fill="var(--accent)" font-family="sans-serif">cache hit</text>
</svg>
```

| Token | 对应的 DSH 值 |
|---|---|
| `var(--fg)` | 主文字色 |
| `var(--muted)` | 次文字色 |
| `var(--accent)` | 蓝色强调色 |
| `var(--surface)` | 一级背景 |
| `var(--surface-alt)` | 二级背景 |
| `var(--bg)` | 基础背景 |
| `var(--border)` | 一级描边 |
| `var(--line)` | 二级描边 |

任何真实的 `--dsw-*` 自定义属性也可以直接用。`var(--name, 回退值)` 在 token 不存在时会使用回退值，这样同一段 SVG 复制到别的 Markdown 查看器也能看。

## 和现有插件一起用

它只认领 SVG 代码块，所以可以和一个 Mermaid 插件同时安装，各画各的，互不干扰。

## 老实说，它不做什么

- 代码块必须是完整的 SVG 文档。单独一个 `<rect …>` 片段仍然是代码。
- 带行号的代码块、无效的 SVG、超过 60 KB 的源码，都会被跳过。
- 图形里不会执行脚本。这是设计目标，也意味着交互式 SVG 不会动。
- 图标和滤镜正常。SVG 里的外链图片不会加载，这是有意的。

## 实现方式

1. DSH 用自己的代码块组件渲染每个代码块。代码块语言是 React 属性，不会出现在 DOM 里，所以按语言 class 判断行不通。
2. 插件读取代码文本，用 `DOMParser` 确认根节点是 `<svg>`，然后在消息卡片上通过 `getComputedStyle` 解析 `var(--token)`。
3. 解析后的 SVG 变成 `data:image/svg+xml` URI。图片就是一个沙箱：脚本被禁用，远程请求被拦截。
4. `MutationObserver` 监听主题切换（`body[data-ds-dark-theme]`），用新颜色重新编码图片。
5. 客户端 JavaScript 约 21 KB。没有宿主代码，没有依赖，不发网络请求。

## 致谢

思路来自 [oh-my-pi](https://github.com/can1357/oh-my-pi) 的 figure pipeline：把 SVG 代码块从助手 Markdown 里提出来，在绘制前解析主题 token，再给结果加一个源码切换。这里是这些思路在 DSH 上的浏览器实现，代码从零写起。

演示动画由 [fframes](https://github.com/dmtrKovalenko/fframes) 渲染。

## 同一对里的另一个

[dsh-table-charts](https://github.com/chandra447/dsh-table-charts) 会在看起来像数据的 Markdown 表格下面画条形图。不需要工具调用，不需要服务。

## 许可证

MIT。Copyright 2026 Chandra Doredla.
