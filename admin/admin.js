// IT Wala Dai visual editor — admin side.
import { buildSnippets, GROUPS } from './snippets.js'

// ------------------------------------------------------------------ tiny DOM helpers (text is always set as text)
const $ = (s, r = document) => r.querySelector(s)
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v)
    else if (k === 'value') el.value = v
    else if (k === 'checked') el.checked = Boolean(v)
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const k of kids.flat(Infinity)) if (k !== null && k !== undefined && k !== false) el.append(k instanceof Node ? k : document.createTextNode(String(k)))
  return el
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms) } }
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–').replace(/&middot;/g, '·').replace(/&nbsp;/g, ' ')
const clone = (o) => JSON.parse(JSON.stringify(o))
const time = (iso) => (iso ? new Date(iso).toLocaleString() : '')

// ------------------------------------------------------------------ API client
class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data || {} }
}
let CSRF = ''
async function api(method, url, body, { raw, headers = {} } = {}) {
  const opts = { method, headers: { ...headers }, credentials: 'same-origin' }
  if (method !== 'GET') opts.headers['X-CSRF-Token'] = CSRF
  if (raw) opts.body = raw
  else if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body) }
  let res
  try { res = await fetch(url, opts) } catch { throw new ApiError(0, 'Network error — is the admin server running?') }
  let data = {}
  try { data = await res.json() } catch { /* empty */ }
  if (!res.ok) {
    const err = new ApiError(res.status, data.error || 'Request failed (' + res.status + ')', data)
    if (res.status === 401 && !url.endsWith('/login')) onSessionExpired()
    throw err
  }
  return data
}

// ------------------------------------------------------------------ state
const S = {
  user: '', pages: [], key: null, info: null, version: 0, gversion: 0, styles: {}, gstyles: {}, meta: { title: '', description: '' },
  canvas: null, boot: null, saved: null, history: [], hi: -1, changeCount: 0, dirty: false, saving: null, blocked: false,
  device: 'desktop', bp: null, sel: null, ptab: 'content', panel: 'pages', themeCss: null, clipboard: null,
  data: {}, components: [], snippets: [], expanded: new Set(), hasDraft: false,
}
const DEVICES = { desktop: 1280, tablet: 820, mobile: 390 }
const BPQ = { tablet: '(max-width: 1199px)', mobile: '(max-width: 767px)' }

// ------------------------------------------------------------------ toast + modals
function toast(msg, { error = false, html = null } = {}) {
  const t = $('#toast')
  t.replaceChildren(html || document.createTextNode(msg))
  t.className = 'toast' + (error ? ' is-err' : '')
  t.style.display = 'block'
  clearTimeout(toast.t)
  toast.t = setTimeout(() => { t.style.display = 'none' }, error ? 6000 : 3500)
}

function modal({ title, body, actions = [], wide = false, onClose }) {
  const root = $('#modalRoot')
  const prevFocus = document.activeElement
  const close = () => { wrap.remove(); document.removeEventListener('keydown', esc); if (onClose) onClose(); if (prevFocus && prevFocus.focus) prevFocus.focus() }
  const esc = (e) => { if (e.key === 'Escape') close() }
  const foot = h('div', { class: 'modal__foot' }, ...actions.map((a) => h('button', {
    type: 'button', class: 'btn ' + (a.primary ? 'btn--primary' : a.danger ? 'btn--danger' : ''), disabled: a.disabled,
    onclick: async (e) => { const r = await a.onClick?.(e, close); if (r !== false && !a.keepOpen) close() },
  }, a.label)))
  const wrap = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'modal__box' + (wide ? ' modal__box--wide' : '') },
      h('div', { class: 'modal__head' }, h('h2', { text: title }), h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Close', onclick: close }, '✕')),
      h('div', { class: 'modal__body' }, body), actions.length ? foot : null))
  wrap.addEventListener('mousedown', (e) => { if (e.target === wrap) close() })
  document.addEventListener('keydown', esc)
  root.append(wrap)
  setTimeout(() => { const f = wrap.querySelector('input, select, textarea, .modal__foot button.btn--primary'); if (f) f.focus() }, 30)
  return { close, el: wrap }
}
const confirmBox = (title, text, okLabel = 'OK', danger = false) => new Promise((resolve) => {
  modal({ title, body: h('p', { text }), onClose: () => resolve(false), actions: [
    { label: 'Cancel', onClick: () => resolve(false) },
    { label: okLabel, primary: !danger, danger, onClick: () => resolve(true) },
  ] })
})
function issuesList(issues) {
  if (!issues || !issues.length) return h('ul', { class: 'issues' }, h('li', { class: 'is-ok', text: 'No problems found.' }))
  return h('ul', { class: 'issues' }, issues.map((i) => h('li', { class: i.level === 'error' ? 'is-error' : 'is-warning' },
    (i.level === 'error' ? '✖ ' : '⚠ ') + (i.path ? i.path + ': ' : '') + i.message)))
}

// ------------------------------------------------------------------ login / session
function showLogin(message) {
  $('#boot').hidden = true
  $('#login').hidden = false
  $('#loginHint').textContent = message || 'Sign in with the admin account.'
  setTimeout(() => $('#loginUser').focus(), 30)
}
let expiredShown = false
function onSessionExpired() {
  if (!$('#app').hidden && !expiredShown) {
    expiredShown = true
    const user = h('input', { autocomplete: 'username', value: S.user })
    const pass = h('input', { type: 'password', autocomplete: 'current-password' })
    const err = h('p', { class: 'login__error' })
    modal({ title: 'Session expired', onClose: () => { expiredShown = false },
      body: h('div', {}, h('p', { text: 'Log in again to keep working — your unsaved changes are still here.' }), h('label', { text: 'Username' }), user, h('label', { text: 'Password' }), pass, err),
      actions: [{ label: 'Log in', primary: true, keepOpen: true, onClick: async (e, close) => {
        try {
          const r = await api('POST', '/api/login', { username: user.value, password: pass.value })
          CSRF = r.csrf
          close()
          toast('Logged in again.')
          if (S.dirty) save()
        } catch (x) { err.textContent = x.message }
      } }] })
  }
}

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault()
  $('#loginError').textContent = ''
  try {
    const r = await api('POST', '/api/login', { username: $('#loginUser').value.trim(), password: $('#loginPass').value })
    CSRF = r.csrf
    S.user = r.username
    $('#loginPass').value = ''
    startApp()
  } catch (x) { $('#loginError').textContent = x.message }
})

async function init() {
  try {
    const s = await api('GET', '/api/session')
    CSRF = s.csrf
    S.user = s.username
    startApp()
  } catch (e) {
    showLogin(e.data && e.data.configured === false ? 'No admin account yet. Run "npm run admin:set-password" on the server first.' : '')
  }
}

// ------------------------------------------------------------------ app start
async function startApp() {
  $('#boot').hidden = true
  $('#login').hidden = true
  $('#app').hidden = false
  addDrawerButtons()
  await Promise.all([loadPages(), loadLibraryData()])
  showPanel('pages')
  renderProps()
  const wanted = new URLSearchParams(location.hash.slice(1)).get('page')
  const first = S.pages.find((p) => p.key === wanted) || S.pages.find((p) => p.route === '/')
  if (first) openPage(first.key)
}

function addDrawerButtons() {
  if ($('.drawer-btns')) return
  const app = $('#app')
  const box = h('div', { class: 'drawer-btns' },
    h('button', { type: 'button', class: 'ibtn', title: 'Structure panel', 'aria-label': 'Toggle structure panel', onclick: () => { app.classList.toggle('show-left'); app.classList.remove('show-right') } }, '☰'),
    h('button', { type: 'button', class: 'ibtn', title: 'Properties panel', 'aria-label': 'Toggle properties panel', onclick: () => { app.classList.toggle('show-right'); app.classList.remove('show-left') } }, '⚙'))
  $('.topbar').prepend(box)
}

async function loadPages() {
  const r = await api('GET', '/api/pages')
  S.pages = r.pages
  const sel = $('#pageSelect')
  sel.replaceChildren(...S.pages.map((p) => h('option', { value: p.key, text: (p.route === '/' ? 'Home' : p.route) + (p.hasDraft ? '  •draft' : '') + (p.status === 'unpublished' ? '  (unpublished)' : '') })))
  if (S.key) sel.value = S.key
}

async function loadLibraryData() {
  try {
    const [courses, projects, colleges, comps] = await Promise.all([
      api('GET', '/api/data/courses'), api('GET', '/api/data/projects'), api('GET', '/api/data/colleges'), api('GET', '/api/components')])
    S.data = { courses: courses.published, projects: projects.published, colleges: colleges.published, components: comps.components }
  } catch { S.data = {} }
  S.snippets = buildSnippets(S.data)
}

// ------------------------------------------------------------------ open a page in the canvas
async function openPage(key) {
  if (S.key && S.key !== key && S.dirty) {
    const ok = await save()
    if (!ok && !(await confirmBox('Unsaved changes', 'Saving failed. Leave this page and lose the unsaved changes?', 'Leave page', true))) {
      $('#pageSelect').value = S.key
      return
    }
  }
  const st = await api('GET', '/api/pages/' + encodeURIComponent(key))
  Object.assign(S, {
    key, info: st.info, version: st.version, gversion: st.global.version, styles: st.styles || {}, gstyles: st.global.styles || {},
    meta: st.meta, canvas: null, sel: null, history: [], hi: -1, dirty: false, blocked: false, hasDraft: st.version > 0 || st.global.hasDraft,
  })
  S.expanded.clear()
  history.replaceState(null, '', '#page=' + encodeURIComponent(key))
  $('#pageSelect').value = key
  $('#stageEmpty').hidden = false
  $('#stageEmpty').textContent = 'Loading ' + (st.info.route === '/' ? 'Home' : st.info.route) + '…'
  setStatus()
  renderProps()
  $('#canvas').src = '/__admin/render/' + encodeURIComponent(key) + '?mode=edit&t=' + Date.now()
  if (S.panel === 'pages') renderPagesPanel()
}

// called by canvas.js inside the iframe
window.ITWDEditor = {
  onCanvasReady(canvas, boot) {
    S.canvas = canvas
    S.boot = boot
    $('#stageEmpty').hidden = true
    applyCss()
    const snap = snapshot()
    S.saved = { ...snap }
    S.history = [snap]
    S.hi = 0
    updateHistoryButtons()
    setStatus()
    if (!S.sel) renderProps()
    if (S.panel === 'layers') renderLayers()
    layoutFrame()
    if (S.info.managedPage) toast('This course page is generated from Content › Courses. Header/footer can be edited here; the page body is managed in Content.')
  },
  onSelect(info) {
    S.sel = info
    renderProps()
    if (S.panel === 'layers') markLayerSelection()
    if (info && window.innerWidth <= 1080) $('#app').classList.add('show-right')
  },
  changed: (label, extra) => commit(label, extra),
  undo: () => undo(),
  redo: () => redo(),
  saveNow: () => save(),
  requestDelete: (eid) => deleteElement(eid),
  insertSnippetAt: (id, refEid, pos) => insertSnippet(id, refEid, pos),
  copyElement: (eid) => copyElement(eid),
  pasteElement: (eid) => pasteElement(eid),
}

// ------------------------------------------------------------------ styles model -> CSS (same format as the server)
function compileStyles(model) {
  const decl = (props) => Object.entries(props).map(([p, v]) => '  ' + p + ': ' + v + ' !important;').join('\n')
  const base = []
  const media = { tablet: [], mobile: [] }
  for (const [key, e] of Object.entries(model || {})) {
    if (e.desktop) base.push('.' + key + ' {\n' + decl(e.desktop) + '\n}')
    if (e.hover) base.push('.' + key + ':hover {\n' + decl(e.hover) + '\n}')
    if (e.focus) base.push('.' + key + ':focus-visible {\n' + decl(e.focus) + '\n}')
    for (const bp of ['tablet', 'mobile']) if (e[bp]) media[bp].push('  .' + key + ' {\n' + decl(e[bp]).replace(/^/gm, '  ') + '\n  }')
  }
  let css = base.join('\n')
  for (const bp of ['tablet', 'mobile']) if (media[bp].length) css += '\n@media ' + BPQ[bp] + ' {\n' + media[bp].join('\n') + '\n}'
  return css
}
function applyCss() {
  if (S.canvas) S.canvas.setCss(compileStyles(S.styles), compileStyles(S.gstyles), S.themeCss === null ? undefined : S.themeCss)
}

// ------------------------------------------------------------------ history (undo / redo)
function snapshot() {
  const r = S.canvas.serialize()
  return { ...r, styles: JSON.stringify(S.styles), gstyles: JSON.stringify(S.gstyles), meta: JSON.stringify(S.meta) }
}
function commit(label, extra) {
  if (!S.canvas) return
  if (extra && extra.keys) {
    for (const [from, to] of extra.keys) {
      for (const m of [S.styles, S.gstyles]) if (m[from]) m[to] = clone(m[from])
    }
    applyCss()
  }
  S.history = S.history.slice(0, S.hi + 1)
  S.history.push(snapshot())
  if (S.history.length > 80) S.history.shift()
  S.hi = S.history.length - 1
  S.changeCount++
  S.blocked = false
  setDirty(true)
  updateHistoryButtons()
  scheduleSave()
  if (S.panel === 'layers') renderLayers()
  refreshSelection()
  void label
}
function restore(snap) {
  S.styles = JSON.parse(snap.styles)
  S.gstyles = JSON.parse(snap.gstyles)
  S.meta = JSON.parse(snap.meta)
  S.canvas.load({ main: snap.main, header: snap.header, footer: snap.footer })
  applyCss()
  S.changeCount++
  setDirty(true)
  updateHistoryButtons()
  scheduleSave()
  if (S.panel === 'layers') renderLayers()
}
function undo() { if (S.hi > 0) { S.hi--; restore(S.history[S.hi]); toast('Undone') } }
function redo() { if (S.hi < S.history.length - 1) { S.hi++; restore(S.history[S.hi]); toast('Redone') } }
function updateHistoryButtons() {
  $('#undoBtn').disabled = S.hi <= 0
  $('#redoBtn').disabled = S.hi >= S.history.length - 1
}
$('#undoBtn').addEventListener('click', undo)
$('#redoBtn').addEventListener('click', redo)

function refreshSelection() {
  if (!S.sel || !S.canvas) return
  const i = S.canvas.info(S.sel.eid)
  S.sel = i
  if (i) renderProps({ keepFocus: true })
  else renderProps()
}

// ------------------------------------------------------------------ save (autosave + manual)
const scheduleSave = debounce(() => { if (S.dirty && !S.blocked) save() }, 2500)
function setDirty(v) { S.dirty = v; setStatus() }
function setStatus(state, extra) {
  const el = $('#status')
  el.className = 'topbar__status'
  el.replaceChildren()
  if (state === 'saving') { el.textContent = 'Saving…'; return }
  if (state === 'error') {
    el.classList.add('is-err')
    el.append('Save failed', h('button', { type: 'button', class: 'btn btn--sm', onclick: () => save() }, 'Retry'))
    return
  }
  if (S.dirty) { el.classList.add('is-dirty'); el.textContent = '● Unsaved changes'; return }
  if (state === 'saved') { el.classList.add('is-ok'); el.textContent = '✓ Draft saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); return }
  el.textContent = S.hasDraft ? 'Draft (not published yet)' : S.key ? 'No changes — matches the live site' : '—'
  void extra
}

async function save() {
  if (!S.canvas) return true
  if (S.saving) { await S.saving; return S.dirty ? save() : true }
  const run = (async () => {
    const snap = snapshot()
    const counter = S.changeCount
    const sv = S.saved
    const pageChanged = snap.main !== sv.main || snap.styles !== sv.styles || snap.meta !== sv.meta
    const globalChanged = snap.header !== sv.header || snap.footer !== sv.footer || snap.gstyles !== sv.gstyles
    if (!pageChanged && !globalChanged) { setDirty(false); return true }
    setStatus('saving')
    try {
      if (pageChanged) {
        const r = await api('PUT', '/api/pages/' + encodeURIComponent(S.key) + '/draft', { version: S.version, main: snap.main, meta: JSON.parse(snap.meta), styles: JSON.parse(snap.styles) })
        S.version = r.version
        Object.assign(S.saved, { main: snap.main, styles: snap.styles, meta: snap.meta })
      }
      if (globalChanged) {
        const r = await api('PUT', '/api/global/draft', { version: S.gversion, header: snap.header, footer: snap.footer, styles: JSON.parse(snap.gstyles) })
        S.gversion = r.version
        Object.assign(S.saved, { header: snap.header, footer: snap.footer, gstyles: snap.gstyles })
      }
      S.hasDraft = true
      S.dirty = S.changeCount !== counter
      setStatus('saved')
      if (S.dirty) scheduleSave()
      markPageDraft()
      return true
    } catch (e) {
      setStatus('error')
      if (e.status === 409) conflictDialog(e)
      else if (e.status === 422) {
        S.blocked = true
        modal({ title: 'This change cannot be saved', body: h('div', {}, h('p', { text: e.message }), issuesList(e.data.issues)), actions: [{ label: 'Undo last change', onClick: () => undo() }, { label: 'OK', primary: true }] })
      } else if (e.status !== 401) toast(e.message, { error: true })
      return false
    }
  })()
  S.saving = run
  try { return await run } finally { S.saving = null }
}
function conflictDialog(e) {
  S.blocked = true
  modal({
    title: 'Newer draft found',
    body: h('p', { text: 'This draft was saved somewhere else (another tab or another admin) after you opened it. Choose which version to keep.' }),
    actions: [
      { label: 'Load the newer draft', onClick: () => { S.dirty = false; openPage(S.key) } },
      { label: 'Keep my version', primary: true, onClick: async () => {
        const st = await api('GET', '/api/pages/' + encodeURIComponent(S.key))
        S.version = st.version
        S.gversion = st.global.version
        S.saved = { main: null, header: null, footer: null, styles: null, gstyles: null, meta: null }
        S.blocked = false
        save()
      } },
    ],
  })
}
function markPageDraft() {
  const p = S.pages.find((x) => x.key === S.key)
  if (p && !p.hasDraft) { p.hasDraft = true; loadPages(); if (S.panel === 'pages') renderPagesPanel() }
}
$('#saveBtn').addEventListener('click', async () => { if (await save()) toast('Draft saved — the live site is unchanged until you publish.') })
window.addEventListener('beforeunload', (e) => { if (S.dirty || S.saving) { e.preventDefault(); e.returnValue = '' } })
document.addEventListener('keydown', (e) => {
  const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); save(); return }
  if (inField) return
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo() }
  else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
})

// ------------------------------------------------------------------ device preview + frame sizing
function layoutFrame() {
  const stage = $('#stage')
  const wrap = $('#frameWrap')
  const w = DEVICES[S.device]
  const avail = stage.clientWidth - 32
  const scale = Math.min(1, avail / w)
  const height = (stage.clientHeight - 32) / scale
  wrap.style.width = w + 'px'
  wrap.style.height = height + 'px'
  wrap.style.transform = scale < 1 ? 'scale(' + scale + ')' : ''
  wrap.style.marginBottom = scale < 1 ? -(height * (1 - scale)) + 'px' : ''
  $('#vpSize').textContent = w + ' × ' + Math.round(height) + (scale < 1 ? ' (' + Math.round(scale * 100) + '%)' : '')
  if (S.canvas) setTimeout(() => S.canvas.redraw(), 50)
}
new ResizeObserver(layoutFrame).observe($('#stage'))
for (const b of document.querySelectorAll('[data-device]')) {
  b.addEventListener('click', () => {
    S.device = b.dataset.device
    S.bp = null
    for (const x of document.querySelectorAll('[data-device]')) x.classList.toggle('is-active', x === b)
    layoutFrame()
    renderProps({ keepFocus: true })
  })
}
const currentBp = () => S.bp || S.device

// ------------------------------------------------------------------ left panels
for (const b of document.querySelectorAll('.ltabs button')) b.addEventListener('click', () => showPanel(b.dataset.panel))
function showPanel(name) {
  S.panel = name
  for (const b of document.querySelectorAll('.ltabs button')) {
    b.classList.toggle('is-active', b.dataset.panel === name)
    b.setAttribute('aria-selected', b.dataset.panel === name ? 'true' : 'false')
  }
  ;({ pages: renderPagesPanel, layers: renderLayers, add: renderAddPanel, media: renderMediaPanel, content: renderContentPanel, theme: renderThemePanel })[name]()
}
const panel = () => $('#leftPanel')

function renderPagesPanel() {
  panel().replaceChildren(
    h('div', { class: 'ph' }, h('h2', { text: 'Pages' }), h('span', { class: 'muted', text: S.pages.length + ' pages' })),
    h('ul', { class: 'list' }, S.pages.map((p) => h('li', { class: 'page-item' + (p.key === S.key ? ' is-current' : '') },
      h('div', { class: 'page-item__top' },
        h('span', { class: 'page-item__title', text: plain(p.title).split(' – ')[0] || p.route }),
        p.hasDraft ? h('span', { class: 'badge badge--draft', text: 'draft' }) : null,
        p.status === 'unpublished' ? h('span', { class: 'badge badge--off', text: 'unpublished' }) : null,
        p.managedPage ? h('span', { class: 'badge badge--lock', title: 'Body generated from Content › Courses', text: 'CMS' }) : null),
      h('div', { class: 'page-item__route', text: p.route + ' · changed ' + time(p.lastModified) }),
      h('div', { class: 'page-item__actions' },
        h('button', { type: 'button', class: 'btn btn--sm', onclick: () => openPage(p.key) }, 'Edit'),
        p.status === 'published' ? h('a', { class: 'btn btn--sm', href: p.route, target: '_blank', rel: 'noopener' }, 'View live') : null,
        h('button', { type: 'button', class: 'btn btn--sm', onclick: () => revisionsDialog(p) }, 'History'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: () => duplicateDialog(p) }, 'Duplicate'),
        p.createdInAdmin ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => togglePublished(p) }, p.status === 'published' ? 'Unpublish' : 'Publish page') : null)))),
    h('p', { class: 'muted' }, 'Existing site pages are protected (they cannot be deleted or unpublished here). Duplicate a page to create a new one.'))
}
$('#pageSelect').addEventListener('change', (e) => openPage(e.target.value))

// layers
function renderLayers() {
  if (!S.canvas) { panel().replaceChildren(h('p', { class: 'muted', text: 'Open a page first.' })); return }
  const build = (nodes) => h('ul', {}, nodes.map((n) => {
    const li = h('li', {})
    const open = S.expanded.has(n.eid)
    const row = h('div', { class: 'tree__row' + (n.hidden ? ' is-hidden' : '') + (S.sel && S.sel.eid === n.eid ? ' is-sel' : ''), 'data-eid': n.eid, role: 'treeitem', tabindex: '0',
      onclick: () => { S.canvas.select(n.eid, { scroll: true }) },
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); S.canvas.select(n.eid, { scroll: true }) } },
      onmouseenter: () => S.canvas.hover(n.eid), onmouseleave: () => S.canvas.hover(null) },
    n.hasChildren ? h('button', { type: 'button', class: 'tree__tog', 'aria-label': open ? 'Collapse' : 'Expand', 'aria-expanded': open ? 'true' : 'false',
      onclick: (e) => { e.stopPropagation(); open ? S.expanded.delete(n.eid) : S.expanded.add(n.eid); renderLayers() } }, open ? '▾' : '▸') : h('span', { class: 'tree__tog' }),
    h('span', { class: 'tree__label', text: n.label }),
    n.managed ? h('span', { class: 'badge badge--lock', title: 'Edited in Content', text: '🔒' }) : null)
    li.append(row)
    if (n.hasChildren && open) li.append(build(S.canvas.tree(n.eid)))
    return li
  }))
  const tree = build(S.canvas.tree(null))
  tree.className = 'tree'
  tree.setAttribute('role', 'tree')
  panel().replaceChildren(h('div', { class: 'ph' }, h('h2', { text: 'Layers' }), h('span', { class: 'muted', text: 'Click to select' })), tree,
    h('p', { class: 'muted' }, '🔒 = filled from Content (courses, testimonials, FAQ…). Header and footer are shared by every page.'))
}
function markLayerSelection() {
  for (const r of panel().querySelectorAll('.tree__row')) r.classList.toggle('is-sel', Boolean(S.sel) && r.dataset.eid === S.sel.eid)
  if (S.sel && !panel().querySelector('.tree__row.is-sel')) {
    // expand the path to the selected element
    for (const c of S.sel.crumbs || []) S.expanded.add(c.eid)
    renderLayers()
  }
  const cur = panel().querySelector('.tree__row.is-sel')
  if (cur) cur.scrollIntoView({ block: 'nearest' })
}

// add elements
function renderAddPanel() {
  const search = h('input', { type: 'search', class: 'lib-search', placeholder: 'Search elements…', 'aria-label': 'Search elements' })
  const list = h('div', {})
  const draw = () => {
    const q = search.value.trim().toLowerCase()
    list.replaceChildren(...GROUPS.flatMap((g) => {
      const items = S.snippets.filter((s) => s.group === g && (!q || s.label.toLowerCase().includes(q)))
      if (!items.length) return []
      return [h('div', { class: 'lib-group', text: g }), h('div', { class: 'lib' }, items.map((s) => {
        const b = h('button', { type: 'button', class: 'lib__item' + (s.group !== 'Basic' && s.group !== 'Layout' ? ' lib__item--wide' : ''), draggable: 'true',
          title: (s.note ? s.note + ' — ' : '') + 'Drag onto the page, or click to insert after the selected element',
          onclick: () => insertSnippet(s.id, null, 'after') },
        h('span', { class: 'lib__icon', 'aria-hidden': 'true', text: s.icon }), h('span', { text: s.label }))
        b.addEventListener('dragstart', (e) => { e.dataTransfer.setData('application/x-itwd-snippet', s.id); e.dataTransfer.effectAllowed = 'copy' })
        if (s.componentId) {
          b.addEventListener('contextmenu', async (e) => {
            e.preventDefault()
            if (await confirmBox('Delete saved section', 'Remove "' + s.label + '" from saved sections? Pages that already use it keep their copy.', 'Delete', true)) {
              await api('DELETE', '/api/components/' + s.componentId)
              await loadLibraryData()
              renderAddPanel()
            }
          })
        }
        return b
      }))]
    }))
  }
  search.addEventListener('input', draw)
  draw()
  panel().replaceChildren(h('div', { class: 'ph' }, h('h2', { text: 'Add elements' })), search, list,
    h('p', { class: 'muted' }, 'Drag an element onto the page (yellow line = drop position), or select an element and click to insert after it. Right-click a saved section to delete it.'))
}

function insertSnippet(id, refEid, pos) {
  if (!S.canvas) return
  const sn = S.snippets.find((s) => s.id === id)
  if (!sn) return
  let ref = refEid
  if (!ref && S.sel && S.sel.region === 'main' && !S.sel.managed) ref = S.sel.eid
  let html = sn.html()
  html = html.replace(/itwd-e-[a-z0-9]{4,16}/g, () => 'itwd-e-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0'))
  const eid = S.canvas.insertHTML(html, ref, pos)
  if (!eid) { toast('Cannot insert there (CMS-managed content).', { error: true }); return }
  commit('Add ' + sn.label)
  S.canvas.select(eid, { scroll: true })
  toast(sn.label + ' added' + (sn.note ? ' — ' + sn.note : ''))
}

async function deleteElement(eid) {
  const i = S.canvas.info(eid)
  if (!i || !i.canDelete) { toast('This element cannot be deleted here.', { error: true }); return }
  if (!(await confirmBox('Delete element', 'Delete "' + i.label + '"? You can undo this with Ctrl+Z.', 'Delete', true))) return
  S.canvas.remove(eid)
  commit('Delete element')
}
function copyElement(eid) {
  const html = S.canvas.outerHTML(eid)
  if (!html) return
  const keys = S.canvas.styleKeysIn(eid)
  S.clipboard = { html, styles: Object.fromEntries(keys.filter((k) => S.styles[k] || S.gstyles[k]).map((k) => [k, clone(S.styles[k] || S.gstyles[k])])) }
  toast('Element copied — select an element and press Ctrl+V to paste after it.')
}
function pasteElement(eid) {
  if (!S.clipboard) return
  const map = {}
  const html = S.clipboard.html.replace(/itwd-e-[a-z0-9]{4,16}/g, (k) => (map[k] = map[k] || 'itwd-e-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0')))
  const target = S.canvas.info(eid)
  const newEid = S.canvas.insertHTML(html, eid, 'after')
  if (!newEid) return
  const model = target && target.global ? S.gstyles : S.styles
  for (const [k, v] of Object.entries(S.clipboard.styles)) if (map[k]) model[map[k]] = clone(v)
  applyCss()
  commit('Paste element')
  S.canvas.select(newEid)
}

// ------------------------------------------------------------------ properties panel
function renderProps({ keepFocus = false } = {}) {
  const box = $('#props')
  if (keepFocus && box.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return
  const i = S.sel
  if (!i) {
    box.replaceChildren(h('div', { class: 'props-empty' },
      h('h2', { text: 'Properties' }),
      h('p', { text: S.canvas ? 'Click any element on the page to edit it. Double-click text to type directly on the page.' : 'Open a page to start.' }),
      S.canvas ? h('ul', { class: 'muted' }, h('li', { text: 'Drag ⠿ in the element toolbar to move it' }), h('li', { text: 'Alt+↑/↓ moves the selected element' }),
        h('li', { text: 'Del deletes, Ctrl+D duplicates, Ctrl+Z / Ctrl+Y undo/redo' }), h('li', { text: 'Ctrl+S saves the draft' })) : null))
    return
  }
  const head = h('div', { class: 'props-head' },
    h('h2', { text: i.label }),
    h('div', { class: 'crumbs' }, i.crumbs.map((c, n) => [n ? h('span', { class: 'muted', text: '›' }) : null, h('button', { type: 'button', title: c.label, onclick: () => S.canvas.select(c.eid) }, c.label)])),
    h('div', { class: 'ptabs', role: 'tablist' }, ['content', 'style', 'advanced'].map((t) => h('button', { type: 'button', role: 'tab', class: S.ptab === t ? 'is-active' : '', 'aria-selected': S.ptab === t ? 'true' : 'false',
      onclick: () => { S.ptab = t; renderProps() } }, t[0].toUpperCase() + t.slice(1)))))
  const body = h('div', { class: 'pbody' })
  if (i.managed) {
    const type = i.managed === 'course page' ? 'courses' : i.managed
    body.append(h('div', { class: 'notice notice--lock' }, '🔒 This content is filled from Content › ' + type + '. Edit it there so every page that shows it stays in sync.',
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => cmsEditor(type) }, 'Open in Content'))))
  } else if (i.global) {
    body.append(h('div', { class: 'notice notice--global' }, '◆ Shared ' + i.region + ': changes apply to every page when you publish the shared header/footer (you will be asked to confirm).'))
  }
  if (!i.managed) {
    if (S.ptab === 'content') contentTab(i, body)
    else if (S.ptab === 'style') styleTab(i, body)
    else advancedTab(i, body)
  }
  box.replaceChildren(head, body)
}

function field(labelText, control, hint) {
  return h('div', {}, h('label', { text: labelText }), control, hint ? h('div', { class: 'muted', text: hint }) : null)
}
function routeOptions() {
  return S.pages.filter((p) => p.status === 'published').map((p) => ({ value: p.route, label: (p.route === '/' ? 'Home' : plain(p.title).split(' – ')[0]) + '  (' + p.route + ')' }))
}
function linkEditor(eid, attrs, { title = 'Link' } = {}) {
  const href = attrs.href || ''
  const sel = h('select', { 'aria-label': title + ' destination' },
    h('option', { value: '', text: 'Custom URL…' }), routeOptions().map((o) => h('option', { value: o.value, text: o.label })))
  const known = routeOptions().some((o) => o.value === href)
  sel.value = known ? href : ''
  const url = h('input', { type: 'text', value: href, placeholder: 'https://…, /page, #section, mailto:, tel:', 'aria-label': 'URL' })
  const err = h('div', { class: 'field-error' })
  const newTab = h('input', { type: 'checkbox', checked: attrs.target === '_blank' })
  const apply = (v) => {
    const val = v.trim()
    if (val && !/^(https?:\/\/[^\s<>"]+|\/[^\s<>"]*|#[\w-]*|mailto:[^\s<>"]+|tel:[+\d\s-]+)$/i.test(val)) { err.textContent = 'Use a full https:// address, a /page path, #section, mailto: or tel:'; return }
    if (val.startsWith('/') && !val.startsWith('//')) {
      const path = val.split('#')[0].split('?')[0].replace(/\/$/, '') || '/'
      const ok = S.pages.some((p) => p.route === path) || /\.(\w{2,5})$/.test(path)
      err.textContent = ok ? '' : '⚠ No page found at ' + path + ' — publishing will be blocked until it exists.'
    } else err.textContent = ''
    S.canvas.setAttr(eid, 'href', val || null)
    commit('Change link')
  }
  sel.addEventListener('change', () => { if (sel.value) { url.value = sel.value; apply(sel.value) } else url.focus() })
  url.addEventListener('change', () => apply(url.value))
  newTab.addEventListener('change', () => {
    S.canvas.setAttr(eid, 'target', newTab.checked ? '_blank' : null)
    S.canvas.setAttr(eid, 'rel', newTab.checked ? 'noopener' : null)
    commit('Link target')
  })
  return h('div', {}, field(title, sel), url, err, h('label', { class: 'check' }, newTab, 'Open in a new tab'))
}

const BTN_VARIANTS = [['', 'Primary (dark)'], ['style2', 'Light'], ['style3', 'Style 3'], ['style5', 'Style 5'], ['style-border', 'Outline'], ['style-border2', 'Outline green'], ['style-border3', 'Outline white']]

function contentTab(i, body) {
  const eid = i.eid
  if (['heading', 'text'].includes(i.kind)) {
    if (i.textEditable && !i.hasChildren) {
      const ta = h('textarea', { rows: 3, value: i.text, 'aria-label': 'Text' })
      ta.addEventListener('input', () => S.canvas.setText(eid, ta.value))
      ta.addEventListener('change', () => commit('Edit text'))
      body.append(field('Text', ta, 'Tip: double-click the text on the page to type there (Ctrl+B / Ctrl+I for bold / italic).'))
    } else body.append(h('div', { class: 'notice' }, 'Double-click this text on the page to edit it (it contains formatting).'))
    if (/^(h[1-6]|p)$/.test(i.tag)) {
      const lvl = h('select', { 'aria-label': 'Tag' }, ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p'].map((t) => h('option', { value: t, text: t === 'p' ? 'Paragraph' : 'Heading ' + t.slice(1) })))
      lvl.value = i.tag
      lvl.addEventListener('change', () => { S.canvas.setTag(eid, lvl.value); commit('Heading level') })
      body.append(field('Heading level', lvl, 'Use one H1 per page; sections use H2, cards H3.'))
    }
  }
  if (i.kind === 'button' || i.kind === 'link') {
    const t = h('input', { type: 'text', value: i.text, 'aria-label': 'Button text' })
    t.addEventListener('input', () => S.canvas.setText(eid, t.value))
    t.addEventListener('change', () => commit('Button text'))
    body.append(field(i.kind === 'button' ? 'Button text' : 'Link text', t))
    const a = i.action
    if (a.enquiry) body.append(h('div', { class: 'notice notice--info' }, 'This button opens the ' + (a.kind === 'course' ? 'course' : 'project-guidance') + ' enquiry form → WhatsApp' + (a.project ? ' for "' + a.project + '"' : '') + '. Changing its text, style or position keeps that action.'))
    if (a.join) body.append(h('div', { class: 'notice notice--info' }, 'This button opens the Join Now form → WhatsApp. Its action is kept when you restyle it.'))
    if (a.app) body.append(h('div', { class: 'notice notice--info' }, 'App download button (' + a.app + '). The store link is set in assets/itwd/itwd.js (APP_LINKS); until then it asks Dai on WhatsApp.'))
    if (a.whatsapp) body.append(h('div', { class: 'notice notice--info' }, 'WhatsApp link: changing the URL changes the chat and pre-filled message.'))
    if (i.tag === 'a' && !a.enquiry && !a.app) body.append(linkEditor(eid, i.attrs, { title: 'Destination' }))
    if (/\bth-btn\b/.test(i.attrs.class || '')) {
      const cls = (i.attrs.class || '').split(/\s+/)
      const v = h('select', { 'aria-label': 'Button style' }, BTN_VARIANTS.map(([c, l]) => h('option', { value: c, text: l })))
      v.value = (BTN_VARIANTS.find(([c]) => c && cls.includes(c)) || [''])[0]
      v.addEventListener('change', () => { for (const [c] of BTN_VARIANTS) if (c) S.canvas.setClass(eid, c, c === v.value); commit('Button style') })
      const small = h('input', { type: 'checkbox', checked: cls.includes('btn-sm') })
      small.addEventListener('change', () => { S.canvas.setClass(eid, 'btn-sm', small.checked); commit('Button size') })
      const full = h('input', { type: 'checkbox', checked: cls.includes('w-100') })
      full.addEventListener('change', () => { S.canvas.setClass(eid, 'w-100', full.checked); commit('Button width') })
      body.append(field('Style', v), h('label', { class: 'check' }, small, 'Small'), h('label', { class: 'check' }, full, 'Full width'))
    }
    if (i.iconClass) body.append(iconField(eid, i.iconClass, 'Button icon'))
  }
  if (i.kind === 'image') {
    const img = h('img', { class: 'thumb', src: i.attrs.src || '', alt: '' })
    const alt = h('input', { type: 'text', value: i.attrs.alt || '', 'aria-label': 'Alt text' })
    alt.addEventListener('change', () => { S.canvas.setAttr(eid, 'alt', alt.value.trim()); commit('Alt text') })
    const loading = h('select', { 'aria-label': 'Loading' }, h('option', { value: '', text: 'Browser default (eager)' }), h('option', { value: 'lazy', text: 'Lazy (below the fold)' }), h('option', { value: 'eager', text: 'Eager (top of page)' }))
    loading.value = i.attrs.loading || ''
    loading.addEventListener('change', () => { S.canvas.setAttr(eid, 'loading', loading.value || null); commit('Image loading') })
    body.append(img, h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--primary btn--sm', onclick: () => mediaDialog({ pick: (m) => {
        S.canvas.setAttr(eid, 'src', m.url)
        S.canvas.setAttr(eid, 'srcset', null)
        if (m.width && m.height) { S.canvas.setAttr(eid, 'width', m.width); S.canvas.setAttr(eid, 'height', m.height) }
        if (m.alt && !alt.value) S.canvas.setAttr(eid, 'alt', m.alt)
        commit('Replace image')
        toast('Image replaced')
      } }) }, 'Replace image…')),
    field('Alt text (describe the image)', alt), field('Loading', loading),
    h('div', { class: 'muted', text: 'Size, fit, crop position and rounded corners: Style tab.' }))
    if (i.linkParent) {
      const parent = S.canvas.info(i.linkParent)
      if (parent && !parent.managed) body.append(h('div', { class: 'pgroup' }, linkEditor(i.linkParent, parent.attrs, { title: 'Image link' })))
    }
  }
  if (i.kind === 'icon' && i.tag === 'i') body.append(iconField(eid, i.iconClass, 'Icon'))
  if (i.kind === 'video' || (i.attrs.class || '').includes('itwd-embed')) {
    const u = h('input', { type: 'text', placeholder: 'https://www.youtube.com/watch?v=…', 'aria-label': 'YouTube URL' })
    const err = h('div', { class: 'field-error' })
    u.addEventListener('change', () => {
      const m = /(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{6,20})/.exec(u.value)
      if (!m) { err.textContent = 'Paste a YouTube video link'; return }
      err.textContent = ''
      const target = i.tag === 'iframe' && i.parentEid ? i.parentEid : eid
      const newEid = S.canvas.insertHTML('<div class="itwd-embed"><iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '" title="YouTube video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>', target, 'after')
      S.canvas.remove(target)
      commit('Video')
      S.canvas.select(newEid)
    })
    body.append(field('YouTube video', u, 'Only YouTube embeds are allowed (privacy-friendly youtube-nocookie.com).'), err)
  }
  if (['section', 'container', 'form', 'divider'].includes(i.kind) || i.kind === 'icon') {
    body.append(h('div', { class: 'muted', text: 'Use the Style tab for background, spacing, layout and visibility. Drag elements from Add into this ' + i.kind + '.' }))
  }
  const acts = h('div', { class: 'actions' },
    i.canMove ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { const r = S.canvas.duplicate(eid); if (r) { commit('Duplicate', r); S.canvas.select(r.eid) } } }, 'Duplicate') : null,
    i.canDelete ? h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => deleteElement(eid) }, 'Delete') : null,
    ['section', 'container'].includes(i.kind) && i.region === 'main' ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => saveComponent(eid) }, 'Save as reusable section') : null)
  body.append(acts)
}

function iconField(eid, current, labelText) {
  const input = h('input', { type: 'text', value: current || '', placeholder: 'fal fa-star', 'aria-label': labelText })
  const err = h('div', { class: 'field-error' })
  input.addEventListener('change', () => {
    if (!S.canvas.setIcon(eid, input.value.trim())) { err.textContent = 'Use a Font Awesome class, e.g. "fal fa-graduation-cap" or "fab fa-whatsapp"'; return }
    err.textContent = ''
    commit('Change icon')
  })
  const common = ['fal fa-star', 'fal fa-graduation-cap', 'fal fa-laptop-code', 'fal fa-code', 'fal fa-university', 'fal fa-comments', 'fab fa-whatsapp', 'far fa-arrow-right', 'fal fa-check-circle', 'fal fa-rocket-launch', 'fal fa-lightbulb', 'fal fa-users']
  return h('div', {}, field(labelText + ' (Font Awesome class)', input), err,
    h('div', { class: 'actions' }, common.map((c) => h('button', { type: 'button', class: 'btn btn--sm', title: c, onclick: () => { input.value = c; input.dispatchEvent(new Event('change')) } }, h('i', { class: c, 'aria-hidden': 'true' }), ' ', c.split('fa-')[1]))))
}

async function saveComponent(eid) {
  const name = h('input', { type: 'text', placeholder: 'e.g. Free course CTA' })
  modal({ title: 'Save as reusable section', body: field('Name', name, 'It appears under Add › Saved sections on every page.'), actions: [
    { label: 'Cancel' },
    { label: 'Save', primary: true, onClick: async () => {
      try {
        await save()
        await api('POST', '/api/components', { name: name.value, html: S.canvas.outerHTML(eid), fromKey: S.key })
        await loadLibraryData()
        toast('Saved — find it in Add › Saved sections.')
      } catch (e) { toast(e.message, { error: true }); return false }
    } }] })
}

// ---- style tab
const STYLE_GROUPS = [
  ['Typography', ['heading', 'text', 'button', 'link', 'icon', 'container', 'section'], [
    ['font-family', 'Font', 'font'], ['font-size', 'Size', 'len'], ['font-weight', 'Weight', ['', '300', '400', '500', '600', '700', '800']],
    ['color', 'Colour', 'color'], ['line-height', 'Line height', 'text'], ['letter-spacing', 'Letter spacing', 'len'],
    ['text-align', 'Align', ['', 'left', 'center', 'right', 'justify']], ['text-transform', 'Transform', ['', 'none', 'uppercase', 'lowercase', 'capitalize']],
    ['max-width', 'Max width (wrap)', 'len'], ['-webkit-line-clamp', 'Max lines', 'text']]],
  ['Spacing', null, [['margin', 'Margin', 'box'], ['padding', 'Padding', 'box']]],
  ['Size', null, [['width', 'Width', 'len'], ['max-width', 'Max width', 'len'], ['min-height', 'Min height', 'len'], ['height', 'Height', 'len']]],
  ['Background', ['section', 'container', 'button', 'link', 'text', 'heading', 'form', 'icon'], [
    ['background-color', 'Colour', 'color'], ['background-image', 'Image', 'bgimage'],
    ['background-size', 'Size', ['', 'cover', 'contain', 'auto']], ['background-position', 'Position', ['', 'center', 'top', 'bottom', 'left', 'right']]]],
  ['Border & shadow', null, [
    ['border-width', 'Border width', 'len'], ['border-style', 'Border style', ['', 'none', 'solid', 'dashed', 'dotted']], ['border-color', 'Border colour', 'color'],
    ['border-radius', 'Radius', 'len'], ['box-shadow', 'Shadow', ['', 'none', '0 8px 22px rgba(0,70,59,.08)', '0 18px 40px rgba(0,70,59,.16)', '0 2px 6px rgba(0,0,0,.12)']],
    ['opacity', 'Opacity (0-1)', 'text']]],
  ['Layout', ['section', 'container', 'form', 'button', 'link'], [
    ['display', 'Display', ['', 'block', 'flex', 'grid', 'inline-block', 'inline-flex']], ['flex-direction', 'Direction', ['', 'row', 'column', 'row-reverse', 'column-reverse']],
    ['flex-wrap', 'Wrap', ['', 'nowrap', 'wrap']], ['justify-content', 'Justify', ['', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around']],
    ['align-items', 'Align items', ['', 'stretch', 'flex-start', 'center', 'flex-end']], ['gap', 'Gap', 'len'], ['grid-template-columns', 'Grid columns', 'cols']]],
  ['Image', ['image'], [['object-fit', 'Fit', ['', 'cover', 'contain', 'fill', 'none']], ['object-position', 'Crop position', ['', 'center', 'top', 'bottom', 'left', 'right']],
    ['aspect-ratio', 'Aspect ratio', ['', '1 / 1', '4 / 3', '3 / 2', '16 / 9', '3 / 4', '2 / 3']], ['border-radius', 'Rounded corners', 'len']]],
  ['Position', null, [['order', 'Order in row/column', 'text'], ['align-self', 'Self align', ['', 'flex-start', 'center', 'flex-end', 'stretch']]]],
]
const LEN = /^(-?\d*\.?\d+(px|rem|em|%|vw|vh|ch)?|auto|0|none|normal)$/

function styleTab(i, body) {
  const states = ['button', 'link'].includes(i.kind) ? ['desktop', 'tablet', 'mobile', 'hover', 'focus'] : ['desktop', 'tablet', 'mobile']
  const bp = states.includes(currentBp()) ? currentBp() : 'desktop'
  const sw = h('div', { class: 'bp-switch', role: 'group', 'aria-label': 'Editing styles for' }, states.map((s) => h('button', { type: 'button', class: s === bp ? 'is-active' : '',
    onclick: () => {
      if (['desktop', 'tablet', 'mobile'].includes(s) && s !== S.device) { S.device = s; for (const x of document.querySelectorAll('[data-device]')) x.classList.toggle('is-active', x.dataset.device === s); layoutFrame() }
      S.bp = s
      renderProps()
    } }, { desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', hover: 'Hover', focus: 'Focus' }[s])))
  body.append(sw, h('div', { class: 'muted', text: bp === 'desktop' ? 'Desktop values are the default for every device.' : ['hover', 'focus'].includes(bp) ? 'Applied while the pointer is over the element / when focused with the keyboard.' : 'Only on ' + bp + ' screens — overrides the desktop value.' }))
  const key = i.styleKey
  const model = i.global ? S.gstyles : S.styles
  const values = (key && model[key] && model[key][bp]) || {}
  const set = (prop, value) => setStyle(i.eid, bp, prop, value)

  if (['desktop', 'tablet', 'mobile'].includes(bp)) {
    const hide = h('input', { type: 'checkbox', checked: values.display === 'none' })
    hide.addEventListener('change', () => set('display', hide.checked ? 'none' : ''))
    body.append(h('label', { class: 'check' }, hide, 'Hide on ' + bp))
  }
  for (const [title, kinds, props] of STYLE_GROUPS) {
    if (kinds && !kinds.includes(i.kind)) continue
    const det = h('details', { class: 'pgroup', open: title === 'Typography' || title === 'Spacing' })
    det.append(h('summary', { text: title }))
    for (const [prop, labelText, type] of props) det.append(styleControl(i, prop, labelText, type, values, bp, set))
    body.append(det)
  }
  if (key && model[key]) {
    body.append(h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => { delete model[key]; applyCss(); commit('Reset styles'); renderProps() } }, 'Reset all styles of this element')))
  }
}

function styleControl(i, prop, labelText, type, values, bp, set) {
  const computed = bp === 'desktop' ? (i.computed[prop] || '') : ''
  const isSet = values[prop] !== undefined
  const lab = h('label', {}, labelText, isSet ? h('span', { class: 'set', text: '● set' }) : null)
  if (type === 'box') {
    const sides = ['top', 'right', 'bottom', 'left']
    return h('div', {}, lab, h('div', { class: 'grid4' }, sides.map((s) => {
      const p = prop + '-' + s
      const inp = h('input', { type: 'text', value: values[p] || '', placeholder: bp === 'desktop' ? (i.computed[p] || '') : '', 'aria-label': labelText + ' ' + s })
      inp.addEventListener('change', () => { if (inp.value && !LEN.test(inp.value.trim())) { inp.value = ''; toast('Use a size like 16px, 1.5rem, 10% or auto', { error: true }); return } set(p, inp.value.trim()) })
      return h('div', {}, h('label', { text: s }), inp)
    })))
  }
  let ctl
  if (Array.isArray(type)) {
    ctl = h('select', { 'aria-label': labelText }, type.map((o) => h('option', { value: o, text: o || (computed ? 'Default (' + computed.slice(0, 26) + ')' : 'Default') })))
    ctl.value = values[prop] || ''
    ctl.addEventListener('change', () => set(prop, ctl.value))
  } else if (type === 'font') {
    ctl = h('select', { 'aria-label': labelText }, h('option', { value: '', text: 'Default' }), (S.boot ? S.boot.fonts : []).map((f) => h('option', { value: '"' + f + '", sans-serif', text: f })))
    ctl.value = values[prop] || ''
    ctl.addEventListener('change', () => set(prop, ctl.value))
  } else if (type === 'color') {
    const txt = h('input', { type: 'text', value: values[prop] || '', placeholder: computed || '#1CB098', 'aria-label': labelText })
    const pick = h('input', { type: 'color', value: /^#[0-9a-f]{6}$/i.test(values[prop] || '') ? values[prop] : '#1cb098', 'aria-label': labelText + ' picker' })
    const brand = ['var(--theme-color)', 'var(--theme-color2)', 'var(--title-color)', 'var(--body-color)', '#ffffff']
    const sw = h('select', { 'aria-label': labelText + ' theme colour' }, h('option', { value: '', text: 'Theme…' }), brand.map((b) => h('option', { value: b, text: b.replace('var(--', '').replace(')', '') })))
    pick.addEventListener('input', () => { txt.value = pick.value })
    pick.addEventListener('change', () => set(prop, pick.value))
    txt.addEventListener('change', () => { if (txt.value && !/^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|var\(--[\w-]+\)|transparent|currentColor)$/i.test(txt.value.trim())) { toast('Use #RRGGBB, rgb(), or a theme colour', { error: true }); return } set(prop, txt.value.trim()) })
    sw.addEventListener('change', () => { if (sw.value) { txt.value = sw.value; set(prop, sw.value) } })
    return h('div', {}, lab, h('div', { class: 'row' }, pick, txt, sw), h('div', { class: 'muted', text: 'Theme colours follow Theme settings.' }))
  } else if (type === 'bgimage') {
    const cur = (values[prop] || '').replace(/^url\("?|"?\)$/g, '')
    ctl = h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn btn--sm', onclick: () => mediaDialog({ pick: (m) => set(prop, 'url("' + m.url + '")') }) }, cur ? 'Change…' : 'Choose…'),
      cur ? h('button', { type: 'button', class: 'btn btn--sm btn--danger', onclick: () => set(prop, '') }, 'Remove') : null,
      h('span', { class: 'muted', text: cur ? cur.split('/').pop() : '' }))
  } else if (type === 'cols') {
    const n = /^repeat\((\d+),/.exec(values[prop] || '')
    ctl = h('select', { 'aria-label': labelText }, h('option', { value: '', text: 'Default' }), [1, 2, 3, 4, 5, 6].map((k) => h('option', { value: String(k), text: k + ' column' + (k > 1 ? 's' : '') })))
    ctl.value = n ? n[1] : ''
    ctl.addEventListener('change', () => set(prop, ctl.value ? 'repeat(' + ctl.value + ', minmax(0, 1fr))' : ''))
    return h('div', {}, lab, ctl, h('div', { class: 'muted', text: 'Needs Display: grid. Tip: 3 on desktop, 1 on mobile.' }))
  } else {
    ctl = h('input', { type: 'text', value: values[prop] || '', placeholder: computed, 'aria-label': labelText })
    ctl.addEventListener('change', () => {
      const v = ctl.value.trim()
      if (v && type === 'len' && !LEN.test(v)) { toast('Use a size like 18px, 1.2rem, 50% or auto', { error: true }); ctl.value = values[prop] || ''; return }
      set(prop, v)
    })
  }
  return h('div', {}, lab, ctl)
}

function setStyle(eid, bp, prop, value) {
  const r = S.canvas.ensureStyleKey(eid)
  if (!r) return
  const model = r.global ? S.gstyles : S.styles
  const entry = model[r.key] || (model[r.key] = {})
  const props = entry[bp] || (entry[bp] = {})
  if (value === '' || value === null || value === undefined) delete props[prop]
  else props[prop] = value
  if (prop === '-webkit-line-clamp') {
    if (value) { props.display = '-webkit-box'; props['-webkit-box-orient'] = 'vertical'; props.overflow = 'hidden' } else { delete props['-webkit-box-orient']; if (props.display === '-webkit-box') delete props.display }
  }
  if (!Object.keys(props).length) delete entry[bp]
  if (!Object.keys(entry).length) delete model[r.key]
  applyCss()
  commit('Style: ' + prop)
}

function advancedTab(i, body) {
  const eid = i.eid
  const id = h('input', { type: 'text', value: i.attrs.id || '', placeholder: 'e.g. courses', 'aria-label': 'Anchor id' })
  const idErr = h('div', { class: 'field-error' })
  id.addEventListener('change', () => {
    const v = id.value.trim()
    if (v && !/^[a-z][\w-]{0,60}$/i.test(v)) { idErr.textContent = 'Letters, numbers, - and _ only'; return }
    idErr.textContent = ''
    S.canvas.setAttr(eid, 'id', v || null)
    commit('Anchor id')
  })
  const aria = h('input', { type: 'text', value: i.attrs['aria-label'] || '', 'aria-label': 'Accessible name' })
  aria.addEventListener('change', () => { S.canvas.setAttr(eid, 'aria-label', aria.value.trim() || null); commit('Accessible name') })
  const title = h('input', { type: 'text', value: i.attrs.title || '', 'aria-label': 'Tooltip' })
  title.addEventListener('change', () => { S.canvas.setAttr(eid, 'title', title.value.trim() || null); commit('Tooltip') })
  body.append(field('Anchor id (link to it with #id)', id), idErr, field('Accessible name (screen readers)', aria, 'Needed for icon-only buttons and links.'), field('Tooltip', title),
    h('div', { class: 'muted', text: 'Element: <' + i.tag + '> · classes: ' + (i.attrs.class || '—') }),
    h('div', { class: 'actions' },
      i.canMove ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => copyElement(eid) }, 'Copy') : null,
      S.clipboard && i.canMove ? h('button', { type: 'button', class: 'btn btn--sm', onclick: () => pasteElement(eid) }, 'Paste after') : null))
}

// ------------------------------------------------------------------ media library (manager + picker)
function renderMediaPanel() {
  panel().replaceChildren(h('div', { class: 'ph' }, h('h2', { text: 'Media' })),
    h('p', { class: 'muted', text: 'Upload, browse and manage images. To change an image on the page, select it and use "Replace image…".' }),
    h('button', { type: 'button', class: 'btn btn--primary btn--block', onclick: () => mediaDialog({}) }, 'Open media library'))
}

function mediaDialog({ pick } = {}) {
  const q = h('input', { type: 'search', placeholder: 'Search file name…', 'aria-label': 'Search' })
  const type = h('select', { 'aria-label': 'Type' }, ['', 'webp', 'png', 'jpg', 'gif', 'svg', 'avif'].map((t) => h('option', { value: t, text: t || 'All types' })))
  const folder = h('select', { 'aria-label': 'Folder' }, h('option', { value: '', text: 'All folders' }))
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif,image/avif', multiple: true, hidden: true })
  const grid = h('div', { class: 'media-grid' }, h('p', { class: 'muted', text: 'Loading…' }))
  const detail = h('div', {})
  let items = []
  let current = null
  const load = async () => {
    const params = new URLSearchParams({ q: q.value, type: type.value, folder: folder.value })
    const r = await api('GET', '/api/media?' + params)
    if (folder.options.length === 1) for (const f of r.folders) folder.append(h('option', { value: f, text: f }))
    items = r.items
    grid.replaceChildren(...(items.length ? items.slice(0, 300).map((m) => h('button', { type: 'button', class: 'media-card' + (current && current.path === m.path ? ' is-sel' : ''), title: m.path, onclick: () => show(m) },
      h('img', { src: m.url, alt: '', loading: 'lazy' }), h('span', { text: m.name }), h('span', { class: 'muted', text: (m.width ? m.width + '×' + m.height + ' · ' : '') + Math.round(m.size / 1024) + ' KB' })))
      : [h('p', { class: 'muted', text: 'No images found.' })]))
  }
  const show = (m) => {
    current = m
    for (const c of grid.children) c.classList.toggle('is-sel', c.title === m.path)
    const alt = h('input', { type: 'text', value: m.alt, 'aria-label': 'Default alt text' })
    const name = h('input', { type: 'text', value: m.name.replace(/\.[^.]+$/, ''), 'aria-label': 'New name', disabled: !m.editable })
    detail.replaceChildren(h('div', { class: 'media-detail' },
      h('img', { src: m.url, alt: '' }),
      h('div', {},
        h('strong', { text: m.path }),
        h('div', { class: 'muted', text: (m.width ? m.width + ' × ' + m.height + ' px · ' : '') + Math.round(m.size / 1024) + ' KB · ' + m.ext.toUpperCase() + ' · ' + time(m.modified) }),
        h('div', { class: 'muted', text: m.usedBy.length ? 'Used in: ' + m.usedBy.join(', ') : 'Not used anywhere yet' }),
        field('Default alt text (suggested when inserting)', alt),
        h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => { try { await api('POST', '/api/media/alt', { path: m.path, alt: alt.value }); m.alt = alt.value; toast('Alt text saved') } catch (e) { toast(e.message, { error: true }) } } }, 'Save alt text')),
        m.editable ? h('div', {}, field('Rename (updates every page that uses it)', name), h('div', { class: 'actions' },
          h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => {
            if (!(await confirmBox('Rename image', 'Rename and update all ' + m.usedBy.length + ' references?', 'Rename'))) return
            try { await save(); const r = await api('POST', '/api/media/rename', { path: m.path, name: name.value }); toast('Renamed; updated ' + r.updatedReferences.length + ' file(s).'); await load(); if (S.key) openPage(S.key) } catch (e) { toast(e.message, { error: true }) }
          } }, 'Rename'),
          h('button', { type: 'button', class: 'btn btn--sm btn--danger', disabled: m.usedBy.length > 0, title: m.usedBy.length ? 'Still in use' : '', onclick: async () => {
            if (!(await confirmBox('Delete image', 'Permanently delete ' + m.name + '? It is not used anywhere.', 'Delete', true))) return
            try { await api('POST', '/api/media/delete', { path: m.path }); toast('Deleted'); detail.replaceChildren(); await load() } catch (e) { toast(e.message, { error: true }) }
          } }, m.usedBy.length ? 'In use — cannot delete' : 'Delete'))) : h('div', { class: 'muted', text: 'Theme file: read-only.' }),
        pick ? h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn btn--primary', onclick: () => { pick(m); dlg.close() } }, 'Use this image')) : null)))
  }
  file.addEventListener('change', async () => {
    for (const f of file.files) {
      try {
        const r = await api('POST', '/api/media/upload', undefined, { raw: f, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(f.name) } })
        toast('Uploaded ' + r.path)
        q.value = ''
        await load()
        const m = items.find((x) => x.path === r.path)
        if (m) show(m)
      } catch (e) { toast(f.name + ': ' + e.message, { error: true }) }
    }
    file.value = ''
  })
  const reload = debounce(load, 250)
  q.addEventListener('input', reload)
  type.addEventListener('change', load)
  folder.addEventListener('change', load)
  const dlg = modal({ title: pick ? 'Choose an image' : 'Media library', wide: true,
    body: h('div', {}, h('div', { class: 'media-tools' }, q, type, folder,
      h('button', { type: 'button', class: 'btn btn--primary', onclick: () => file.click() }, 'Upload images…'), file),
      h('p', { class: 'muted', text: 'PNG, JPG, WebP, GIF, AVIF up to 8 MB. Transparent PNG/WebP keep their transparency. SVG uploads are not accepted (security).' }), grid, detail) })
  load().catch((e) => toast(e.message, { error: true }))
}

// ------------------------------------------------------------------ structured content (CMS)
async function renderContentPanel() {
  panel().replaceChildren(h('p', { class: 'muted', text: 'Loading…' }))
  const r = await api('GET', '/api/data')
  panel().replaceChildren(h('div', { class: 'ph' }, h('h2', { text: 'Content' })),
    h('p', { class: 'muted', text: 'Structured content shown on several pages. Publishing regenerates exactly the blocks that show it (🔒 in Layers).' }),
    h('ul', { class: 'list' }, r.types.map((t) => h('li', { class: 'page-item' },
      h('div', { class: 'page-item__top' }, h('span', { class: 'page-item__title', text: t.label })),
      h('div', { class: 'page-item__route', text: t.note || '' }),
      h('div', { class: 'page-item__actions' }, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => cmsEditor(t.type) }, 'Edit'))))))
}

async function cmsEditor(type) {
  let d
  try { d = await api('GET', '/api/data/' + type) } catch (e) { toast(e.message, { error: true }); return }
  const schema = d.schema
  let data = clone(d.draft ?? d.published)
  let version = d.version
  let dirty = false
  const publishedSlugs = new Set(Array.isArray(d.published) ? d.published.map((x) => x.slug).filter(Boolean) : [])
  const issuesBox = h('div', {})
  const formBox = h('div', {})
  const status = h('span', { class: 'muted', text: d.draft ? 'Unpublished draft from ' + time(d.updatedAt) : 'Showing the published content' })
  const touch = () => { dirty = true; status.textContent = '● Unsaved changes' }

  const textInput = (def, value, onChange) => {
    const el = def.multiline ? h('textarea', { rows: 3, value: value ?? '' }) : h('input', { type: 'text', value: value ?? '' })
    el.addEventListener('input', () => { onChange(el.value === '' && def.nullable ? null : el.value); touch() })
    return el
  }
  function control(def, value, onChange, ctx) {
    switch (def.type) {
      case 'text': case 'html': case 'slug': case 'icon': {
        const el = textInput(def, value, onChange)
        if (def.type === 'slug' && def.lockExisting && publishedSlugs.has(value)) { el.disabled = true; el.title = 'Published pages use this URL' }
        return el
      }
      case 'enum': {
        const el = h('select', {}, def.options.map((o) => h('option', { value: o, text: o })))
        el.value = value ?? def.options[0]
        el.addEventListener('change', () => { onChange(el.value); touch() })
        return el
      }
      case 'bool': {
        const el = h('input', { type: 'checkbox', checked: Boolean(value) })
        el.addEventListener('change', () => { onChange(el.checked); touch() })
        return h('label', { class: 'check' }, el, 'Yes')
      }
      case 'number': {
        const el = h('input', { type: 'number', value: value ?? '', min: def.min, max: def.max })
        el.addEventListener('input', () => { onChange(el.value === '' ? null : Number(el.value)); touch() })
        return el
      }
      case 'url': {
        const el = h('input', { type: 'text', value: value ?? '' })
        el.addEventListener('input', () => { onChange(el.value); touch() })
        if (!def.internal) return el
        const sel = h('select', {}, h('option', { value: '', text: 'Choose a page…' }), routeOptions().map((o) => h('option', { value: o.value, text: o.label })))
        sel.value = routeOptions().some((o) => o.value === value) ? value : ''
        sel.addEventListener('change', () => { if (sel.value) { el.value = sel.value; onChange(sel.value); touch() } })
        return h('div', {}, sel, el)
      }
      case 'image': {
        const el = h('input', { type: 'text', value: value ?? '', placeholder: '/assets/…' })
        const img = h('img', { class: 'thumb', src: value && value.startsWith('/') ? value : '', alt: '', hidden: !(value && value.startsWith('/')) })
        el.addEventListener('input', () => { onChange(el.value === '' && def.nullable ? null : el.value); touch() })
        return h('div', {}, h('div', { class: 'row' }, el, h('button', { type: 'button', class: 'btn btn--sm', onclick: () => mediaDialog({ pick: (m) => { el.value = m.url; img.src = m.url; img.hidden = false; onChange(m.url); touch() } }) }, 'Choose…')), img)
      }
      case 'ref': {
        const opts = (ctx.root[def.ref] || []).map((c) => c.slug)
        const el = h('select', {}, opts.map((o) => h('option', { value: o, text: o })))
        el.value = value ?? opts[0]
        el.addEventListener('change', () => { onChange(el.value); touch() })
        return el
      }
      case 'list': {
        const arr = Array.isArray(value) ? value : []
        const box = h('div', { class: 'cms-list' })
        const draw = () => {
          box.replaceChildren(...arr.map((v, n) => h('div', { class: 'cms-list__row' },
            control({ ...def.item }, v, (nv) => { arr[n] = nv }, ctx),
            h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Move up', disabled: n === 0, onclick: () => { [arr[n - 1], arr[n]] = [arr[n], arr[n - 1]]; touch(); draw() } }, '↑'),
            h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Remove', onclick: () => { arr.splice(n, 1); touch(); draw() } }, '✕'))),
          h('button', { type: 'button', class: 'btn btn--sm', onclick: () => { arr.push(''); touch(); draw() } }, '+ Add'))
        }
        onChange(arr)
        draw()
        return box
      }
      case 'objects': return objectsEditor(def, value, onChange, ctx)
      default: return h('span', { text: 'unsupported field' })
    }
  }
  function objectFields(def, obj, ctx) {
    return Object.entries(def.fields).map(([k, f]) => h('div', { 'data-path': k }, h('label', { text: f.label + (f.required ? ' *' : '') }), control(f, obj[k], (v) => { obj[k] = v }, ctx)))
  }
  function objectsEditor(def, value, onChange, ctx) {
    const arr = Array.isArray(value) ? value : []
    onChange(arr)
    const box = h('div', {})
    const draw = () => {
      box.replaceChildren(...arr.map((obj, n) => {
        const det = h('details', { class: 'cms-item' })
        det.append(h('summary', {}, h('span', { text: plain(obj[def.itemLabel || Object.keys(def.fields)[0]] || '(new item)') }),
          h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Move up', disabled: n === 0, onclick: (e) => { e.preventDefault(); [arr[n - 1], arr[n]] = [arr[n], arr[n - 1]]; touch(); draw() } }, '↑'),
          h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Move down', disabled: n === arr.length - 1, onclick: (e) => { e.preventDefault(); [arr[n + 1], arr[n]] = [arr[n], arr[n + 1]]; touch(); draw() } }, '↓'),
          h('button', { type: 'button', class: 'ibtn', 'aria-label': 'Delete item', onclick: async (e) => { e.preventDefault(); if (await confirmBox('Delete item', 'Remove this item from ' + def.label + '?', 'Remove', true)) { arr.splice(n, 1); touch(); draw() } } }, '✕')))
        det.addEventListener('toggle', () => { if (det.open && !det.querySelector('.cms-item__body')) det.append(h('div', { class: 'cms-item__body' }, objectFields(def, obj, ctx))) }, { once: false })
        return det
      }), h('button', { type: 'button', class: 'btn btn--sm', onclick: () => {
        const blank = Object.fromEntries(Object.entries(def.fields).map(([k, f]) => [k, f.type === 'list' || f.type === 'objects' ? [] : f.type === 'bool' ? false : f.type === 'enum' ? f.options[0] : f.nullable ? null : '']))
        arr.push(blank)
        touch()
        draw()
        box.querySelectorAll(':scope > details').forEach((x, k) => { if (k === arr.length - 1) x.open = true })
      } }, '+ Add item'))
    }
    draw()
    return box
  }
  const drawForm = () => {
    const ctx = { root: data }
    if (schema.root === 'list') formBox.replaceChildren(objectsEditor({ ...schema, label: schema.label }, data, (v) => { data = v }, ctx))
    else formBox.replaceChildren(...Object.entries(schema.fields).map(([k, f]) => h('div', { class: 'pgroup' }, h('h3', { text: f.label }), control(f, data[k], (v) => { data[k] = v }, ctx))))
  }
  drawForm()

  const saveDraft = async () => {
    try {
      const r = await api('PUT', '/api/data/' + type, { version, data })
      version = r.version
      dirty = false
      status.textContent = '✓ Draft saved ' + new Date().toLocaleTimeString()
      issuesBox.replaceChildren()
      return true
    } catch (e) {
      if (e.status === 409) { toast('Saved elsewhere meanwhile — reopen to load the newer version.', { error: true }); return false }
      issuesBox.replaceChildren(h('div', { class: 'notice notice--warn', text: e.message }), issuesList((e.data.issues || []).map((i) => ({ ...i, level: 'error' }))))
      issuesBox.scrollIntoView({ block: 'start' })
      return false
    }
  }
  const dlg = modal({ title: 'Content › ' + schema.label, wide: true,
    body: h('div', {}, schema.note ? h('div', { class: 'notice notice--info', text: schema.note }) : null, status, issuesBox, formBox),
    onClose: () => { if (dirty) toast('Content editor closed with unsaved changes (they were not saved).', { error: true }) },
    actions: [
      { label: 'Discard draft', danger: true, keepOpen: true, onClick: async () => {
        if (!(await confirmBox('Discard draft', 'Throw away the unpublished changes to ' + schema.label + '?', 'Discard', true))) return
        await api('DELETE', '/api/data/' + type)
        data = clone(d.published)
        version = 0
        dirty = false
        drawForm()
        status.textContent = 'Showing the published content'
      } },
      { label: 'Save draft', keepOpen: true, onClick: saveDraft },
      { label: 'Publish', primary: true, keepOpen: true, onClick: async (e) => {
        if (!(await saveDraft())) return
        if (!(await confirmBox('Publish ' + schema.label, 'Update the live website now? Every page that shows ' + schema.label.toLowerCase() + ' is regenerated (a revision is kept for each).', 'Publish'))) return
        const btn = e.target
        btn.disabled = true
        btn.textContent = 'Publishing… (regenerating pages)'
        try {
          if (S.dirty) await save()
          const r = await api('POST', '/api/data/' + type + '/publish', {})
          dirty = false
          dlg.close()
          toast('Published ' + schema.label + ': ' + (r.changed.length ? r.changed.join(', ') : 'no page changed') + (r.created.length ? ' · new: ' + r.created.join(', ') : ''))
          await loadPages()
          await loadLibraryData()
          if (S.key) openPage(S.key)
        } catch (x) {
          issuesBox.replaceChildren(h('div', { class: 'notice notice--warn', text: x.message }), issuesList((x.data.issues || []).map((i) => ({ ...i, level: 'error' }))))
        } finally { btn.disabled = false; btn.textContent = 'Publish' }
      } },
    ] })
}

// ------------------------------------------------------------------ theme
async function renderThemePanel() {
  panel().replaceChildren(h('p', { class: 'muted', text: 'Loading…' }))
  const r = await api('GET', '/api/theme')
  const t = clone(r.theme)
  const status = h('div', { class: 'muted', text: r.draft ? 'Unpublished theme draft (preview only in the editor).' : 'Showing the live theme.' })
  const push = debounce(async () => {
    try {
      const res = await api('PUT', '/api/theme', t)
      S.themeCss = res.css
      applyCss()
      status.textContent = 'Draft saved — previewed in the editor only. Publish to apply to the website.'
    } catch (e) { status.textContent = e.message }
  }, 500)
  const color = (k, l) => {
    const c = h('input', { type: 'color', value: t[k] || '#000000', 'aria-label': l })
    c.addEventListener('change', () => { t[k] = c.value; push() })
    return h('div', { class: 'row' }, c, h('span', { text: l }))
  }
  const num = (k, l, min, max, suffix = 'px', allowEmpty = false) => {
    const i = h('input', { type: 'number', value: t[k] ?? '', min, max, placeholder: allowEmpty ? 'theme default' : '' })
    i.addEventListener('change', () => { t[k] = i.value === '' && allowEmpty ? '' : Number(i.value); push() })
    return field(l + ' (' + suffix + ')', i)
  }
  const font = (k, l) => {
    const s = h('select', {}, r.fonts.map((f) => h('option', { value: f, text: f })))
    s.value = t[k]
    s.addEventListener('change', () => { t[k] = s.value; push() })
    return field(l, s)
  }
  const shadow = h('select', {}, ['theme', 'none', 'soft', 'strong'].map((o) => h('option', { value: o, text: o })))
  shadow.value = t.cardShadow
  shadow.addEventListener('change', () => { t.cardShadow = shadow.value; push() })
  const anim = h('input', { type: 'checkbox', checked: t.animations })
  anim.addEventListener('change', () => { t.animations = anim.checked; push() })
  const link = h('input', { type: 'text', value: t.linkColor, placeholder: 'theme default', 'aria-label': 'Link colour' })
  link.addEventListener('change', () => { t.linkColor = link.value.trim(); push() })
  panel().replaceChildren(
    h('div', { class: 'ph' }, h('h2', { text: 'Theme' })), status,
    h('details', { class: 'pgroup', open: true }, h('summary', { text: 'Brand colours' }), color('primary', 'Primary (green)'), color('secondary', 'Secondary (yellow)'),
      color('headingColor', 'Headings'), color('bodyColor', 'Body text'), color('lightBackground', 'Light background'), color('sectionBackground', 'Section background'), field('Link colour (#RRGGBB)', link)),
    h('details', { class: 'pgroup', open: true }, h('summary', { text: 'Typography' }), font('headingFont', 'Heading font'), font('bodyFont', 'Body font'), num('baseFontSize', 'Base font size', 13, 20)),
    h('details', { class: 'pgroup' }, h('summary', { text: 'Layout' }), num('containerWidth', 'Content width', 960, 1600), num('sectionSpace', 'Section spacing (desktop)', 40, 200), num('sectionSpaceMobile', 'Section spacing (mobile)', 24, 160)),
    h('details', { class: 'pgroup' }, h('summary', { text: 'Buttons & cards' }), num('buttonRadius', 'Button radius', 0, 60, 'px', true), num('cardRadius', 'Card radius', 0, 60, 'px', true), field('Card shadow', shadow)),
    h('details', { class: 'pgroup' }, h('summary', { text: 'Motion' }), h('label', { class: 'check' }, anim, 'Scroll animations on')),
    h('div', { class: 'muted', text: 'Breakpoints are fixed by the site CSS (tablet ≤1199px, mobile ≤767px) and cannot be changed safely here.' }),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn--primary', onclick: async () => {
        if (!(await confirmBox('Publish theme', 'Apply these theme settings to the whole website now?', 'Publish'))) return
        try { await api('PUT', '/api/theme', t); await api('POST', '/api/theme/publish', {}); S.themeCss = null; toast('Theme published to the website.'); if (S.key) openPage(S.key); renderThemePanel() } catch (e) { toast(e.message, { error: true }) }
      } }, 'Publish theme'),
      h('button', { type: 'button', class: 'btn btn--danger', onclick: async () => { await api('DELETE', '/api/theme'); S.themeCss = ''; applyCss(); S.themeCss = null; renderThemePanel() } }, 'Discard draft')))
  if (r.draft) push()
}

// ------------------------------------------------------------------ page settings, duplicate, revisions, preview
$('#settingsBtn').addEventListener('click', () => {
  if (!S.info) return
  const title = h('input', { type: 'text', value: S.meta.title })
  const desc = h('textarea', { rows: 3, value: S.meta.description })
  const p = S.pages.find((x) => x.key === S.key) || S.info
  modal({ title: 'Page settings', body: h('div', {},
    field('SEO title (browser tab, Google)', title, 'About 50–60 characters.'),
    field('SEO description', desc, 'About 140–160 characters.'),
    field('URL', h('input', { type: 'text', value: S.info.route, disabled: true }), S.info.protected ? 'Existing pages keep their URL so links and Google results never break. Duplicate the page to make a new URL.' : 'Set when the page was created.'),
    h('div', { class: 'muted', text: 'Status: ' + p.status + ' · last published ' + time(p.lastModified) + (S.hasDraft ? ' · has an unpublished draft' : '') })),
  actions: [{ label: 'Cancel' }, { label: 'Apply', primary: true, onClick: () => {
    if (/[<>]/.test(title.value + desc.value)) { toast('No < or > characters', { error: true }); return false }
    S.meta = { title: title.value.trim(), description: desc.value.trim() }
    commit('Page settings')
  } }] })
})

function duplicateDialog(p) {
  const slug = h('input', { type: 'text', placeholder: 'e.g. events or courses/new-course' })
  const title = h('input', { type: 'text', value: plain(p.title) + ' (copy)' })
  modal({ title: 'Duplicate ' + p.route, body: h('div', {}, field('New URL (after the domain /)', slug, 'a-z, 0-9 and - only.'), field('Page title', title),
    h('p', { class: 'muted', text: 'The copy stays unpublished (not on the website) until you publish it from Pages.' })),
  actions: [{ label: 'Cancel' }, { label: 'Duplicate', primary: true, onClick: async () => {
    try {
      const r = await api('POST', '/api/pages/' + encodeURIComponent(p.key) + '/duplicate', { slug: slug.value.trim().replace(/^\/|\/$/g, ''), title: title.value })
      await loadPages()
      toast('Created ' + r.route + ' (unpublished).')
      openPage(r.key)
    } catch (e) { toast(e.message, { error: true }); return false }
  } }] })
}

async function togglePublished(p) {
  const publish = p.status !== 'published'
  if (!(await confirmBox(publish ? 'Publish page' : 'Unpublish page', publish ? 'Make ' + p.route + ' available on the website?' : 'Remove ' + p.route + ' from the website? (Kept in the admin; a revision is saved.)', publish ? 'Publish' : 'Unpublish', !publish))) return
  try {
    if (p.key === S.key) await save()
    await api('POST', '/api/pages/' + encodeURIComponent(p.key) + '/publish-state', { published: publish })
    await loadPages()
    renderPagesPanel()
    toast(publish ? 'Published ' + p.route : 'Unpublished ' + p.route)
  } catch (e) { toast(e.message, { error: true }) }
}

async function revisionsDialog(p) {
  const page = p || S.pages.find((x) => x.key === S.key)
  if (!page) return
  const r = await api('GET', '/api/pages/' + encodeURIComponent(page.key) + '/revisions')
  modal({ title: 'History of ' + page.route, wide: true, body: h('div', {},
    h('p', { class: 'muted', text: 'A snapshot of the live page is stored before every publish or restore (latest 60).' }),
    r.revisions.length ? h('ul', { class: 'list' }, r.revisions.map((v) => h('li', { class: 'page-item' },
      h('div', { class: 'page-item__top' }, h('span', { class: 'page-item__title', text: time(v.created) }), h('span', { class: 'badge', text: v.by || '' })),
      h('div', { class: 'page-item__route', text: v.reason + ' · ' + Math.round(v.size / 1024) + ' KB · title: ' + plain(v.title) }),
      h('div', { class: 'page-item__actions' },
        h('a', { class: 'btn btn--sm', href: '/__admin/revision/' + encodeURIComponent(page.key) + '/' + v.id, target: '_blank', rel: 'noopener' }, 'Preview this version'),
        h('a', { class: 'btn btn--sm', href: page.route, target: '_blank', rel: 'noopener' }, 'Compare with live'),
        h('button', { type: 'button', class: 'btn btn--sm', onclick: async () => {
          if (!(await confirmBox('Restore version', 'Make the ' + time(v.created) + ' version live again? The current live page is saved as a revision first and any unpublished draft of this page is discarded.', 'Restore', true))) return
          try {
            await api('POST', '/api/pages/' + encodeURIComponent(page.key) + '/revisions/' + v.id + '/restore', {})
            toast('Restored. The live page now shows the ' + time(v.created) + ' version.')
            await loadPages()
            if (page.key === S.key) { S.dirty = false; openPage(S.key) }
          } catch (e) { toast(e.message, { error: true }) }
        } }, 'Restore'))))) : h('p', { class: 'muted', text: 'No revisions yet — one is created the first time you publish.' })) })
}
$('#historyBtn').addEventListener('click', () => revisionsDialog())

$('#previewBtn').addEventListener('click', async () => {
  if (!S.key) return
  await save()
  window.open('/__admin/render/' + encodeURIComponent(S.key) + '?mode=preview', '_blank', 'noopener')
})

// ------------------------------------------------------------------ publish
async function overflowCheck() {
  // load the draft preview (with the site's real scripts) at phone and tablet width and look for horizontal scrolling
  const out = []
  for (const w of [390, 820]) {
    const f = h('iframe', { style: 'position:fixed;left:-10000px;top:0;width:' + w + 'px;height:800px;border:0', 'aria-hidden': 'true', tabindex: '-1' })
    document.body.append(f)
    await new Promise((res) => { f.onload = res; f.src = '/__admin/render/' + encodeURIComponent(S.key) + '?mode=preview&t=' + Date.now(); setTimeout(res, 8000) })
    await new Promise((res) => setTimeout(res, 1200))
    try {
      const d = f.contentDocument
      if (d.documentElement.scrollWidth > w + 2) out.push({ level: 'warning', code: 'overflow', message: 'At ' + w + 'px the page scrolls sideways (' + d.documentElement.scrollWidth + 'px wide). Check widths on ' + (w < 500 ? 'mobile' : 'tablet') + '.' })
    } catch { /* ignore */ }
    f.remove()
  }
  return out
}

$('#publishBtn').addEventListener('click', async () => {
  if (!S.key) return
  if (!(await save())) { toast('Save the draft first (see the error).', { error: true }); return }
  const body = h('div', {}, h('p', { class: 'muted', text: 'Checking links, images, safety and mobile layout…' }))
  const dlg = modal({ title: 'Publish ' + (S.info.route === '/' ? 'Home' : S.info.route), wide: true, body, actions: [] })
  try {
    const [pv, gv, ov] = await Promise.all([
      api('GET', '/api/pages/' + encodeURIComponent(S.key) + '/validate'),
      api('GET', '/api/global/validate'),
      overflowCheck(),
    ])
    const pageIssues = [...pv.issues, ...ov]
    const pageErr = pageIssues.some((i) => i.level === 'error')
    const gErr = gv.issues.some((i) => i.level === 'error')
    const pageBox = h('input', { type: 'checkbox', checked: pv.hasDraft && !pageErr, disabled: !pv.hasDraft || pageErr })
    const gBox = h('input', { type: 'checkbox', checked: false, disabled: !gv.hasDraft || gErr })
    const reviewed = h('input', { type: 'checkbox', checked: false })
    const warnings = [...pageIssues, ...gv.issues].some((i) => i.level === 'warning')
    const btn = h('button', { type: 'button', class: 'btn btn--primary' }, 'Publish')
    const parts = [
      h('h3', { text: 'This page' }),
      pv.hasDraft ? issuesList(pageIssues) : h('p', { class: 'muted', text: 'No page changes to publish.' }),
      pv.hasDraft ? h('label', { class: 'check' }, pageBox, 'Publish this page' + (pageErr ? ' (fix the errors first)' : '')) : null,
    ]
    if (gv.hasDraft) {
      parts.push(h('h3', { text: 'Shared header / footer / their styles' }), h('div', { class: 'notice notice--global', text: '◆ Publishing this updates the header and footer on all ' + gv.pages + ' pages.' }),
        issuesList(gv.issues), h('label', { class: 'check' }, gBox, 'Yes, apply the shared header/footer to all ' + gv.pages + ' pages'))
    }
    if (warnings) parts.push(h('label', { class: 'check' }, reviewed, 'I reviewed the warnings above'))
    parts.push(h('div', { class: 'actions' },
      h('a', { class: 'btn', href: '/__admin/render/' + encodeURIComponent(S.key) + '?mode=preview', target: '_blank', rel: 'noopener' }, 'Preview changes'),
      h('a', { class: 'btn', href: S.info.route, target: '_blank', rel: 'noopener' }, 'Open live page'), btn))
    body.replaceChildren(...parts.filter(Boolean))
    btn.addEventListener('click', async () => {
      if (!pageBox.checked && !gBox.checked) { toast('Nothing selected to publish.', { error: true }); return }
      if (warnings && !reviewed.checked) { toast('Tick "I reviewed the warnings" first.', { error: true }); return }
      btn.disabled = true
      btn.textContent = 'Publishing…'
      try {
        const done = []
        if (pageBox.checked) { await api('POST', '/api/pages/' + encodeURIComponent(S.key) + '/publish', { version: S.version, acceptWarnings: true }); done.push('page') }
        if (gBox.checked) { const r = await api('POST', '/api/global/publish', { version: S.gversion, acceptWarnings: true }); done.push('shared header/footer (' + r.pages.length + ' pages)') }
        dlg.close()
        toast('', { html: h('span', {}, 'Published ' + done.join(' + ') + '. ', h('a', { href: S.info.route, target: '_blank', rel: 'noopener' }, 'View live page')) })
        S.dirty = false
        await loadPages()
        openPage(S.key)
      } catch (e) {
        btn.disabled = false
        btn.textContent = 'Publish'
        body.append(h('div', { class: 'notice notice--warn', text: e.message }), issuesList(e.data.issues))
      }
    })
  } catch (e) {
    body.replaceChildren(h('div', { class: 'notice notice--warn', text: e.message }))
  }
})

$('#logoutBtn').addEventListener('click', async () => {
  if (S.dirty && !(await save()) && !(await confirmBox('Unsaved changes', 'Saving failed. Log out anyway and lose them?', 'Log out', true))) return
  try { await api('POST', '/api/logout', {}) } catch { /* already logged out */ }
  location.reload()
})

init()
