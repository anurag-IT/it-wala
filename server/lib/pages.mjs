// Pure HTML helpers for the IT Wala Dai pages: find the editable regions (shared header, page main content, shared
// footer), page meta, the per-page editor stylesheet, and the CMS-managed blocks that must never be overwritten by a
// visual-editor draft.
import { escapeHtml } from './htmlsafe.mjs'

// blocks rendered from structured data (scripts/cms_render.py) — locked in the visual editor
export const MANAGED_BLOCKS = {
  'home-courses': 'courses', 'cpp-facts': 'courses', 'plus2-courses': 'courses',
  'home-testimonials': 'testimonials', 'testimonials-grid': 'testimonials',
  'home-faq': 'faqs', 'consult-faq': 'faqs',
  'consult-programmes': 'programmes', 'consult-colleges': 'colleges', projects: 'projects',
}
// navigation lists inside the shared header/footer (edited in CMS > Navigation)
const NAV_LISTS = [
  ['<ul id="menu-primary-menu-1" class="escul-menu">', '<template data-itwd-hidden="template-menu">'],
  ['<ul id="menu-quick-links" class="menu">', '<template data-itwd-hidden="template-footer-menu">'],
]

function matchClose(html, start, tag) {
  const re = new RegExp('<(/?)' + tag + '\\b', 'gi')
  re.lastIndex = start
  let depth = 0
  let m
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1
    if (depth === 0) {
      const gt = html.indexOf('>', m.index)
      return gt + 1
    }
  }
  return -1
}

/** {header:[s,e], main:[s,e], footer:[s,e]} character ranges, or throws if the page does not have the site layout. */
export function regionRanges(html) {
  const hs = html.indexOf('<header class="th-header')
  const he = hs === -1 ? -1 : matchClose(html, hs, 'header')
  const sc = html.indexOf('<div id="smooth-content">')
  if (hs === -1 || he === -1 || sc === -1) throw new Error('Page does not use the IT Wala Dai layout')
  const ms = sc + '<div id="smooth-content">'.length
  const fs = html.indexOf('<footer', ms)
  const fe = fs === -1 ? -1 : matchClose(html, fs, 'footer')
  if (fs === -1 || fe === -1) throw new Error('Page footer not found')
  return { header: [hs, he], main: [ms, fs], footer: [fs, fe] }
}

export function getRegions(html) {
  const r = regionRanges(html)
  return { header: html.slice(...r.header), main: html.slice(...r.main), footer: html.slice(...r.footer) }
}

export function setRegions(html, regions) {
  const r = regionRanges(html)
  // replace from the end so earlier offsets stay valid
  const order = Object.entries(r).sort((a, b) => b[1][0] - a[1][0])
  let out = html
  for (const [name, [s, e]] of order) if (typeof regions[name] === 'string') out = out.slice(0, s) + regions[name] + out.slice(e)
  return out
}

// ---------------------------------------------------------------- managed (CMS) blocks + navigation lists

export function managedBlocks(html) {
  const out = {}
  for (const name of Object.keys(MANAGED_BLOCKS)) {
    const a = '<!-- itwd:' + name + ':start -->'
    const b = '<!-- itwd:' + name + ':end -->'
    const s = html.indexOf(a)
    const e = html.indexOf(b)
    if (s !== -1 && e > s) out[name] = html.slice(s + a.length, e)
  }
  return out
}

/** Put the current (published) managed-block contents into `html` so a stale draft can never undo a CMS publish. */
export function refreshManaged(html, fromHtml) {
  const current = managedBlocks(fromHtml)
  let out = html
  for (const [name, inner] of Object.entries(current)) {
    const a = '<!-- itwd:' + name + ':start -->'
    const b = '<!-- itwd:' + name + ':end -->'
    const s = out.indexOf(a)
    const e = out.indexOf(b)
    if (s !== -1 && e > s) out = out.slice(0, s + a.length) + inner + out.slice(e)
  }
  return out
}

export function refreshNav(html, fromHtml) {
  let out = html
  for (const [open, until] of NAV_LISTS) {
    const fs = fromHtml.indexOf(open)
    const ts = out.indexOf(open)
    if (fs === -1 || ts === -1) continue
    const fe = fromHtml.indexOf(until, fs)
    const te = out.indexOf(until, ts)
    if (fe === -1 || te === -1) continue
    out = out.slice(0, ts) + fromHtml.slice(fs, fe) + out.slice(te)
  }
  return out
}

/** Main region with managed blocks blanked: what a page draft "owns" (used for conflict detection). */
export function ownedMain(html) {
  let main = getRegions(html).main
  for (const name of Object.keys(managedBlocks(main))) {
    const a = '<!-- itwd:' + name + ':start -->'
    const b = '<!-- itwd:' + name + ':end -->'
    main = main.slice(0, main.indexOf(a) + a.length) + main.slice(main.indexOf(b))
  }
  return main
}

// ---------------------------------------------------------------- meta + per-page editor stylesheet

const unescape = (s) => String(s).replace(/&#8211;/g, '–').replace(/&#8212;/g, '—').replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  .replace(/&#039;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export function getMeta(html) {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)
  const desc = /<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i.exec(html)
  return { title: title ? unescape(title[1].trim()) : '', description: desc ? unescape(desc[1]) : '' }
}

export function setMeta(html, meta) {
  let out = html
  if (typeof meta.title === 'string') {
    const t = escapeHtml(meta.title)
    out = out.replace(/<title>[\s\S]*?<\/title>/i, () => '<title>' + t + '</title>')
    out = out.replace(/(<meta\s+property=["']og:title["']\s+content=["'])[^"']*(["'])/i, (m, a, b) => a + t + b)
  }
  if (typeof meta.description === 'string') {
    const d = escapeHtml(meta.description)
    if (/<meta\s+name=["']description["']/i.test(out)) {
      out = out.replace(/(<meta\s+name=["']description["']\s+content=["'])[^"']*(["'])/i, (m, a, b) => a + d + b)
    } else {
      out = out.replace('</title>', () => '</title>\n<meta name="description" content="' + d + '" />')
    }
    out = out.replace(/(<meta\s+property=["']og:description["']\s+content=["'])[^"']*(["'])/i, (m, a, b) => a + d + b)
  }
  return out
}

const PAGE_STYLE_RE = /<style id="itwd-page-styles">[\s\S]*?<\/style>\n?/

export function setPageStyles(html, css) {
  const out = html.replace(PAGE_STYLE_RE, '')
  if (!css.trim()) return out
  const block = '<style id="itwd-page-styles">\n' + css.replace(/<\//g, '<\\/') + '\n</style>\n'
  return out.replace('</head>', () => block + '</head>')
}

export function getPageStylesCss(html) {
  const m = PAGE_STYLE_RE.exec(html)
  return m ? m[0].replace(/^<style id="itwd-page-styles">\n?/, '').replace(/\n?<\/style>\n?$/, '') : ''
}

/** Mark the active menu item of a header copied from another page. */
export function setActiveNav(headerHtml, route) {
  let out = headerHtml.replace(/ current-menu-item current_page_item/g, '').replace(/ aria-current="page"/g, '')
  const active = route.startsWith('/plus-two/') ? '/plus-two' : route
  out = out.replace(/(<li class="menu-item[^"]*?)("><a href=")([^"]*)(")/g, (m, cls, mid, href, q) =>
    href === active ? cls + ' current-menu-item current_page_item' + mid + href + q + ' aria-current="page"' : m)
  return out
}
