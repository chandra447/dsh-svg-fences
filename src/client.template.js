/*!
 * dsh-svg-fences
 * Turn ```svg fences in DeepSeek Harness chat into theme-aware inline figures.
 * MIT License. No dependencies, no network, no renderer to load.
 */
window.__ModuleLoader__.load({
  id: 'dsh-svg-fences',
  factory() {
    'use strict'

    const BOX = 'data-svg-figure'
    const HIDDEN = 'data-svg-figure-hidden'
    const SOURCE = 'data-svg-figure-source'
    const FAILED = 'data-svg-figure-failed'
    const CLASS = 'dsh-svg-figure'
    const MODAL = 'dsh-svg-figure-modal'
    const NS = 'svg-fences'
    const DEBOUNCE_MS = 250
    const MAX_SOURCE = 60000
    const MAX_SCALE = 6
    const VAR_RE = /var\(\s*--([\w-]+)\s*(?:,\s*((?:[^()]|\([^()]*\))*))?\)/g
    const ROOT_TAG = /<(?:[\w.-]+:)?svg(?=[\s/>])[^>]*>/

    // Short aliases authors can use inside a fence: var(--fg), var(--accent).
    // Unknown names are read as literal custom properties first, so any
    // --dsw-* token in the page works without this table.
    const GENERIC = {
      bg: '--dsw-alias-bg-base',
      fg: '--dsw-alias-label-primary',
      muted: '--dsw-alias-label-secondary',
      border: '--dsw-alias-border-l1',
      line: '--dsw-alias-border-l2',
      accent: '--dsw-alias-brand-primary',
      surface: '--dsw-alias-bg-layer-1',
      'surface-alt': '--dsw-alias-bg-layer-2',
    }

    const EN = {
      open: 'Open larger',
      title: 'SVG figure',
      close: 'Close',
      source: 'Source',
      render: 'Render',
      copy: 'Copy',
      copied: 'Copied',
      download: 'Download',
      zoomIn: 'Zoom in',
      zoomOut: 'Zoom out',
      reset: 'Reset zoom',
    }
    const ZH = {
      open: '放大查看',
      title: 'SVG 图形',
      close: '关闭',
      source: '源码',
      render: '渲染',
      copy: '复制',
      copied: '已复制',
      download: '下载',
      zoomIn: '放大',
      zoomOut: '缩小',
      reset: '重置缩放',
    }

    const CSS = [
      `.${CLASS}{max-width:100%;margin:6px 0 11px;border:1px solid var(--figure-border);border-radius:8px;background:var(--figure-bg);overflow:hidden}`,
      `.${CLASS}-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 10px;border-bottom:1px solid var(--figure-border);font-size:12px;line-height:18px}`,
      `.${CLASS}-lang{font-weight:600;color:var(--figure-muted);text-transform:lowercase}`,
      `.${CLASS}-actions{display:flex;align-items:center;gap:4px}`,
      `.${CLASS}-btn{border:0;background:transparent;color:var(--figure-muted);font:inherit;font-size:12px;padding:2px 7px;border-radius:6px;cursor:pointer}`,
      `.${CLASS}-btn:hover{color:var(--figure-accent);background:var(--figure-hover)}`,
      `.${CLASS}-body{padding:10px 12px;cursor:zoom-in}`,
      `.${CLASS}-body img{display:block;max-width:100%;height:auto}`,
      `div.md-code-block[${HIDDEN}="1"]{display:none!important}`,
      `.${MODAL}{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box;background:rgba(0,0,0,.55)}`,
      `.${MODAL}-panel{width:min(1200px,92vw);height:min(80vh,860px);display:flex;flex-direction:column;overflow:hidden;background:var(--figure-bg);color:var(--figure-fg);border:1px solid var(--figure-border);border-radius:12px;box-shadow:0 24px 80px rgba(0,0,0,.45)}`,
      `.${MODAL}-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-bottom:1px solid var(--figure-border)}`,
      `.${MODAL}-title{font-size:13px;font-weight:600}`,
      `.${MODAL}-tools{display:flex;align-items:center;gap:6px}`,
      `.${MODAL}-tool{min-width:28px;height:28px;border:1px solid var(--figure-border);border-radius:8px;background:transparent;color:inherit;font-size:14px;line-height:1;cursor:pointer;padding:0 8px}`,
      `.${MODAL}-tool:hover{border-color:var(--figure-accent);color:var(--figure-accent)}`,
      `.${MODAL}-body{flex:1;min-height:0;padding:10px}`,
      `.${MODAL}-scroll{width:100%;height:100%;overflow:auto;display:flex;align-items:center;justify-content:center}`,
    ].join('\n')

    let modal = null
    let translator = null

    function t(key) {
      if (translator) {
        try {
          const text = translator(key)
          if (text) return text
        } catch {}
      }
      return EN[key] || key
    }

    // ---- colour helpers -------------------------------------------------

    function parseColor(input) {
      const value = (input || '').trim()
      if (!value) return null
      const rgb = /^rgba?\(([^)]+)\)$/i.exec(value)
      if (rgb) {
        const parts = rgb[1].split(/[,/]/).map((p) => parseFloat(p))
        if (parts.length >= 3 && parts.slice(0, 3).every((n) => Number.isFinite(n))) {
          return [parts[0], parts[1], parts[2], parts[3] === undefined ? 1 : parts[3]]
        }
        return null
      }
      const hex = /^#([0-9a-f]{3,8})$/i.exec(value)
      if (hex) {
        let s = hex[1]
        if (s.length === 3 || s.length === 4) s = s.split('').map((c) => c + c).join('')
        const n = parseInt(s.slice(0, 6), 16)
        const a = s.length === 8 ? parseInt(s.slice(6, 8), 16) / 255 : 1
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
      }
      return null
    }

    function mix(bg, fg, amount) {
      const a = parseColor(bg)
      const b = parseColor(fg)
      if (!a || !b) return fg
      const blend = (i) => Math.round(a[i] + (b[i] - a[i]) * amount)
      return `rgb(${blend(0)}, ${blend(1)}, ${blend(2)})`
    }

    function backgroundBehind(el) {
      let node = el && el.parentElement
      while (node && node !== document.documentElement) {
        const colour = getComputedStyle(node).backgroundColor
        const parsed = parseColor(colour)
        if (parsed && parsed[3] >= 0.5) return colour
        node = node.parentElement
      }
      return getComputedStyle(document.body).backgroundColor || '#ffffff'
    }

    // DSH's brand-primary is the monochrome fill used by primary buttons, so a
    // blue accent is read from the link token first. Both follow the theme.
    const ACCENT_TOKENS = ['--dsw-alias-link', '--dsw-alias-onboarding-accent', '--dsw-alias-brand-primary']

    function accentOf(cs) {
      for (const token of ACCENT_TOKENS) {
        const value = cs.getPropertyValue(token).trim()
        if (value) return value
      }
      return '#4d6bfe'
    }

    // DSH scopes its theme tokens to containers, not :root, so every value is
    // read from the chat card the fence lives in.
    function theme(el) {
      const cs = getComputedStyle(el)
      const read = (name) => cs.getPropertyValue(name).trim()
      const bg = read('--dsw-alias-bg-base') || backgroundBehind(el) || '#ffffff'
      const fg = read('--dsw-alias-label-primary') || cs.color || '#e6e6e6'
      const surface = read('--dsw-alias-bg-layer-1') || mix(bg, fg, 0.07)
      return {
        bg,
        fg,
        muted: read('--dsw-alias-label-secondary') || mix(bg, fg, 0.66),
        border: read('--dsw-alias-border-l1') || mix(bg, fg, 0.28),
        line: read('--dsw-alias-border-l2') || mix(bg, fg, 0.55),
        accent: accentOf(cs),
        surface,
        surfaceAlt: read('--dsw-alias-bg-layer-2') || mix(bg, fg, 0.11),
        hover: mix(surface, fg, 0.08),
      }
    }

    function paint(el, p) {
      const set = (name, value) => {
        if (value) el.style.setProperty(name, value)
      }
      set('--figure-bg', p.bg)
      set('--figure-border', p.border)
      set('--figure-fg', p.fg)
      set('--figure-muted', p.muted)
      set('--figure-accent', p.accent)
      set('--figure-hover', p.hover)
    }

    // ---- svg processing --------------------------------------------------

    // Rewrite var(--token) to the live value and add the attributes an inert
    // data: image needs. This is what makes a fence follow the theme.
    function resolveTokens(source, el) {
      const cs = getComputedStyle(el)
      const fg = cs.getPropertyValue('--dsw-alias-label-primary').trim() || cs.color || '#e6e6e6'
      const resolved = source.replace(VAR_RE, (_match, rawName, fallback) => {
        const name = String(rawName).trim()
        const value = name === 'accent' ? accentOf(cs) : cs.getPropertyValue(GENERIC[name] || `--${name}`).trim()
        if (value) return value
        const fb = fallback && fallback.trim()
        return fb || fg
      })

      const usesXlink = resolved.includes('xlink:')
      return resolved.replace(ROOT_TAG, (tag) => {
        let added = ''
        if (!/\scolor\s*=/.test(tag)) added += ` color="${fg}"`
        if (!/\sfont-family\s*=/.test(tag)) added += ' font-family="sans-serif"'
        if (!/\sxmlns\s*=/.test(tag)) added += ' xmlns="http://www.w3.org/2000/svg"'
        if (usesXlink && !/\sxmlns:xlink\s*=/.test(tag)) added += ' xmlns:xlink="http://www.w3.org/1999/xlink"'
        return added ? tag.replace(/^<[^\s/>]+/, (open) => open + added) : tag
      })
    }

    function isSvgSource(source) {
      const trimmed = source.trimStart()
      if (!trimmed.startsWith('<')) return false
      if (!/<(?:[\w.-]+:)?svg[\s/>]/.test(trimmed)) return false
      try {
        const doc = new DOMParser().parseFromString(trimmed, 'image/svg+xml')
        if (doc.getElementsByTagName('parsererror').length > 0) return false
        return doc.documentElement && doc.documentElement.localName === 'svg'
      } catch {
        return false
      }
    }

    function svgDataUri(svg) {
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    }

    function titleOf(svg) {
      const match = /<title[^>]*>([^<]{1,80})<\/title>/i.exec(svg)
      if (!match) return 'figure'
      const name = match[1].trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '')
      return name || 'figure'
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text)
      }
      return new Promise((resolve, reject) => {
        try {
          const area = document.createElement('textarea')
          area.value = text
          area.setAttribute('readonly', '')
          area.style.position = 'fixed'
          area.style.opacity = '0'
          document.body.append(area)
          area.select()
          const ok = document.execCommand('copy')
          area.remove()
          if (ok) resolve()
          else reject(new Error('copy rejected'))
        } catch (error) {
          reject(error)
        }
      })
    }

    function downloadSvg(card, figure) {
      try {
        const svg = resolveTokens(figure.source, card)
        const blob = new Blob([svg], { type: 'image/svg+xml' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `${titleOf(svg)}.svg`
        document.body.append(link)
        link.click()
        link.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1500)
      } catch {}
    }

    // ---- zoom modal ------------------------------------------------------

    function closeModal() {
      if (!modal) return
      const current = modal
      modal = null
      document.removeEventListener('keydown', current.onKey, true)
      current.overlay.remove()
      if (current.restoreFocus && current.restoreFocus.isConnected) {
        try {
          current.restoreFocus.focus()
        } catch {}
      }
    }

    function zoomControls(apply) {
      const bar = document.createElement('div')
      bar.className = `${MODAL}-tools`
      const make = (label, title, run) => {
        const b = document.createElement('button')
        b.type = 'button'
        b.className = `${MODAL}-tool`
        b.textContent = label
        b.title = title
        b.setAttribute('aria-label', title)
        b.addEventListener('click', run)
        return b
      }
      bar.append(
        make('+', t('zoomIn'), () => apply(1.25)),
        make('−', t('zoomOut'), () => apply(0.8)),
        make('⤢', t('reset'), () => apply(0)),
      )
      return bar
    }

    function openModal(card, figure) {
      closeModal()
      const p = theme(card)

      const overlay = document.createElement('div')
      overlay.className = MODAL
      overlay.setAttribute('role', 'dialog')
      overlay.setAttribute('aria-modal', 'true')
      overlay.setAttribute('aria-label', t('title'))
      overlay.tabIndex = -1

      const panel = document.createElement('div')
      panel.className = `${MODAL}-panel`

      const head = document.createElement('div')
      head.className = `${MODAL}-head`
      const title = document.createElement('span')
      title.className = `${MODAL}-title`
      title.textContent = t('title')
      const tools = document.createElement('div')
      tools.className = `${MODAL}-tools`

      const close = document.createElement('button')
      close.type = 'button'
      close.className = `${MODAL}-tool`
      close.setAttribute('aria-label', t('close'))
      close.title = t('close')
      close.textContent = '×'

      const body = document.createElement('div')
      body.className = `${MODAL}-body`
      const scroll = document.createElement('div')
      scroll.className = `${MODAL}-scroll`
      const img = document.createElement('img')
      img.alt = t('title')
      img.src = figure.svgUri || svgDataUri(resolveTokens(figure.source, card))
      let scale = 1
      const apply = (factor) => {
        scale = factor === 0 ? 1 : Math.min(MAX_SCALE, Math.max(0.25, scale * factor))
        img.style.width = `${Math.round(scale * 100)}%`
        img.style.maxWidth = 'none'
      }
      scroll.append(img)
      body.append(scroll)
      tools.append(zoomControls(apply), close)
      head.append(title, tools)
      panel.append(head, body)
      overlay.append(panel)
      document.body.append(overlay)
      paint(overlay, p)

      const onKey = (event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          closeModal()
        }
      }
      document.addEventListener('keydown', onKey, true)
      overlay.addEventListener('pointerdown', (event) => {
        if (event.target === overlay) closeModal()
      })
      close.addEventListener('click', () => closeModal())
      close.focus()

      modal = { overlay, onKey, card, figure, img }
    }

    // ---- figure lifecycle -------------------------------------------------

    function sourceOf(card) {
      const content = card.querySelector('[data-code-block-content]')
      if (!content) return null
      const pre = content.querySelector('pre')
      if (!pre) return null
      const text = (pre.textContent || '').replace(/\n$/, '')
      return text.trim() === '' ? null : text
    }

    function destroyFigure(card) {
      const figure = card.__svgFigure
      if (!figure) return
      figure.box.remove()
      card.__svgFigure = undefined
      card.removeAttribute(HIDDEN)
    }

    function buildBox(card, figure, p) {
      const box = document.createElement('div')
      box.className = CLASS
      box.setAttribute(BOX, '1')
      box.__svgFigureOwner = card

      const head = document.createElement('div')
      head.className = `${CLASS}-head`

      const label = document.createElement('span')
      label.className = `${CLASS}-lang`
      label.textContent = 'svg'

      const actions = document.createElement('div')
      actions.className = `${CLASS}-actions`

      const sourceBtn = document.createElement('button')
      sourceBtn.type = 'button'
      sourceBtn.className = `${CLASS}-btn`
      sourceBtn.textContent = t('source')

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = `${CLASS}-btn`
      copyBtn.textContent = t('copy')

      const downloadBtn = document.createElement('button')
      downloadBtn.type = 'button'
      downloadBtn.className = `${CLASS}-btn`
      downloadBtn.textContent = t('download')

      const body = document.createElement('div')
      body.className = `${CLASS}-body`
      body.title = t('open')

      actions.append(sourceBtn, copyBtn, downloadBtn)
      head.append(label, actions)
      box.append(head, body)

      sourceBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        const showSource = !figure.sourceShown
        figure.sourceShown = showSource
        sourceBtn.textContent = showSource ? t('render') : t('source')
        body.style.display = showSource ? 'none' : ''
        if (showSource) card.removeAttribute(HIDDEN)
        else card.setAttribute(HIDDEN, '1')
      })

      copyBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        copyText(figure.source)
          .then(() => {
            copyBtn.textContent = t('copied')
            setTimeout(() => {
              copyBtn.textContent = t('copy')
            }, 1200)
          })
          .catch(() => {})
      })

      downloadBtn.addEventListener('click', (event) => {
        event.stopPropagation()
        downloadSvg(card, figure)
      })

      body.addEventListener('click', () => openModal(card, figure))

      figure.box = box
      figure.body = body
      figure.label = label
      figure.sourceBtn = sourceBtn
      card.after(box)
      paint(box, p)
      return body
    }

    function mountFigure(card, figure) {
      const body = figure.body
      paint(figure.box, theme(card))
      const uri = svgDataUri(resolveTokens(figure.source, card))
      figure.svgUri = uri
      if (!figure.img) {
        const img = document.createElement('img')
        img.alt = t('title')
        img.decoding = 'async'
        img.addEventListener('error', () => {
          if (figure.source === img.dataset.source) {
            card.removeAttribute(HIDDEN)
            card.setAttribute(FAILED, figure.source)
          }
        })
        body.append(img)
        figure.img = img
      }
      figure.img.dataset.source = figure.source
      figure.img.src = uri
      card.setAttribute(HIDDEN, '1')
      return true
    }

    function renderCard(card, source) {
      let figure = card.__svgFigure

      if (figure) {
        figure.source = source
        mountFigure(card, figure)
        card.setAttribute(SOURCE, source)
        card.removeAttribute(FAILED)
        return
      }

      destroyFigure(card)
      figure = { source, sourceShown: false }
      card.__svgFigure = figure
      card.setAttribute(SOURCE, source)
      buildBox(card, figure, theme(card))
      mountFigure(card, figure)
      card.removeAttribute(FAILED)
    }

    function scan() {
      for (const box of document.querySelectorAll(`[${BOX}="1"]`)) {
        const card = box.__svgFigureOwner
        if (!card || !card.isConnected || card.__svgFigure?.box !== box) {
          if (card && card.__svgFigure?.box === box) card.__svgFigure = undefined
          box.remove()
        }
      }

      for (const card of document.querySelectorAll('div.md-code-block')) {
        if (card.hasAttribute('data-line-numbers')) continue
        const source = sourceOf(card)
        if (source === null || source.length > MAX_SOURCE) continue
        if (!isSvgSource(source)) continue
        const figure = card.__svgFigure
        if (figure && figure.source === source && figure.box.isConnected) continue
        if (card.getAttribute(FAILED) === source) continue
        renderCard(card, source)
      }
    }

    function repaint() {
      for (const box of document.querySelectorAll(`[${BOX}="1"]`)) {
        const card = box.__svgFigureOwner
        if (!card) continue
        const figure = card.__svgFigure
        if (!figure) continue
        paint(box, theme(card))
        const uri = svgDataUri(resolveTokens(figure.source, card))
        figure.svgUri = uri
        if (figure.img) figure.img.src = uri
      }
      if (modal) {
        paint(modal.overlay, theme(modal.card))
        modal.img.src = svgDataUri(resolveTokens(modal.figure.source, modal.card))
      }
    }

    function install(ctx) {
      try {
        if (ctx.locale) {
          ctx.locale.register(NS, { en: EN, zh: ZH })
          translator = ctx.locale.bind(NS)
        }
      } catch {}

      const style = document.createElement('style')
      style.setAttribute('data-plugin', 'dsh-svg-fences')
      style.textContent = CSS
      document.head.appendChild(style)

      let timer = null
      const schedule = () => {
        if (timer !== null) return
        timer = setTimeout(() => {
          timer = null
          scan()
        }, DEBOUNCE_MS)
      }

      const observer = new MutationObserver(() => schedule())
      observer.observe(document.body, { childList: true, subtree: true, characterData: true })

      // DSH switches themes with body[data-ds-dark-theme], so attribute
      // changes on html and body are cheaper to watch than a filtered list.
      // The palette signature keeps unrelated mutations from re-encoding.
      const themeKey = () => {
        const p = theme(document.body)
        return [p.bg, p.fg, p.muted, p.border, p.surface, p.accent].join('|')
      }
      let currentThemeKey = themeKey()
      let themeTimer = null
      const themeObserver = new MutationObserver(() => {
        if (themeTimer !== null) return
        themeTimer = setTimeout(() => {
          themeTimer = null
          const next = themeKey()
          if (next === currentThemeKey) return
          currentThemeKey = next
          repaint()
        }, 120)
      })
      themeObserver.observe(document.documentElement, { attributes: true })
      themeObserver.observe(document.body, { attributes: true })

      scan()

      ctx.effect(
        () => () => {
          observer.disconnect()
          themeObserver.disconnect()
          if (timer !== null) clearTimeout(timer)
          if (themeTimer !== null) clearTimeout(themeTimer)
          closeModal()
          if (translator) translator = null
          style.remove()
          for (const card of document.querySelectorAll('div.md-code-block')) {
            if (card.__svgFigure) destroyFigure(card)
          }
          for (const box of document.querySelectorAll(`[${BOX}="1"]`)) box.remove()
          for (const card of document.querySelectorAll(`div.md-code-block[${HIDDEN}]`)) {
            card.removeAttribute(HIDDEN)
          }
        },
        'svg-fences: chat figures',
      )
    }

    return {
      apply(ctx) {
        install(ctx)
      },
    }
  },
})
