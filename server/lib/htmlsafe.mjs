// Security checks for content coming from the editor:
//  * HTML: an edited region may not ADD scripts, event handlers, javascript:/data: URLs, frames or other active
//    content. Anything "risky" is only accepted when an identical tag already exists in the published region
//    (the theme's own markup). New video embeds are limited to YouTube's embed URLs.
//  * CSS: element styles are a validated property/value model compiled by the server (never raw CSS from the client).
//  * Plain-text fields (CMS, page meta): no markup except a few inline formatting tags.

const RAW_TEXT_TAGS = new Set(['script', 'style', 'textarea', 'title', 'xmp'])
const RISKY_TAGS = new Set(['script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'meta', 'link',
  'style', 'portal', 'noscript', 'param'])
const URL_ATTRS = new Set(['href', 'src', 'action', 'formaction', 'xlink:href', 'data', 'poster', 'background', 'ping',
  'cite', 'longdesc', 'manifest', 'codebase', 'lowsrc', 'dynsrc'])
const YOUTUBE_EMBED = /^https:\/\/www\.(youtube-nocookie|youtube)\.com\/embed\/[A-Za-z0-9_-]{6,20}(\?[A-Za-z0-9_=&;-]*)?$/

// ---------------------------------------------------------------- tokenizer (tags + attributes, quote aware)

export function scanTags(html) {
  const tags = []
  const s = String(html)
  let i = 0
  while (i < s.length) {
    const lt = s.indexOf('<', i)
    if (lt === -1) break
    if (s.startsWith('<!--', lt)) {
      const end = s.indexOf('-->', lt + 4)
      i = end === -1 ? s.length : end + 3
      continue
    }
    const m = /^<([a-zA-Z][\w:-]*)/.exec(s.slice(lt, lt + 64))
    if (!m) {
      i = lt + 1
      continue
    }
    const name = m[1].toLowerCase()
    let j = lt + m[0].length
    const attrs = []
    while (j < s.length) {
      while (j < s.length && /[\s/]/.test(s[j])) j++
      if (s[j] === '>' || j >= s.length) break
      const an = /^[^\s=>/]+/.exec(s.slice(j, j + 256))
      if (!an) { j++; continue }
      let k = j + an[0].length
      while (k < s.length && /\s/.test(s[k])) k++
      let value = ''
      if (s[k] === '=') {
        k++
        while (k < s.length && /\s/.test(s[k])) k++
        const q = s[k]
        if (q === '"' || q === "'") {
          const e = s.indexOf(q, k + 1)
          value = s.slice(k + 1, e === -1 ? s.length : e)
          k = e === -1 ? s.length : e + 1
        } else {
          const e = /^[^\s>]*/.exec(s.slice(k))[0]
          value = e
          k += e.length
        }
      } else {
        k = j + an[0].length
      }
      attrs.push([an[0].toLowerCase(), decodeEntities(value)])
      j = k
    }
    const tagEnd = s.indexOf('>', j)
    const tag = { name, attrs, start: lt, end: tagEnd === -1 ? s.length : tagEnd + 1, text: '' }
    i = tag.end
    if (RAW_TEXT_TAGS.has(name)) {
      const close = s.toLowerCase().indexOf('</' + name, i)
      tag.text = s.slice(i, close === -1 ? s.length : close)
      i = close === -1 ? s.length : close
    }
    tags.push(tag)
  }
  return tags
}

function decodeEntities(v) {
  return v.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|colon|tab|newline);?/gi, (m, e) => {
    const l = e.toLowerCase()
    if (l === 'amp') return '&'
    if (l === 'quot') return '"'
    if (l === 'apos') return "'"
    if (l === 'lt') return '<'
    if (l === 'gt') return '>'
    if (l === 'colon') return ':'
    if (l === 'tab') return '\t'
    if (l === 'newline') return '\n'
    const code = l.startsWith('#x') ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10)
    return Number.isFinite(code) ? String.fromCodePoint(Math.min(code, 0x10ffff)) : m
  })
}

function signature(t) {
  // Match existing risky behavior by its risky attributes, not every ordinary attribute
  // on the element. Editing an anchor's label, class or destination must not make its
  // already-published legacy onclick look like a newly-added handler.
  const risky = t.attrs.filter(([k, v]) => k.startsWith('on') || k === 'srcdoc' ||
    (URL_ATTRS.has(k) && unsafeUrl(v, k)) ||
    (k === 'style' && /expression\s*\(|javascript:|behavior\s*:|-moz-binding|@import/i.test(v)) ||
    k === 'formaction' || (t.name === 'form' && k === 'action' && v && !/^(\/|https:\/\/formsubmit\.co\/)/.test(v)))
  const attrs = risky.length ? risky : t.attrs
  const text = risky.length ? '' : t.text.trim()
  return t.name + '|' + attrs.map(([k, v]) => k + '=' + v).sort().join('|') + '|' + text
}

export function unsafeUrl(value, attr) {
  const v = String(value).replace(/[\u0000- \u007f-\u009f]/g, '').toLowerCase()
  if (/^(javascript|vbscript|livescript|mocha):/.test(v)) return true
  if (v.startsWith('data:')) return !(attr === 'src' && /^data:image\/(png|jpe?g|gif|webp|avif);/.test(v))
  return false
}

function riskReason(t) {
  if (RISKY_TAGS.has(t.name)) {
    if (t.name === 'iframe') {
      const src = (t.attrs.find(([k]) => k === 'src') || [])[1] || ''
      const bad = t.attrs.some(([k]) => k.startsWith('on') || k === 'srcdoc')
      if (!bad && YOUTUBE_EMBED.test(src)) return null
      return 'iframe (only YouTube embeds are allowed)'
    }
    return '<' + t.name + '> element'
  }
  for (const [k, v] of t.attrs) {
    if (k.startsWith('on')) return 'event handler attribute "' + k + '"'
    if (k === 'srcdoc') return 'srcdoc attribute'
    if (URL_ATTRS.has(k) && unsafeUrl(v, k)) return 'unsafe URL in "' + k + '"'
    if (k === 'srcset' && /javascript:|data:(?!image\/)/i.test(v)) return 'unsafe srcset'
    if (k === 'style' && /expression\s*\(|javascript:|behavior\s*:|-moz-binding|@import/i.test(v)) return 'unsafe inline style'
    if (k === 'formaction' || (t.name === 'form' && k === 'action' && v && !/^(\/|https:\/\/formsubmit\.co\/)/.test(v))) return 'form action'
  }
  return null
}

/** Problems introduced by `next` compared with the trusted `prev` HTML of the same region. */
export function securityIssues(next, prev = '') {
  const trusted = new Map()
  for (const t of scanTags(prev)) {
    if (riskReason(t)) {
      const sig = signature(t)
      trusted.set(sig, (trusted.get(sig) || 0) + 1)
    }
  }
  const issues = []
  for (const t of scanTags(next)) {
    const reason = riskReason(t)
    if (!reason) continue
    const sig = signature(t)
    const n = trusted.get(sig) || 0
    if (n > 0) {
      trusted.set(sig, n - 1)
      continue
    }
    issues.push({ level: 'error', code: 'unsafe-html', message: 'Blocked: ' + reason + ' in <' + t.name + '>' })
  }
  return issues
}

// ---------------------------------------------------------------- URLs typed into the editor / CMS

export function validUrl(u, { allowEmpty = false } = {}) {
  const v = String(u ?? '').trim()
  if (!v) return allowEmpty
  if (v.length > 2000 || /[\s<>"`]/.test(v)) return false
  if (unsafeUrl(v, 'href')) return false
  return /^(https?:\/\/[^/\s]+|mailto:|tel:\+?[\d\s-]+$|\/|#|\.{0,2}\/)/i.test(v) || /^[\w-]+(\.html)?([#?].*)?$/.test(v)
}

// ---------------------------------------------------------------- plain text with a few inline tags (CMS fields)

const INLINE_OK = /^(\/?)(strong|b|em|i|br|small)$/i

export function inlineTextIssue(value) {
  const s = String(value ?? '')
  if (s.length > 20000) return 'too long'
  const tags = s.match(/<[^>]*>/g) || []
  for (const tag of tags) {
    const inner = tag.slice(1, -1).trim().replace(/\/$/, '').trim()
    if (!INLINE_OK.test(inner)) return 'only <strong>, <em>, <b>, <i>, <small> and <br> tags are allowed (found ' + tag.slice(0, 40) + ')'
  }
  if (/[<>]/.test(s.replace(/<[^>]*>/g, ''))) return 'stray < or > character (use &lt; / &gt;)'
  return null
}

export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// ---------------------------------------------------------------- element style model -> CSS

export const BREAKPOINTS = { desktop: null, tablet: '(max-width: 1199px)', mobile: '(max-width: 767px)' }
const STATES = { hover: ':hover', focus: ':focus-visible' }
const PROPS = new Set([
  'color', 'background-color', 'background-image', 'background-size', 'background-position', 'background-repeat',
  'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-align', 'text-transform',
  'text-decoration', 'white-space', 'word-break', 'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'gap', 'row-gap', 'column-gap', 'display', 'flex-direction', 'flex-wrap', 'justify-content', 'align-items', 'align-self',
  'order', 'grid-template-columns', 'border-width', 'border-style', 'border-color', 'border-radius', 'box-shadow', 'opacity',
  'object-fit', 'object-position', 'aspect-ratio', 'overflow', 'position', 'top', 'right', 'bottom', 'left', 'z-index',
  '-webkit-line-clamp', '-webkit-box-orient',
])
const ENUMS = {
  display: ['block', 'inline', 'inline-block', 'flex', 'inline-flex', 'grid', 'none', '-webkit-box'],
  position: ['static', 'relative'],
  overflow: ['visible', 'hidden', 'auto'],
  'border-style': ['none', 'solid', 'dashed', 'dotted', 'double'],
  'text-align': ['left', 'center', 'right', 'justify', 'start', 'end'],
  'text-transform': ['none', 'uppercase', 'lowercase', 'capitalize'],
  'flex-direction': ['row', 'row-reverse', 'column', 'column-reverse'],
  'flex-wrap': ['nowrap', 'wrap', 'wrap-reverse'],
  'object-fit': ['fill', 'contain', 'cover', 'none', 'scale-down'],
  '-webkit-box-orient': ['vertical', 'horizontal'],
}
export const STYLE_KEY = /^itwd-e-[a-z0-9]{4,16}$/

export function cleanValue(prop, raw) {
  let v = String(raw ?? '').trim().replace(/\s*!important\s*$/i, '')
  if (!v) return null
  if (v.length > 300 || /[;{}<>\\]|\/\*|@import|expression\s*\(|javascript:|behavior\s*:/i.test(v)) return undefined
  if (ENUMS[prop] && !ENUMS[prop].includes(v)) return undefined
  if (/url\(/i.test(v)) {
    if (prop !== 'background-image') return undefined
    const m = /^url\(\s*(['"]?)([^'")\s]+)\1\s*\)$/i.exec(v)
    if (!m || !/^(\/[\w\-./%@]+|https:\/\/[\w\-./%@?=&]+)$/.test(m[2])) return undefined
    v = 'url("' + m[2] + '")'
  }
  if (prop === 'z-index' && !/^-?\d{1,4}$/.test(v)) return undefined
  if (prop === 'order' && !/^-?\d{1,3}$/.test(v)) return undefined
  return v
}

/** Validate a {key: {desktop:{prop:value}, tablet, mobile, hover, focus}} model. Returns {model, issues}. */
export function cleanStyleModel(model) {
  const out = {}
  const issues = []
  if (!model || typeof model !== 'object') return { model: out, issues }
  const keys = Object.keys(model)
  if (keys.length > 5000) return { model: out, issues: [{ level: 'error', code: 'styles', message: 'Too many styled elements' }] }
  for (const key of keys) {
    if (!STYLE_KEY.test(key)) {
      issues.push({ level: 'error', code: 'style-key', message: 'Invalid style key ' + key.slice(0, 40) })
      continue
    }
    const entry = {}
    for (const bp of Object.keys(model[key] || {})) {
      if (!(bp in BREAKPOINTS) && !(bp in STATES)) {
        issues.push({ level: 'error', code: 'style-bp', message: 'Unknown breakpoint ' + bp })
        continue
      }
      const props = {}
      for (const [p, raw] of Object.entries(model[key][bp] || {})) {
        if (!PROPS.has(p)) {
          issues.push({ level: 'error', code: 'style-prop', message: 'CSS property not allowed: ' + p })
          continue
        }
        const v = cleanValue(p, raw)
        if (v === undefined) issues.push({ level: 'error', code: 'style-value', message: 'Invalid value for ' + p + ': ' + String(raw).slice(0, 60) })
        else if (v !== null) props[p] = v
      }
      if (Object.keys(props).length) entry[bp] = props
    }
    if (Object.keys(entry).length) out[key] = entry
  }
  return { model: out, issues }
}

export function compileStyles(model) {
  const decl = (props) => Object.entries(props).map(([p, v]) => '  ' + p + ': ' + v + ' !important;').join('\n')
  const base = []
  const media = { tablet: [], mobile: [] }
  for (const [key, entry] of Object.entries(model || {})) {
    if (entry.desktop) base.push('.' + key + ' {\n' + decl(entry.desktop) + '\n}')
    for (const [st, pseudo] of Object.entries(STATES)) if (entry[st]) base.push('.' + key + pseudo + ' {\n' + decl(entry[st]) + '\n}')
    for (const bp of ['tablet', 'mobile']) if (entry[bp]) media[bp].push('  .' + key + ' {\n' + decl(entry[bp]).replace(/^/gm, '  ') + '\n  }')
  }
  let css = base.join('\n')
  for (const bp of ['tablet', 'mobile']) if (media[bp].length) css += '\n@media ' + BREAKPOINTS[bp] + ' {\n' + media[bp].join('\n') + '\n}'
  return css
}
