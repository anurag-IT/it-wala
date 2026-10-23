// Site service: pages, drafts, publishing, revisions, shared header/footer, theme and CMS data.
//
// Storage (content/):
//   drafts/pages/<key>.json      page draft  {version, baseHash, main, meta, styles, updatedAt, by}
//   drafts/global.json           shared header/footer draft {version, header, footer, styles}
//   drafts/theme.json, drafts/data/<type>.json
//   published/pages/<key>.json   published style model of a page   published/global.json   theme.json
//   revisions/<key>/<id>.json    snapshot of a file before every publish/restore (max 60 per key)
//   unpublished/<key>.html       pages created in the admin and not published yet;  pages.json lists them
//   private/audit.log            who published what (git-ignored)
// The published website is the HTML files themselves, so any static host keeps working.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawn } from 'node:child_process'
import { HttpError, readJson, writeJson, writeAtomic, sha256, nowIso, ensureDir } from './util.mjs'
import {
  getRegions, setRegions, refreshManaged, refreshNav, ownedMain, getMeta, setMeta, setPageStyles, setActiveNav,
} from './pages.mjs'
import { securityIssues, cleanStyleModel, compileStyles, inlineTextIssue } from './htmlsafe.mjs'
import { checkContent, makeResolver } from './check.mjs'
import { cleanTheme, compileTheme, THEME_DEFAULTS } from './theme.mjs'
import { CMS_TYPES, validateData, affectedFiles } from './cms.mjs'

const SKIP_DIRS = new Set(['node_modules', '_original', 'it-wala', 'admin', 'content', 'dist', 'server', 'scripts', '.git', '.claude'])
const MAX_REVISIONS = 60
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/

export class Site {
  constructor(config) {
    this.cfg = config
    this.root = config.root
    this.dir = config.contentDir
    this.locks = Promise.resolve()
  }

  // serialize all writes: one publish at a time
  exclusive(fn) {
    const run = this.locks.then(fn, fn)
    this.locks = run.catch(() => {})
    return run
  }

  p(...parts) {
    return path.join(this.dir, ...parts)
  }

  audit(by, action, detail) {
    const line = JSON.stringify({ at: nowIso(), by, action, ...detail }) + '\n'
    ensureDir(this.p('private'))
    fs.appendFileSync(this.p('private', 'audit.log'), line)
  }

  // ---------------------------------------------------------------- pages

  keyOf(route) {
    return route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '__')
  }

  createdPages() {
    return readJson(this.p('pages.json'), { created: [] }).created
  }

  listPages() {
    const out = []
    const courseSlugs = new Set(readJson(path.join(this.root, 'content', 'data', 'courses.json'), []).map((c) => c.slug))
    const add = (abs) => {
      const rel = path.relative(this.root, abs).split(path.sep).join('/')
      if (SKIP_DIRS.has(rel.split('/')[0])) return
      const html = fs.readFileSync(abs, 'utf8')
      if (!html.includes('/assets/itwd/itwd.js')) return
      const route = rel === 'index.html' ? '/' : '/' + rel.slice(0, -'/index.html'.length)
      out.push(this.pageInfo(route, rel, html, courseSlugs))
    }
    add(path.join(this.root, 'index.html'))
    for (const d of fs.readdirSync(this.root, { withFileTypes: true })) {
      if (!d.isDirectory() || SKIP_DIRS.has(d.name)) continue
      const f = path.join(this.root, d.name, 'index.html')
      if (fs.existsSync(f)) add(f)
      for (const s of fs.readdirSync(path.join(this.root, d.name), { withFileTypes: true })) {
        const g = path.join(this.root, d.name, s.name, 'index.html')
        if (s.isDirectory() && fs.existsSync(g)) add(g)
      }
    }
    for (const c of this.createdPages()) {
      const f = this.p('unpublished', c.key + '.html')
      if (fs.existsSync(f) && !out.some((x) => x.route === c.route)) {
        out.push(this.pageInfo(c.route, null, fs.readFileSync(f, 'utf8'), courseSlugs))
      }
    }
    return out
  }

  pageInfo(route, rel, html, courseSlugs) {
    const key = this.keyOf(route)
    const draft = readJson(this.p('drafts', 'pages', key + '.json'), null)
    const created = this.createdPages().find((c) => c.route === route)
    const file = rel ? path.join(this.root, rel) : this.p('unpublished', key + '.html')
    const m = route.match(/^\/plus-two\/([a-z0-9-]+)$/)
    return {
      key, route, file: rel, ...getMeta(html),
      status: rel ? 'published' : 'unpublished',
      createdInAdmin: Boolean(created),
      protected: !created,
      managedPage: Boolean(m && courseSlugs.has(m[1])),
      lastModified: fs.statSync(file).mtime.toISOString(),
      hasDraft: Boolean(draft), draftUpdatedAt: draft?.updatedAt || null,
    }
  }

  page(key) {
    const info = this.listPages().find((p) => p.key === key)
    if (!info) throw new HttpError(404, 'Page not found')
    const file = info.file ? path.join(this.root, info.file) : this.p('unpublished', key + '.html')
    return { info, file, html: fs.readFileSync(file, 'utf8') }
  }

  // ---------------------------------------------------------------- drafts

  draftFile(key) {
    return this.p('drafts', 'pages', key + '.json')
  }

  getState(key) {
    const { info, html } = this.page(key)
    const draft = readJson(this.draftFile(key), null)
    const published = readJson(this.p('published', 'pages', key + '.json'), { styles: {} })
    const gDraft = readJson(this.p('drafts', 'global.json'), null)
    const gPublished = readJson(this.p('published', 'global.json'), { styles: {} })
    return {
      info,
      meta: draft?.meta || getMeta(html),
      styles: draft?.styles || published.styles || {},
      version: draft?.version || 0,
      draftUpdatedAt: draft?.updatedAt || null,
      global: { styles: gDraft?.styles || gPublished.styles || {}, version: gDraft?.version || 0, hasDraft: Boolean(gDraft) },
    }
  }

  saveDraft(key, body, by) {
    return this.exclusive(() => {
      const { html } = this.page(key)
      const current = readJson(this.draftFile(key), null)
      const version = current?.version || 0
      if (Number(body.version) !== version) {
        throw new HttpError(409, 'This page was saved somewhere else in the meantime (newer draft v' + version + ').', { version })
      }
      const issues = []
      const draft = { version: version + 1, baseHash: current?.baseHash || sha256(ownedMain(html)), updatedAt: nowIso(), by }
      if (typeof body.main === 'string') {
        if (body.main.length > 4_000_000) throw new HttpError(413, 'Page content too large')
        issues.push(...securityIssues(body.main, getRegions(html).main))
        draft.main = body.main
      } else if (current?.main) draft.main = current.main
      const meta = body.meta || current?.meta
      if (meta) {
        for (const k of ['title', 'description']) {
          if (typeof meta[k] !== 'string' || meta[k].length > 400 || /[<>]/.test(meta[k])) issues.push({ level: 'error', code: 'meta', message: 'Invalid page ' + k })
        }
        draft.meta = { title: meta.title, description: meta.description }
      }
      if (body.styles) {
        const r = cleanStyleModel(body.styles)
        issues.push(...r.issues)
        draft.styles = r.model
      } else if (current?.styles) draft.styles = current.styles
      const errors = issues.filter((i) => i.level === 'error')
      if (errors.length) throw new HttpError(422, 'The draft contains content that is not allowed.', { issues: errors })
      writeJson(this.draftFile(key), draft)
      return { version: draft.version, updatedAt: draft.updatedAt }
    })
  }

  discardDraft(key) {
    return this.exclusive(() => {
      fs.rmSync(this.draftFile(key), { force: true })
      return { ok: true }
    })
  }

  saveGlobalDraft(body, by) {
    return this.exclusive(() => {
      const file = this.p('drafts', 'global.json')
      const current = readJson(file, null)
      const version = current?.version || 0
      if (Number(body.version) !== version) throw new HttpError(409, 'The shared header/footer draft was changed elsewhere.', { version })
      const home = fs.readFileSync(path.join(this.root, 'index.html'), 'utf8')
      const pub = getRegions(home)
      const issues = []
      const draft = { version: version + 1, updatedAt: nowIso(), by }
      for (const r of ['header', 'footer', 'sideTab']) {
        if (typeof body[r] === 'string') {
          issues.push(...securityIssues(body[r], pub[r] || ''))
          draft[r] = body[r]
        } else if (current?.[r]) draft[r] = current[r]
      }
      const styles = body.styles || current?.styles
      if (styles) {
        const res = cleanStyleModel(styles)
        issues.push(...res.issues)
        draft.styles = res.model
      }
      const errors = issues.filter((i) => i.level === 'error')
      if (errors.length) throw new HttpError(422, 'The shared header/footer contains content that is not allowed.', { issues: errors })
      writeJson(file, draft)
      return { version: draft.version, updatedAt: draft.updatedAt }
    })
  }

  discardGlobalDraft() {
    return this.exclusive(() => {
      fs.rmSync(this.p('drafts', 'global.json'), { force: true })
      return { ok: true }
    })
  }

  // ---------------------------------------------------------------- rendering (editor canvas / preview)

  /** Whole page HTML with the page draft (and the shared header/footer draft) applied. */
  draftHtml(key, { withGlobal = true } = {}) {
    const { info, html } = this.page(key)
    const draft = readJson(this.draftFile(key), null)
    let out = html
    if (draft?.main) out = setRegions(out, { main: refreshManaged(draft.main, getRegions(html).main) })
    if (draft?.meta) out = setMeta(out, draft.meta)
    const styles = draft?.styles || readJson(this.p('published', 'pages', key + '.json'), { styles: {} }).styles
    out = setPageStyles(out, compileStyles(styles))
    if (withGlobal) {
      const g = readJson(this.p('drafts', 'global.json'), null)
      if (g) out = this.applyGlobal(out, info.route, g)
      if (g?.styles) out = out.replace('</head>', () => '<style id="itwd-global-draft-styles">\n' + compileStyles(g.styles) + '\n</style>\n</head>')
    }
    return out
  }

  applyGlobal(pageHtml, route, g) {
    const cur = getRegions(pageHtml)
    const regions = {}
    if (typeof g.header === 'string') regions.header = refreshNav(setActiveNav(g.header, route), cur.header)
    if (typeof g.footer === 'string') regions.footer = refreshNav(g.footer, cur.footer)
    if (typeof g.sideTab === 'string' && cur.sideTab) regions.sideTab = g.sideTab
    return setRegions(pageHtml, regions)
  }

  // ---------------------------------------------------------------- validation + publishing

  validateDraft(key) {
    const { html } = this.page(key)
    const draft = readJson(this.draftFile(key), null)
    const next = this.draftHtml(key, { withGlobal: false })
    const exists = makeResolver(this.root)
    const issues = []
    const prevMain = getRegions(html).main
    const nextMain = getRegions(next).main
    issues.push(...securityIssues(nextMain, prevMain))
    issues.push(...checkContent(nextMain, prevMain, exists, next))
    if (draft?.meta && !draft.meta.title.trim()) issues.push({ level: 'error', code: 'meta', message: 'Page title is empty' })
    if (draft && draft.baseHash !== sha256(ownedMain(html))) {
      issues.push({ level: 'warning', code: 'conflict', message: 'The live page changed after this draft was started (another publish or a file edit). Publishing replaces the live content of this page with your draft.' })
    }
    return { issues, hasDraft: Boolean(draft) }
  }

  validateGlobal() {
    const g = readJson(this.p('drafts', 'global.json'), null)
    if (!g) return { issues: [], hasDraft: false }
    const home = fs.readFileSync(path.join(this.root, 'index.html'), 'utf8')
    const pub = getRegions(home)
    const exists = makeResolver(this.root)
    const issues = []
    for (const r of ['header', 'footer', 'sideTab']) {
      if (typeof g[r] !== 'string') continue
      issues.push(...securityIssues(g[r], pub[r] || ''))
      issues.push(...checkContent(g[r], pub[r] || '', exists))
    }
    return { issues, hasDraft: true, pages: this.listPages().filter((p) => p.status === 'published').length }
  }

  snapshot(key, file, html, by, reason, extra = {}) {
    const dir = this.p('revisions', key)
    ensureDir(dir)
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex')
    writeJson(path.join(dir, id + '.json'), { id, key, created: nowIso(), by, reason, file: path.relative(this.root, file).split(path.sep).join('/'), html, ...extra })
    const all = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    for (const old of all.slice(0, Math.max(0, all.length - MAX_REVISIONS))) fs.rmSync(path.join(dir, old), { force: true })
    return id
  }

  publishPage(key, { version, acceptWarnings = false } = {}, by) {
    return this.exclusive(() => {
      const { info, file, html } = this.page(key)
      const draft = readJson(this.draftFile(key), null)
      if (!draft) throw new HttpError(400, 'Nothing to publish: this page has no draft.')
      if (Number(version) !== draft.version) throw new HttpError(409, 'The draft changed since you opened the publish dialog. Review it again.', { version: draft.version })
      const { issues } = this.validateDraft(key)
      if (issues.some((i) => i.level === 'error')) throw new HttpError(422, 'Fix the errors before publishing.', { issues })
      if (!acceptWarnings && issues.length) throw new HttpError(428, 'Please review the warnings.', { issues })
      const published = readJson(this.p('published', 'pages', key + '.json'), { styles: {} })
      const rev = this.snapshot(key, file, html, by, 'before publish', { styles: published.styles || {} })
      const next = this.draftHtml(key, { withGlobal: false })
      writeAtomic(file, next)
      writeJson(this.p('published', 'pages', key + '.json'), { styles: draft.styles || published.styles || {}, updatedAt: nowIso(), by })
      fs.rmSync(this.draftFile(key), { force: true })
      this.audit(by, 'publish-page', { route: info.route, revision: rev })
      return { ok: true, route: info.route, revision: rev, publishedAt: nowIso() }
    })
  }

  publishGlobal({ version, acceptWarnings = false } = {}, by) {
    return this.exclusive(() => {
      const g = readJson(this.p('drafts', 'global.json'), null)
      if (!g) throw new HttpError(400, 'Nothing to publish: the shared header/footer has no draft.')
      if (Number(version) !== g.version) throw new HttpError(409, 'The shared header/footer draft changed. Review it again.', { version: g.version })
      const { issues } = this.validateGlobal()
      if (issues.some((i) => i.level === 'error')) throw new HttpError(422, 'Fix the errors before publishing.', { issues })
      if (!acceptWarnings && issues.length) throw new HttpError(428, 'Please review the warnings.', { issues })
      const pages = this.listPages().filter((p) => p.status === 'published')
      const batch = crypto.randomBytes(4).toString('hex')
      for (const p of pages) {
        const file = path.join(this.root, p.file)
        const html = fs.readFileSync(file, 'utf8')
        this.snapshot(p.key, file, html, by, 'before shared header/footer publish', { batch })
        writeAtomic(file, this.applyGlobal(html, p.route, g))
      }
      const globalCssFile = path.join(this.root, 'assets', 'itwd', 'editor-global.css')
      if (g.styles) {
        this.snapshot('__global-css', globalCssFile, fs.existsSync(globalCssFile) ? fs.readFileSync(globalCssFile, 'utf8') : '', by, 'before shared styles publish', { batch })
        writeAtomic(globalCssFile, '/* Generated by the IT Wala Dai admin: styles of elements in the shared header/footer. Do not edit by hand. */\n' + compileStyles(g.styles) + '\n')
        writeJson(this.p('published', 'global.json'), { styles: g.styles, updatedAt: nowIso(), by })
      }
      fs.rmSync(this.p('drafts', 'global.json'), { force: true })
      this.audit(by, 'publish-global', { pages: pages.length, batch })
      return { ok: true, pages: pages.map((p) => p.route), batch }
    })
  }

  // ---------------------------------------------------------------- revisions

  revisions(key) {
    const dir = this.p('revisions', key)
    if (!fs.existsSync(dir)) return []
    return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort().reverse().map((f) => {
      const r = readJson(path.join(dir, f), {})
      return { id: r.id, created: r.created, by: r.by, reason: r.reason, batch: r.batch || null, title: getMeta(r.html || '').title, size: (r.html || '').length }
    })
  }

  revision(key, id) {
    if (!/^[\w-]+$/.test(id)) throw new HttpError(400, 'Bad revision id')
    const r = readJson(this.p('revisions', key, id + '.json'), null)
    if (!r) throw new HttpError(404, 'Revision not found')
    return r
  }

  restore(key, id, by) {
    return this.exclusive(() => {
      const { info, file, html } = this.page(key)
      const r = this.revision(key, id)
      const published = readJson(this.p('published', 'pages', key + '.json'), { styles: {} })
      const before = this.snapshot(key, file, html, by, 'before restoring ' + id, { styles: published.styles || {} })
      writeAtomic(file, r.html)
      if (r.styles) writeJson(this.p('published', 'pages', key + '.json'), { styles: r.styles, updatedAt: nowIso(), by })
      fs.rmSync(this.draftFile(key), { force: true })
      this.audit(by, 'restore', { route: info.route, revision: id, backup: before })
      return { ok: true, backup: before }
    })
  }

  // ---------------------------------------------------------------- page settings: duplicate / publish new pages

  duplicatePage(key, { slug, title }, by) {
    return this.exclusive(() => {
      if (!SLUG.test(String(slug || ''))) throw new HttpError(400, 'Use a slug like "new-page" or "section/new-page" (a-z, 0-9, -)')
      const route = '/' + slug
      if (this.listPages().some((p) => p.route === route) || fs.existsSync(path.join(this.root, slug))) {
        throw new HttpError(409, 'A page or folder with this URL already exists')
      }
      if (SKIP_DIRS.has(slug.split('/')[0]) || ['assets', 'wp-content', 'wp-includes', 'college', 'mentor'].includes(slug.split('/')[0])) {
        throw new HttpError(400, 'This URL is reserved')
      }
      if (typeof title !== 'string' || !title.trim() || title.length > 200 || /[<>]/.test(title)) throw new HttpError(400, 'Enter a page title')
      const { html } = this.page(key)
      const newKey = this.keyOf(route)
      let copy = setMeta(html, { title: title.trim() })
      copy = setRegions(copy, { header: setActiveNav(getRegions(copy).header, route) })
      writeAtomic(this.p('unpublished', newKey + '.html'), copy)
      const pub = readJson(this.p('published', 'pages', key + '.json'), null)
      if (pub) writeJson(this.p('published', 'pages', newKey + '.json'), pub)
      const reg = readJson(this.p('pages.json'), { created: [] })
      reg.created.push({ route, key: newKey, from: key, createdAt: nowIso(), by })
      writeJson(this.p('pages.json'), reg)
      this.audit(by, 'duplicate-page', { from: key, route })
      return { key: newKey, route }
    })
  }

  setPublished(key, publish, by) {
    return this.exclusive(() => {
      const created = this.createdPages().find((c) => c.key === key)
      if (!created) throw new HttpError(403, 'Existing site pages are protected: they cannot be unpublished from the admin.')
      const target = path.join(this.root, created.route.slice(1), 'index.html')
      const store = this.p('unpublished', key + '.html')
      if (publish) {
        if (!fs.existsSync(store)) throw new HttpError(400, 'Page is already published')
        let html = fs.readFileSync(store, 'utf8')
        if (fs.existsSync(this.draftFile(key))) html = this.draftHtml(key, { withGlobal: false })
        writeAtomic(target, html)
        fs.rmSync(store, { force: true })
        fs.rmSync(this.draftFile(key), { force: true })
      } else {
        if (!fs.existsSync(target)) throw new HttpError(400, 'Page is not published')
        this.snapshot(key, target, fs.readFileSync(target, 'utf8'), by, 'before unpublish')
        writeAtomic(store, fs.readFileSync(target, 'utf8'))
        fs.rmSync(target, { force: true })
        try { fs.rmdirSync(path.dirname(target)) } catch { /* folder not empty: keep it */ }
      }
      this.audit(by, publish ? 'publish-new-page' : 'unpublish', { route: created.route })
      return { ok: true, status: publish ? 'published' : 'unpublished' }
    })
  }

  // ---------------------------------------------------------------- theme

  getTheme() {
    const published = { ...THEME_DEFAULTS, ...readJson(this.p('theme.json'), {}) }
    const draft = readJson(this.p('drafts', 'theme.json'), null)
    return { published, draft, theme: draft || published }
  }

  saveThemeDraft(input, by) {
    return this.exclusive(() => {
      const { theme, issues } = cleanTheme(input)
      if (issues.length) throw new HttpError(422, 'Invalid theme settings', { issues: issues.map((m) => ({ level: 'error', code: 'theme', message: m })) })
      writeJson(this.p('drafts', 'theme.json'), { ...theme, updatedAt: nowIso(), by })
      return { theme, css: compileTheme(theme) }
    })
  }

  publishTheme(by) {
    return this.exclusive(() => {
      const draft = readJson(this.p('drafts', 'theme.json'), null)
      if (!draft) throw new HttpError(400, 'Nothing to publish: no theme draft')
      const { theme } = cleanTheme(draft)
      const file = path.join(this.root, 'assets', 'itwd', 'theme-tokens.css')
      this.snapshot('__theme', file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '', by, 'before theme publish', { theme: readJson(this.p('theme.json'), {}) })
      writeAtomic(file, compileTheme(theme))
      writeJson(this.p('theme.json'), theme)
      fs.rmSync(this.p('drafts', 'theme.json'), { force: true })
      this.audit(by, 'publish-theme', {})
      return { ok: true }
    })
  }

  // ---------------------------------------------------------------- CMS (structured content)

  dataFile(type) {
    return path.join(this.root, 'content', 'data', type + '.json')
  }

  getData(type) {
    if (!CMS_TYPES[type]) throw new HttpError(404, 'Unknown content type')
    const published = readJson(this.dataFile(type), null)
    const draft = readJson(this.p('drafts', 'data', type + '.json'), null)
    return { type, schema: CMS_TYPES[type], published, draft: draft?.data ?? null, version: draft?.version || 0, updatedAt: draft?.updatedAt || null }
  }

  saveDataDraft(type, body, by) {
    return this.exclusive(() => {
      if (!CMS_TYPES[type]) throw new HttpError(404, 'Unknown content type')
      const file = this.p('drafts', 'data', type + '.json')
      const cur = readJson(file, null)
      if (Number(body.version) !== (cur?.version || 0)) throw new HttpError(409, 'This content was saved elsewhere in the meantime.', { version: cur?.version || 0 })
      const issues = validateData(type, body.data, { root: this.root })
      if (issues.length) throw new HttpError(422, 'Please fix the highlighted fields.', { issues })
      const next = { version: (cur?.version || 0) + 1, data: body.data, updatedAt: nowIso(), by }
      writeJson(file, next)
      return { version: next.version, updatedAt: next.updatedAt }
    })
  }

  discardDataDraft(type) {
    return this.exclusive(() => {
      fs.rmSync(this.p('drafts', 'data', type + '.json'), { force: true })
      return { ok: true }
    })
  }

  publishData(type, by) {
    return this.exclusive(async () => {
      const draftFile = this.p('drafts', 'data', type + '.json')
      const draft = readJson(draftFile, null)
      if (!draft) throw new HttpError(400, 'Nothing to publish: no draft for ' + type)
      const issues = validateData(type, draft.data, { root: this.root })
      if (issues.length) throw new HttpError(422, 'Please fix the highlighted fields.', { issues })
      const dataFile = this.dataFile(type)
      const oldData = fs.readFileSync(dataFile, 'utf8')
      const files = affectedFiles(type, this.root, this.listPages())
      const backup = new Map(files.map((f) => [f, fs.existsSync(path.join(this.root, f)) ? fs.readFileSync(path.join(this.root, f), 'utf8') : null]))
      writeJson(dataFile, draft.data)
      let result
      try {
        result = await this.runRenderer(type)
      } catch (e) {
        writeAtomic(dataFile, oldData)
        for (const [f, html] of backup) if (html !== null) writeAtomic(path.join(this.root, f), html)
        throw new HttpError(500, 'Publishing failed and was rolled back: ' + e.message)
      }
      const batch = crypto.randomBytes(4).toString('hex')
      this.snapshot('__data-' + type, dataFile, oldData, by, 'before ' + type + ' publish', { batch })
      for (const f of result.changed) {
        const html = backup.get(f)
        if (html) this.snapshot(this.keyOf(f === 'index.html' ? '/' : '/' + f.replace(/\/index\.html$/, '')), path.join(this.root, f), html, by, 'before ' + type + ' publish', { batch })
      }
      fs.rmSync(draftFile, { force: true })
      this.audit(by, 'publish-data', { type, changed: result.changed, created: result.created })
      return { ok: true, ...result }
    })
  }

  runRenderer(type) {
    return new Promise((resolve, reject) => {
      const child = spawn(this.cfg.python, [path.join(this.root, 'scripts', 'cms_render.py'), type], { cwd: this.root, windowsHide: true })
      let out = ''
      let err = ''
      child.stdout.on('data', (d) => { out += d })
      child.stderr.on('data', (d) => { err += d })
      child.on('error', (e) => reject(new Error('could not start Python (' + this.cfg.python + '): ' + e.message)))
      child.on('close', (code) => {
        if (code !== 0) return reject(new Error((err || out || 'renderer exited with ' + code).trim().split('\n').slice(-3).join(' ')))
        try {
          resolve(JSON.parse(out.trim().split('\n').pop()))
        } catch {
          reject(new Error('unexpected renderer output'))
        }
      })
    })
  }

  // inline-text helper used by validation of CMS strings
  static textIssue(v) {
    return inlineTextIssue(v)
  }
}
