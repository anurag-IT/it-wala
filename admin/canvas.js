/* IT Wala Dai visual editor — canvas side (runs inside the page iframe, same origin as the admin).
 * The page's own scripts are inert here, so the DOM is exactly the HTML that gets saved. Editor-only state
 * (element ids, overlays, contenteditable) is stripped by serialize(); nothing of the editor reaches the site. */
(function () {
  'use strict'
  const boot = JSON.parse(document.getElementById('itwd-editor-boot').textContent)
  const ED = window.parent && window.parent.ITWDEditor
  if (!ED) return
  let editingMode = false

  const SKIP = new Set(['SCRIPT', 'STYLE', 'LINK', 'META', 'TEMPLATE', 'NOSCRIPT', 'BR', 'WBR'])
  const VOID = new Set(['IMG', 'INPUT', 'HR', 'BR', 'IFRAME', 'VIDEO', 'SVG', 'svg', 'I', 'SOURCE', 'TEXTAREA', 'SELECT'])
  const TEXT_TAGS = new Set(['P', 'SPAN', 'LI', 'SMALL', 'STRONG', 'EM', 'B', 'LABEL', 'BLOCKQUOTE', 'FIGCAPTION', 'DT', 'DD', 'TD', 'TH', 'CITE', 'Q', 'H6'])
  const INLINE_OK = new Set(['B', 'STRONG', 'I', 'EM', 'BR', 'SPAN', 'A', 'SMALL', 'SUB', 'SUP', 'CODE', 'U', 'MARK'])
  let seq = 0
  const byId = new Map()

  const header = () => document.querySelector('header.th-header')
  const smooth = () => document.getElementById('smooth-content')
  const footer = () => smooth() && smooth().querySelector('footer')

  function assign(root) {
    const walk = (el) => {
      if (SKIP.has(el.tagName)) return
      if (el.closest && el.closest('#itwd-ed-layer')) return
      if (!el.dataset.itwdEid) el.dataset.itwdEid = 'e' + (++seq)
      byId.set(el.dataset.itwdEid, el)
      if (el.tagName.toLowerCase() === 'svg') return
      for (const c of el.children) walk(c)
    }
    walk(root)
  }
  const get = (eid) => {
    const el = byId.get(eid)
    return el && el.isConnected ? el : null
  }

  // ------------------------------------------------------------ regions + locks

  function regionOf(el) {
    if (!el || !el.closest) return null
    const h = header()
    const f = footer()
    if (h && (el === h || h.contains(el))) return 'header'
    if (f && (el === f || f.contains(el))) return 'footer'
    const badge = document.querySelector('.itwd-pranam-tab')
    if (badge && (el === badge || badge.contains(el))) return 'sideTab'
    const s = smooth()
    if (s && s.contains(el) && el !== s) return 'main'
    return null
  }

  let managedTop = new Map()   // top-level element of a managed block -> block name
  function markManaged() {
    managedTop = new Map()
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT)
    let n
    while ((n = walker.nextNode())) {
      const m = /^ itwd:([\w-]+):start $/.exec(n.data)
      if (!m || !(m[1] in boot.managedBlocks)) continue
      let sib = n.nextSibling
      while (sib && !(sib.nodeType === 8 && sib.data === ' itwd:' + m[1] + ':end ')) {
        if (sib.nodeType === 1) managedTop.set(sib, m[1])
        sib = sib.nextSibling
      }
    }
  }
  function managedOf(el) {
    if (boot.managedPage && regionOf(el) === 'main') return 'course page'
    for (let x = el; x && x !== document.body; x = x.parentElement) {
      if (managedTop.has(x)) return boot.managedBlocks[managedTop.get(x)]
      if (x.id === 'menu-primary-menu-1' || x.id === 'menu-quick-links') return 'nav'
    }
    return null
  }
  const isRoot = (el) => el === header() || el === footer() || el === document.querySelector('.itwd-pranam-tab')

  // ------------------------------------------------------------ element description for the properties panel

  function kindOf(el) {
    const t = el.tagName
    const cls = typeof el.className === 'string' ? el.className : ''
    if (t === 'IMG') return 'image'
    if (t.toLowerCase() === 'svg' || (t === 'I' && /\bfa[a-z]?\b|\bfa-/.test(cls))) return 'icon'
    if (t === 'IFRAME' || el.classList.contains('itwd-embed')) return 'video'
    if (t === 'BUTTON' || (t === 'A' && /\b(th-btn|btn|itwd-join-cta|itwd-col2__btn)\b/.test(cls))) return 'button'
    if (t === 'A') return 'link'
    if (/^H[1-6]$/.test(t)) return 'heading'
    if (t === 'HR') return 'divider'
    if (TEXT_TAGS.has(t)) return 'text'
    if (t === 'SECTION' || t === 'HEADER' || t === 'FOOTER' || /\be-parent\b/.test(cls)) return 'section'
    if (t === 'FORM' || t === 'INPUT' || t === 'SELECT' || t === 'TEXTAREA') return 'form'
    return 'container'
  }

  function label(el) {
    const cls = (typeof el.className === 'string' ? el.className : '').split(/\s+/).filter((c) => c && !c.startsWith('itwd-e-') && !/^elementor-element-[0-9a-f]+$/.test(c))
    const txt = (el.innerText || el.getAttribute('alt') || '').trim().replace(/\s+/g, ' ').slice(0, 38)
    const k = kindOf(el)
    const name = { image: 'Image', icon: 'Icon', video: 'Video', button: 'Button', link: 'Link', heading: el.tagName, divider: 'Divider', text: 'Text', section: 'Section', form: 'Form', container: 'Box' }[k]
    return name + (txt && ['heading', 'text', 'button', 'link'].includes(k) ? ': ' + txt : cls[0] ? ' .' + cls[0] : '')
  }

  function hasBlockChildren(el) {
    return [...el.children].some((c) => !INLINE_OK.has(c.tagName) && c.tagName !== 'I' && c.tagName.toLowerCase() !== 'svg' && c.tagName !== 'IMG')
  }
  function textEditable(el) {
    const k = kindOf(el)
    return (k === 'heading' || k === 'text') && !hasBlockChildren(el)
  }
  function ownText(el) {
    return [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').replace(/\s+/g, ' ').trim()
  }

  function info(el) {
    const cs = getComputedStyle(el)
    const region = regionOf(el)
    const managed = managedOf(el)
    const attrs = {}
    for (const a of ['href', 'target', 'rel', 'src', 'alt', 'title', 'loading', 'width', 'height', 'id', 'aria-label', 'data-bg-src', 'class']) {
      if (el.hasAttribute(a)) attrs[a] = el.getAttribute(a)
    }
    const crumbs = []
    for (let x = el; x && regionOf(x); x = x.parentElement) crumbs.unshift({ eid: x.dataset.itwdEid, label: label(x) })
    const iconEl = el.querySelector(':scope > i[class*="fa"]')
    const styleKey = [...el.classList].find((c) => /^itwd-e-[a-z0-9]{4,16}$/.test(c)) || null
    const pick = ['font-family', 'font-size', 'font-weight', 'color', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
      'background-color', 'background-image', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right',
      'padding-bottom', 'padding-left', 'width', 'max-width', 'height', 'min-height', 'display', 'flex-direction', 'justify-content',
      'align-items', 'gap', 'grid-template-columns', 'border-width', 'border-style', 'border-color', 'border-radius', 'box-shadow', 'opacity',
      'object-fit', 'object-position', 'order', 'position', 'top', 'right', 'bottom', 'left', 'z-index', 'aspect-ratio', 'overflow']
    const computed = {}
    for (const p of pick) computed[p] = cs.getPropertyValue(p)
    return {
      eid: el.dataset.itwdEid, tag: el.tagName.toLowerCase(), kind: kindOf(el), label: label(el), region, managed,
      isRoot: isRoot(el), global: region === 'header' || region === 'footer' || region === 'sideTab',
      canMove: Boolean(region) && !managed && !isRoot(el), canDelete: Boolean(region) && !managed && !isRoot(el),
      canEdit: Boolean(region) && !managed, textEditable: !managed && textEditable(el),
      text: textEditable(el) && !el.children.length ? el.textContent.trim() : ownText(el), hasChildren: el.children.length > 0,
      attrs, iconClass: el.tagName === 'I' ? el.className : iconEl ? iconEl.className : null,
      action: {
        whatsapp: /wa\.me\//.test(el.getAttribute('href') || ''), enquiry: el.classList.contains('itwd-start'),
        join: el.hasAttribute('data-itwd-join'), app: el.getAttribute('data-app-link'), kind: el.getAttribute('data-kind'), project: el.getAttribute('data-project'),
      },
      styleKey, computed, crumbs, parentEid: el.parentElement && regionOf(el.parentElement) ? el.parentElement.dataset.itwdEid : null,
      linkParent: el.parentElement && el.parentElement.tagName === 'A' ? el.parentElement.dataset.itwdEid : null,
    }
  }

  // ------------------------------------------------------------ overlay

  const layer = document.createElement('div')
  layer.id = 'itwd-ed-layer'
  layer.innerHTML = '<div class="ed-box ed-hover"></div><div class="ed-box ed-select"></div><div class="ed-label"></div>' +
    '<div class="ed-toolbar" role="toolbar" aria-label="Element actions">' +
    '<button type="button" data-act="drag" title="Drag to move" aria-label="Drag to move">⠿</button>' +
    '<button type="button" data-act="up" title="Move up (Alt+↑)" aria-label="Move up">↑</button>' +
    '<button type="button" data-act="down" title="Move down (Alt+↓)" aria-label="Move down">↓</button>' +
    '<button type="button" data-act="parent" title="Select parent" aria-label="Select parent">⤴</button>' +
    '<button type="button" data-act="dup" title="Duplicate (Ctrl+D)" aria-label="Duplicate">⧉</button>' +
    '<button type="button" data-act="del" title="Delete (Del)" aria-label="Delete">✕</button></div>' +
    '<div class="ed-drop"></div><div class="ed-drop-label"></div><div class="ed-toast" role="status"></div>'
  document.body.appendChild(layer)
  const $ = (s) => layer.querySelector(s)
  const hoverBox = $('.ed-hover')
  const selBox = $('.ed-select')
  const selLabel = $('.ed-label')
  const toolbar = $('.ed-toolbar')
  const dropBox = $('.ed-drop')
  const dropLabel = $('.ed-drop-label')
  const toastEl = $('.ed-toast')

  function place(box, el, show = true) {
    if (!el || !show) { box.style.display = 'none'; return null }
    const r = el.getBoundingClientRect()
    Object.assign(box.style, { display: 'block', left: r.left + 'px', top: r.top + 'px', width: Math.max(r.width, 2) + 'px', height: Math.max(r.height, 2) + 'px' })
    return r
  }
  let toastTimer
  function toast(msg) {
    toastEl.textContent = msg
    toastEl.style.display = 'block'
    clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toastEl.style.display = 'none' }, 2600)
  }

  let selected = null
  let hovered = null
  function drawSelection() {
    if (!selected || !selected.isConnected) {
      selected = null
      selBox.style.display = selLabel.style.display = toolbar.style.display = 'none'
      return
    }
    const r = place(selBox, selected)
    const i = info(selected)
    const locked = Boolean(i.managed)
    selBox.classList.toggle('is-locked', locked)
    selBox.classList.toggle('is-global', !locked && i.global)
    selLabel.className = 'ed-label' + (locked ? ' is-locked' : i.global ? ' is-global' : '')
    selLabel.textContent = (locked ? '🔒 ' : i.global ? '◆ ' : '') + i.label
    selLabel.style.display = 'block'
    selLabel.style.left = r.left + 'px'
    selLabel.style.top = Math.max(0, r.top - 20) + 'px'
    toolbar.style.display = 'flex'
    const tw = 6 * 30 + 6
    toolbar.style.left = Math.min(Math.max(4, r.right - tw), innerWidth - tw - 4) + 'px'
    toolbar.style.top = (r.top > 40 ? r.top - 36 : Math.min(r.bottom + 6, innerHeight - 40)) + 'px'
    for (const b of toolbar.querySelectorAll('button')) {
      const act = b.dataset.act
      b.disabled = (['drag', 'up', 'down', 'del', 'dup'].includes(act) && !i.canMove) || (act === 'parent' && !i.parentEid)
    }
  }
  function drawHover() {
    place(hoverBox, hovered && hovered !== selected ? hovered : null)
  }
  addEventListener('scroll', () => { drawSelection(); drawHover() }, true)
  addEventListener('resize', () => { drawSelection(); drawHover() })

  function selectEl(el, { notify = true, scroll = false } = {}) {
    if (editing && editing !== el) finishEditing()
    selected = el
    drawSelection()
    if (el && scroll) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    if (notify) ED.onSelect(el ? info(el) : null)
  }

  function targetFrom(node) {
    let el = node && node.nodeType === 1 ? node : node && node.parentElement
    while (el && (!el.dataset || !el.dataset.itwdEid)) el = el.parentElement
    if (!el || el.closest('#itwd-ed-layer')) return null
    // an <svg> inside a button selects the button; an svg <path> selects its svg
    const svg = el.closest('svg')
    if (svg && svg.parentElement && svg.parentElement.dataset.itwdEid) el = svg.parentElement.tagName === 'A' || svg.parentElement.tagName === 'BUTTON' ? svg.parentElement : svg
    return el
  }

  // ------------------------------------------------------------ pointer + keyboard

  document.addEventListener('mousemove', (e) => {
    if (!editingMode) return
    if (dragging) return
    const el = targetFrom(e.target)
    hovered = el && regionOf(el) ? el : null
    drawHover()
  })
  document.addEventListener('mouseleave', () => { hovered = null; drawHover() })

  document.addEventListener('click', (e) => {
    if (e.target.closest && e.target.closest('#itwd-ed-layer')) return
    if (!editingMode) {
      const a = e.target.closest && e.target.closest('a[href]')
      if (a && a.getAttribute('href') && !a.getAttribute('href').startsWith('#')) {
        e.preventDefault()
        ED.navigate(a.href)
      }
      return
    }
    if (editing && editing.contains(e.target)) return
    e.preventDefault()
    e.stopPropagation()
    const el = targetFrom(e.target)
    if (!el || !regionOf(el)) {
      if (el) toast('This part (menus, pop-ups, side tab) is not edited here.')
      return
    }
    selectEl(el)
  }, true)
  document.addEventListener('submit', (e) => { if (editingMode) e.preventDefault() }, true)
  document.addEventListener('auxclick', (e) => { if (editingMode) e.preventDefault() }, true)

  document.addEventListener('dblclick', (e) => {
    if (!editingMode) return
    const el = targetFrom(e.target)
    if (!el || !regionOf(el)) return
    e.preventDefault()
    if (managedOf(el)) { toast('This content comes from the CMS — edit it in Content.'); return }
    if (!textEditable(el)) {
      if (['button', 'link'].includes(kindOf(el))) toast('Change the button text in the panel on the right.')
      return
    }
    startEditing(el)
  }, true)

  document.addEventListener('keydown', (e) => {
    if (!editingMode) return
    const mod = e.ctrlKey || e.metaKey
    if (editing) {
      if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey && /^H[1-6]$/.test(editing.tagName))) { e.preventDefault(); finishEditing() }
      return
    }
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? ED.redo() : ED.undo(); return }
    if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ED.redo(); return }
    if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); ED.saveNow(); return }
    if (!selected) return
    if (e.key === 'Escape') { selectEl(null); return }
    if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); act('dup'); return }
    if (mod && e.key.toLowerCase() === 'c') { ED.copyElement(selected.dataset.itwdEid); return }
    if (mod && e.key.toLowerCase() === 'v') { e.preventDefault(); ED.pasteElement(selected.dataset.itwdEid); return }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); act('del'); return }
    if (e.altKey && e.key === 'ArrowUp') { e.preventDefault(); act('up'); return }
    if (e.altKey && e.key === 'ArrowDown') { e.preventDefault(); act('down'); return }
    if (e.key === 'Enter' && textEditable(selected) && !managedOf(selected)) { e.preventDefault(); startEditing(selected) }
  })

  toolbar.addEventListener('click', (e) => {
    if (!editingMode) return
    const b = e.target.closest('button')
    if (!b || b.disabled || b.dataset.act === 'drag') return
    act(b.dataset.act)
  })

  function act(name) {
    if (!selected) return
    const eid = selected.dataset.itwdEid
    if (name === 'parent') { const p = info(selected).parentEid; if (p) selectEl(get(p)); return }
    if (name === 'up' || name === 'down') { if (api.move(eid, name)) ED.changed('Move element'); return }
    if (name === 'dup') { const r = api.duplicate(eid); if (r) { ED.changed('Duplicate element', r); selectEl(get(r.eid)) } return }
    if (name === 'del') ED.requestDelete(eid)
  }

  // ------------------------------------------------------------ inline text editing

  let editing = null
  let editingBefore = ''
  function startEditing(el) {
    editing = el
    editingBefore = el.innerHTML
    el.setAttribute('contenteditable', 'true')
    el.setAttribute('spellcheck', 'true')
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const s = getSelection()
    s.removeAllRanges()
    s.addRange(range)
    selectEl(el)
  }
  function cleanInline(el) {
    // keep the element's own markup; unwrap anything the browser inserted that is not simple inline formatting
    for (const n of [...el.querySelectorAll('*')]) {
      if (n.dataset && n.dataset.itwdEid) continue
      if (INLINE_OK.has(n.tagName)) { n.removeAttribute('style'); n.removeAttribute('class'); continue }
      if (n.tagName === 'DIV' || n.tagName === 'P') { n.before(document.createElement('br')) }
      n.replaceWith(...n.childNodes)
    }
    for (const n of [...el.querySelectorAll('[style]')]) if (!(n.dataset && n.dataset.itwdEid)) n.removeAttribute('style')
  }
  function finishEditing() {
    const el = editing
    if (!el) return
    editing = null
    el.removeAttribute('contenteditable')
    el.removeAttribute('spellcheck')
    cleanInline(el)
    assign(el)
    if (el.innerHTML !== editingBefore) ED.changed('Edit text')
    selectEl(el)
  }
  document.addEventListener('focusout', (e) => { if (editing && e.target === editing) finishEditing() })
  document.addEventListener('paste', (e) => {
    if (!editing) return
    e.preventDefault()
    const text = (e.clipboardData || window.clipboardData).getData('text/plain')
    document.execCommand('insertText', false, text)
  })

  // ------------------------------------------------------------ drag and drop (move existing / insert from library)

  let dragging = null   // {el} when moving an element, {snippet: id} when inserting
  let drop = null

  function flowAxis(parent) {
    if (!parent) return 'y'
    const cs = getComputedStyle(parent)
    if ((cs.display.includes('flex') && cs.flexDirection.startsWith('row')) || cs.display.includes('grid')) {
      const kids = [...parent.children].filter((k) => k.offsetParent !== null)
      if (kids.length > 1 && Math.abs(kids[0].getBoundingClientRect().top - kids[1].getBoundingClientRect().top) < 8) return 'x'
    }
    return 'y'
  }
  function canContain(el) {
    return !VOID.has(el.tagName) && ['container', 'section', 'form'].includes(kindOf(el)) && !managedOf(el)
  }
  function computeDrop(x, y) {
    layer.style.display = 'none'
    const stack = document.elementsFromPoint(x, y)
    layer.style.display = ''
    for (const node of stack) {
      let el = targetFrom(node)
      if (!el) continue
      const region = regionOf(el)
      if (!region) continue
      if (dragging.el && (el === dragging.el || dragging.el.contains(el))) continue
      if (dragging.el && regionOf(dragging.el) !== region) return { invalid: 'Elements can only move inside the same area (header, page or footer).' }
      // a whole section is reordered among its sibling sections (never dropped inside another section's grid)
      if (dragging.el && kindOf(dragging.el) === 'section') {
        const parent = dragging.el.parentElement
        while (el && el.parentElement !== parent) el = el.parentElement
        if (!el) return { invalid: 'Sections move above or below other sections.' }
        const r = el.getBoundingClientRect()
        return { target: el, pos: (y - r.top) / r.height < 0.5 ? 'before' : 'after', rect: r, axis: 'y' }
      }
      // climb out of managed (CMS) blocks: you can drop next to them, never into them
      while (el && managedOf(el) && el.parentElement && regionOf(el.parentElement)) el = el.parentElement
      if (!el || managedOf(el)) return { invalid: 'CMS content blocks cannot receive elements.' }
      const r = el.getBoundingClientRect()
      const axis = flowAxis(el.parentElement)
      const rel = axis === 'x' ? (x - r.left) / r.width : (y - r.top) / r.height
      if (canContain(el) && rel > 0.25 && rel < 0.75 && !isRoot(el)) return { target: el, pos: 'inside', rect: r, axis }
      if (isRoot(el)) return canContain(el) ? { target: el, pos: 'inside', rect: r, axis } : { invalid: 'Not here' }
      return { target: el, pos: rel < 0.5 ? 'before' : 'after', rect: r, axis }
    }
    return null
  }
  function showDrop(d) {
    if (!d || d.invalid) {
      dropBox.style.display = 'none'
      dropLabel.style.display = d && d.invalid ? 'block' : 'none'
      if (d && d.invalid) { dropLabel.textContent = d.invalid; dropLabel.style.left = '12px'; dropLabel.style.top = '12px' }
      return
    }
    const r = d.rect
    dropBox.classList.toggle('is-inside', d.pos === 'inside')
    if (d.pos === 'inside') Object.assign(dropBox.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' })
    else if (d.axis === 'x') Object.assign(dropBox.style, { left: (d.pos === 'before' ? r.left - 2 : r.right - 2) + 'px', top: r.top + 'px', width: '4px', height: r.height + 'px' })
    else Object.assign(dropBox.style, { left: r.left + 'px', top: (d.pos === 'before' ? r.top - 2 : r.bottom - 2) + 'px', width: r.width + 'px', height: '4px' })
    dropBox.style.display = 'block'
    dropLabel.textContent = (d.pos === 'inside' ? 'Into ' : d.pos === 'before' ? 'Before ' : 'After ') + label(d.target)
    Object.assign(dropLabel.style, { display: 'block', left: Math.max(4, r.left) + 'px', top: Math.max(4, r.top - 22) + 'px' })
  }
  function endDrag() {
    dragging = null
    drop = null
    dropBox.style.display = dropLabel.style.display = 'none'
    document.documentElement.classList.remove('itwd-dragging')
  }

  toolbar.addEventListener('pointerdown', (e) => {
    if (!editingMode) return
    const b = e.target.closest('button[data-act="drag"]')
    if (!b || b.disabled || !selected) return
    e.preventDefault()
    dragging = { el: selected }
    document.documentElement.classList.add('itwd-dragging')
    b.setPointerCapture(e.pointerId)
  })
  toolbar.addEventListener('pointermove', (e) => {
    if (!dragging || !dragging.el) return
    drop = computeDrop(e.clientX, e.clientY)
    showDrop(drop)
    if (e.clientY < 40) scrollBy(0, -18)
    else if (e.clientY > innerHeight - 40) scrollBy(0, 18)
  })
  toolbar.addEventListener('pointerup', () => {
    if (!dragging || !dragging.el) return
    const d = drop
    const el = dragging.el
    endDrag()
    if (d && d.target && !d.invalid) {
      api.moveTo(el.dataset.itwdEid, d.target.dataset.itwdEid, d.pos)
      ED.changed('Move element')
      selectEl(el)
    }
  })

  const SNIPPET_TYPE = 'application/x-itwd-snippet'
  document.addEventListener('dragover', (e) => {
    if (!editingMode) return
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes(SNIPPET_TYPE)) return
    e.preventDefault()
    dragging = dragging || { snippet: true }
    drop = computeDrop(e.clientX, e.clientY)
    if (drop && drop.target && regionOf(drop.target) !== 'main') drop = { invalid: 'New elements go into the page content (not the shared header/footer).' }
    e.dataTransfer.dropEffect = drop && !drop.invalid ? 'copy' : 'none'
    showDrop(drop)
  })
  document.addEventListener('dragleave', (e) => { if (!e.relatedTarget) endDrag() })
  document.addEventListener('drop', (e) => {
    if (!editingMode) return
    if (!e.dataTransfer || ![...e.dataTransfer.types].includes(SNIPPET_TYPE)) return
    e.preventDefault()
    const id = e.dataTransfer.getData(SNIPPET_TYPE)
    const d = drop
    endDrag()
    if (!d || !d.target || d.invalid) return
    ED.insertSnippetAt(id, d.target.dataset.itwdEid, d.pos)
  })

  // ------------------------------------------------------------ data-bg-src backgrounds (theme JS normally sets them)

  const bgStyle = document.createElement('style')
  bgStyle.id = 'itwd-ed-bg'
  document.head.appendChild(bgStyle)
  function refreshBackgrounds() {
    const urls = new Set([...document.querySelectorAll('[data-bg-src]')].map((n) => n.getAttribute('data-bg-src')))
    bgStyle.textContent = [...urls].filter((u) => /^[\w\-./%:@?=&]+$/.test(u))
      .map((u) => '[data-bg-src="' + u + '"]{background-image:url("' + u + '");background-size:cover;background-position:center}').join('\n')
  }

  // ------------------------------------------------------------ serialization (what gets saved)

  function cleanClone(node) {
    const c = node.cloneNode(true)
    if (c.nodeType === 1) cleanTree(c, [c, ...c.querySelectorAll('*')])
    if (c.tagName === 'TEMPLATE') cleanTree(c.content, c.content.querySelectorAll('*'))
    return c
  }
  function cleanTree(root, all) {
    for (const n of all) {
      n.removeAttribute('data-itwd-eid')
      n.removeAttribute('contenteditable')
      n.removeAttribute('spellcheck')
      if (n.tagName === 'SCRIPT' && n.hasAttribute('data-itwd-type')) {
        const t = n.getAttribute('data-itwd-type')
        n.removeAttribute('data-itwd-type')
        if (t === '__none__') n.removeAttribute('type')
        else n.setAttribute('type', t)
      }
    }
    // <template> contents are a separate fragment (scripts in there were made inert by the server too)
    for (const t of root.querySelectorAll('template')) cleanTree(t.content, t.content.querySelectorAll('*'))
  }
  function htmlOf(nodes) {
    const box = document.createElement('div')
    for (const n of nodes) box.appendChild(cleanClone(n))
    return box.innerHTML
  }
  function mainNodes() {
    const s = smooth()
    const f = footer()
    const out = []
    for (const n of s.childNodes) {
      if (n === f) break
      out.push(n)
    }
    return out
  }

  // ------------------------------------------------------------ API used by the admin (parent window)

  const ALLOWED_ATTRS = new Set(['href', 'target', 'rel', 'src', 'alt', 'title', 'loading', 'width', 'height', 'id', 'aria-label', 'data-bg-src', 'srcset'])
  const api = {
    finishTextEditing() { if (editing) finishEditing() },
    setEditingMode(on) {
      editingMode = Boolean(on)
      document.documentElement.classList.toggle('itwd-editing', editingMode)
      if (!editingMode) {
        if (editing) finishEditing()
        selected = hovered = null
        drawSelection()
        drawHover()
        ED.onSelect(null)
      }
    },
    info: (eid) => { const el = get(eid); return el ? info(el) : null },
    select: (eid, opts) => { const el = eid ? get(eid) : null; selectEl(el, { notify: true, scroll: opts && opts.scroll }); return Boolean(el) },
    hover: (eid) => { hovered = eid ? get(eid) : null; drawHover() },
    redraw: () => { drawSelection(); drawHover() },
    toast,

    setText(eid, text) {
      const el = get(eid)
      if (!el || managedOf(el)) return false
      const texts = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())
      if (!el.children.length || (textEditable(el) && !texts.length && !el.querySelector('i,svg,img'))) { el.textContent = text; return true }
      if (texts.length) {
        texts[0].textContent = texts[0].textContent.replace(/\S[\s\S]*\S|\S/, text.trim() ? text : '')
        for (const t of texts.slice(1)) t.textContent = ' '
      } else {
        el.insertBefore(document.createTextNode(text), el.firstChild)
      }
      return true
    },
    setAttr(eid, name, value) {
      const el = get(eid)
      if (!el || managedOf(el) || !ALLOWED_ATTRS.has(name)) return false
      if (value === null || value === '') el.removeAttribute(name)
      else el.setAttribute(name, String(value))
      if (name === 'data-bg-src') refreshBackgrounds()
      return true
    },
    setClass(eid, cls, on) {
      const el = get(eid)
      if (!el || managedOf(el) || !/^[A-Za-z][\w-]{0,60}$/.test(cls)) return false
      el.classList.toggle(cls, Boolean(on))
      return true
    },
    setIcon(eid, cls) {
      const el = get(eid)
      if (!el || managedOf(el) || !/^(fa[a-z]?|fab|fas|far|fal|fad)( fa-[a-z0-9-]+)+( [a-z0-9-]+)*$/.test(cls)) return false
      const icon = el.tagName === 'I' ? el : el.querySelector(':scope > i[class*="fa"]')
      if (!icon) return false
      const keep = [...icon.classList].filter((c) => /^itwd-e-|^me-|^ms-/.test(c))
      icon.className = [cls, ...keep].join(' ')
      return true
    },
    setTag(eid, tag) {
      const el = get(eid)
      if (!el || managedOf(el) || !/^(h[1-6]|p|div|span)$/.test(tag)) return null
      if (el.tagName.toLowerCase() === tag) return eid
      const n = document.createElement(tag)
      for (const a of el.attributes) n.setAttribute(a.name, a.value)
      while (el.firstChild) n.appendChild(el.firstChild)
      el.replaceWith(n)
      byId.set(eid, n)
      if (selected === el) selected = n
      drawSelection()
      return eid
    },
    ensureStyleKey(eid) {
      const el = get(eid)
      if (!el || managedOf(el)) return null
      let key = [...el.classList].find((c) => /^itwd-e-[a-z0-9]{4,16}$/.test(c))
      if (!key) {
        key = 'itwd-e-' + Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x').padEnd(8, '0')
        el.classList.add(key)
      }
      return { key, global: ['header', 'footer', 'sideTab'].includes(regionOf(el)) }
    },
    setCss(pageCss, globalCss, themeCss) {
      const put = (id, css) => {
        let s = document.getElementById(id)
        if (!s) { s = document.createElement('style'); s.id = id; document.head.appendChild(s) }
        s.textContent = css
      }
      put('itwd-page-styles', pageCss)
      const gd = document.getElementById('itwd-global-draft-styles')
      if (gd) gd.textContent = ''
      put('itwd-global-live', globalCss)
      if (themeCss !== undefined) put('itwd-theme-live', themeCss)
      requestAnimationFrame(() => { drawSelection(); drawHover() })
    },
    move(eid, dir) {
      const el = get(eid)
      if (!el || managedOf(el) || isRoot(el)) return false
      const sib = dir === 'up' ? el.previousElementSibling : el.nextElementSibling
      if (!sib || !sib.dataset.itwdEid || sib === footer() || regionOf(sib) !== regionOf(el)) { toast('Cannot move further'); return false }
      // a CMS block is wrapped in <!-- itwd:x:start/end --> comments: move past the whole block, never into it
      let anchor = sib
      if (managedTop.has(sib)) {
        const name = managedTop.get(sib)
        let n = sib
        const marker = ' itwd:' + name + (dir === 'up' ? ':start ' : ':end ')
        while (n && !(n.nodeType === 8 && n.data === marker)) n = dir === 'up' ? n.previousSibling : n.nextSibling
        if (n) anchor = n
      }
      if (dir === 'up') anchor.before(el)
      else anchor.after(el)
      drawSelection()
      return true
    },
    moveTo(eid, targetEid, pos) {
      const el = get(eid)
      const t = get(targetEid)
      if (!el || !t || el.contains(t) || managedOf(el) || isRoot(el)) return false
      // next to a CMS block: stay outside its <!-- itwd:x:start/end --> markers
      let anchor = t
      if (pos !== 'inside' && managedTop.has(t)) {
        const marker = ' itwd:' + managedTop.get(t) + (pos === 'before' ? ':start ' : ':end ')
        let n = t
        while (n && !(n.nodeType === 8 && n.data === marker)) n = pos === 'before' ? n.previousSibling : n.nextSibling
        if (n) anchor = n
      }
      if (pos === 'inside') t.appendChild(el)
      else if (pos === 'before') anchor.before(el)
      else anchor.after(el)
      drawSelection()
      return true
    },
    duplicate(eid) {
      const el = get(eid)
      if (!el || managedOf(el) || isRoot(el)) return null
      const c = cleanClone(el)
      const keys = []
      for (const n of [c, ...c.querySelectorAll('[class*="itwd-e-"]')]) {
        for (const k of [...n.classList].filter((x) => /^itwd-e-[a-z0-9]{4,16}$/.test(x))) {
          const nk = 'itwd-e-' + Math.random().toString(36).slice(2, 10).replace(/[^a-z0-9]/g, 'x').padEnd(8, '0')
          n.classList.replace(k, nk)
          keys.push([k, nk])
        }
      }
      for (const n of [c, ...c.querySelectorAll('[id]')]) if (n.id) n.id = n.id + '-copy'
      el.after(c)
      assign(c)
      return { eid: c.dataset.itwdEid, keys }
    },
    remove(eid) {
      const el = get(eid)
      if (!el || managedOf(el) || isRoot(el)) return false
      if (selected && el.contains(selected)) selectEl(null)
      el.remove()
      return true
    },
    insertHTML(html, refEid, pos) {
      let ref = refEid ? get(refEid) : null
      if (ref && managedOf(ref)) return null
      const tpl = document.createElement('template')
      tpl.innerHTML = html
      const nodes = [...tpl.content.childNodes]
      const first = nodes.find((n) => n.nodeType === 1)
      if (!first) return null
      if (!ref) { // end of the page content
        const f = footer()
        f.before(...nodes)
      } else if (pos === 'inside') ref.append(...nodes)
      else if (pos === 'before') ref.before(...nodes)
      else ref.after(...nodes)
      for (const n of nodes) if (n.nodeType === 1) assign(n)
      refreshBackgrounds()
      return first.dataset.itwdEid
    },
    outerHTML(eid) {
      const el = get(eid)
      return el ? htmlOf([el]) : null
    },
    styleKeysIn(eid) {
      const el = get(eid)
      if (!el) return []
      return [el, ...el.querySelectorAll('*')].flatMap((n) => [...n.classList].filter((c) => /^itwd-e-[a-z0-9]{4,16}$/.test(c)))
    },
    serialize() {
      if (editing) finishEditing()
      const badge = document.querySelector('.itwd-pranam-tab')
      return { main: htmlOf(mainNodes()), header: htmlOf([header()]), footer: htmlOf([footer()]), sideTab: badge ? htmlOf([badge]) : '' }
    },
    load(state) {
      selectEl(null, { notify: false })
      const h = header()
      const f = footer()
      const badge = document.querySelector('.itwd-pranam-tab')
      const tpl = document.createElement('template')
      if (state.header !== undefined) { tpl.innerHTML = state.header; const n = tpl.content.firstElementChild; if (n) h.replaceWith(n) }
      if (state.footer !== undefined) { tpl.innerHTML = state.footer; const n = tpl.content.firstElementChild; if (n) f.replaceWith(n) }
      if (state.sideTab !== undefined && badge) { tpl.innerHTML = state.sideTab; const n = tpl.content.firstElementChild; if (n) badge.replaceWith(n) }
      if (state.main !== undefined) {
        for (const n of mainNodes()) n.remove()
        tpl.innerHTML = state.main
        footer().before(...tpl.content.childNodes)
      }
      byId.clear()
      assign(document.body)
      markManaged()
      refreshBackgrounds()
      ED.onSelect(null)
    },
    tree(eid) {
      const kids = (parent) => [...parent.children].filter((c) => c.dataset && c.dataset.itwdEid && !c.closest('#itwd-ed-layer'))
      let list
      if (!eid) list = [header(), ...mainNodes().filter((n) => n.nodeType === 1 && n.dataset.itwdEid), footer()]
      else { const el = get(eid); list = el && el.tagName.toLowerCase() !== 'svg' ? kids(el) : [] }
      return list.filter(Boolean).map((el) => ({
        eid: el.dataset.itwdEid, label: el === header() ? 'Header (shared)' : el === footer() ? 'Footer (shared)' : label(el),
        kind: kindOf(el), managed: managedOf(el), hasChildren: el.tagName.toLowerCase() !== 'svg' && kids(el).length > 0,
        hidden: el.offsetParent === null && getComputedStyle(el).position !== 'fixed',
      }))
    },
    overflow() {
      const w = document.documentElement.clientWidth
      const out = []
      for (const el of document.querySelectorAll('#smooth-content *')) {
        if (out.length > 8) break
        const r = el.getBoundingClientRect()
        if (r.width && r.right > w + 2 && !el.closest('.swiper, .itwd-marquee, .overflow-hidden, [style*="overflow"]') && getComputedStyle(el).position !== 'fixed') out.push(label(el))
      }
      return { width: w, scrollWidth: document.documentElement.scrollWidth, elements: out }
    },
    selectedEid: () => (selected ? selected.dataset.itwdEid : null),
  }

  assign(document.body)
  markManaged()
  refreshBackgrounds()
  window.ITWDCanvas = api
  ED.onCanvasReady(api, boot)
})()
