// IT Wala Dai — website + visual admin server (Node.js, no dependencies).
//   npm run admin                 start (reads .env.admin)
//   npm run admin:set-password    create/replace the admin login
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadConfig } from './lib/config.mjs'
import { Sessions, RateLimiter, authenticate, safeEqual } from './lib/auth.mjs'
import { HttpError, send, readBody, readJsonBody, parseCookies, MIME, readJson, writeJson, nowIso } from './lib/util.mjs'
import { Site } from './lib/site.mjs'
import { Media } from './lib/media.mjs'
import { securityIssues } from './lib/htmlsafe.mjs'
import { MANAGED_BLOCKS } from './lib/pages.mjs'
import { CMS_TYPES } from './lib/cms.mjs'
import { FONTS } from './lib/theme.mjs'

const BLOCKED_TOP = new Set(['content', 'server', 'scripts', 'node_modules', '.git', '.claude', 'it-wala', '_original', 'dist'])
const COOKIE = 'itwd_admin'
const ADMIN_CSP = "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com data:; script-src 'self'; connect-src 'self'; frame-src 'self' https://www.youtube-nocookie.com; " +
  "frame-ancestors 'self'; base-uri 'self'; form-action 'self'; object-src 'none'"

export function createServer(overrides = {}) {
  const cfg = loadConfig(overrides)
  const site = new Site(cfg)
  const media = new Media(site)
  const sessions = new Sessions({ idleMinutes: cfg.sessionIdleMinutes, maxHours: cfg.sessionMaxHours })
  const limiter = new RateLimiter({ max: 5, windowMs: 15 * 60 * 1000 })
  const adminDir = path.join(cfg.root, 'admin')

  const clientIp = (req) => (cfg.trustProxy && String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress || '?'
  const isHttps = (req) => cfg.cookieSecure || (cfg.trustProxy && req.headers['x-forwarded-proto'] === 'https')

  function sessionOf(req) {
    return sessions.get(parseCookies(req.headers.cookie)[COOKIE])
  }

  function requireAuth(req, { write = false } = {}) {
    const s = sessionOf(req)
    if (!s) throw new HttpError(401, 'Please log in again (session missing or expired).')
    if (write) {
      if (!safeEqual(req.headers['x-csrf-token'], s.csrf)) throw new HttpError(403, 'Security token missing or invalid. Reload the admin.')
      const origin = req.headers.origin
      if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Cross-site request blocked')
    }
    return s
  }

  // ------------------------------------------------------------ static files

  function serveFile(res, file, extraHeaders = {}) {
    const ext = path.extname(file).toLowerCase()
    const stat = fs.statSync(file)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      // HTML + the editor's own files always revalidate (a publish or an admin update shows up immediately)
      'Cache-Control': ext === '.html' || extraHeaders['Content-Security-Policy'] ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    })
    fs.createReadStream(file).pipe(res)
  }

  function serveStatic(req, res, pathname) {
    let p
    try { p = decodeURIComponent(pathname) } catch { return send(res, 400, 'Bad path') }
    const parts = p.split('/').filter(Boolean)
    if (parts.some((x) => x.startsWith('.')) || BLOCKED_TOP.has(parts[0])) return notFound(res)
    let file = path.join(cfg.root, p)
    if (!file.startsWith(cfg.root)) return notFound(res)
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      if (!pathname.endsWith('/') && fs.existsSync(path.join(file, 'index.html'))) file = path.join(file, 'index.html')
      else file = path.join(file, 'index.html')
    }
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return notFound(res)
    serveFile(res, file, parts[0] === 'admin' ? { 'Content-Security-Policy': ADMIN_CSP, 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin' } : {})
  }

  function notFound(res) {
    const f = path.join(cfg.root, '404.html')
    if (fs.existsSync(f)) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
      return fs.createReadStream(f).pipe(res)
    }
    send(res, 404, 'Not found')
  }

  // ------------------------------------------------------------ editor canvas / previews

  function canvasHtml(key, info) {
    let html = site.draftHtml(key)
    // keep every <script> in the document but inert, so the page DOM stays exactly what is saved
    html = html.replace(/<script\b([^>]*)>/gi, (m, attrs) => {
      const t = /\stype\s*=\s*(["'])(.*?)\1/i.exec(attrs)
      const rest = attrs.replace(/\stype\s*=\s*(["']).*?\1/i, '')
      return '<script data-itwd-type="' + (t ? t[2] : '__none__') + '" type="text/itwd-inert"' + rest + '>'
    })
    const boot = {
      key, route: info.route, managedPage: info.managedPage, managedBlocks: MANAGED_BLOCKS,
      fonts: Object.keys(FONTS),
    }
    const inject = '<link rel="stylesheet" href="/admin/canvas.css">\n' +
      '<script type="application/json" id="itwd-editor-boot">' + JSON.stringify(boot).replace(/</g, '\\u003c') + '</script>\n' +
      '<script src="/admin/canvas.js" defer></script>\n'
    return html.replace('</head>', () => inject + '</head>')
  }

  // ------------------------------------------------------------ API

  const routes = []
  const route = (method, pattern, handler) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), handler })
  const W = { write: true }

  route('POST', '/api/login', async (req, res) => {
    const origin = req.headers.origin
    if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Cross-site request blocked')
    const ip = clientIp(req)
    const gate = limiter.check(ip)
    if (!gate.allowed) throw new HttpError(429, 'Too many failed logins. Try again in ' + Math.ceil(gate.retryAfter / 60) + ' minutes.')
    if (!cfg.users.size) throw new HttpError(503, 'No admin account is configured yet. Run: npm run admin:set-password')
    const body = await readJsonBody(req, 4096)
    if (!authenticate(cfg.users, body.username, body.password)) {
      limiter.fail(ip)
      site.audit(String(body.username || '').slice(0, 60), 'login-failed', { ip })
      throw new HttpError(401, 'Wrong username or password.')
    }
    limiter.reset(ip)
    const s = sessions.create(body.username)
    site.audit(s.username, 'login', { ip })
    const cookie = COOKIE + '=' + s.id + '; Path=/; HttpOnly; SameSite=Strict' + (isHttps(req) ? '; Secure' : '')
    send(res, 200, { username: s.username, csrf: s.csrf }, { 'Set-Cookie': cookie })
  })

  route('POST', '/api/logout', async (req, res) => {
    const s = requireAuth(req, W)
    sessions.destroy(s.id)
    send(res, 200, { ok: true }, { 'Set-Cookie': COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' })
  })

  route('GET', '/api/session', async (req, res) => {
    const s = sessionOf(req)
    if (!s) return send(res, 401, { error: 'Not logged in', configured: cfg.users.size > 0 })
    send(res, 200, { username: s.username, csrf: s.csrf })
  })

  route('GET', '/api/pages', async (req, res) => { requireAuth(req); send(res, 200, { pages: site.listPages() }) })
  route('GET', '/api/pages/:key', async (req, res, p) => { requireAuth(req); send(res, 200, site.getState(p.key)) })
  route('PUT', '/api/pages/:key/draft', async (req, res, p) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.saveDraft(p.key, await readJsonBody(req, cfg.maxBodyBytes), s.username))
  })
  route('DELETE', '/api/pages/:key/draft', async (req, res, p) => { requireAuth(req, W); send(res, 200, await site.discardDraft(p.key)) })
  route('GET', '/api/pages/:key/validate', async (req, res, p) => { requireAuth(req); send(res, 200, site.validateDraft(p.key)) })
  route('POST', '/api/pages/:key/publish', async (req, res, p) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.publishPage(p.key, await readJsonBody(req, 4096), s.username))
  })
  route('GET', '/api/pages/:key/revisions', async (req, res, p) => { requireAuth(req); send(res, 200, { revisions: site.revisions(p.key) }) })
  route('POST', '/api/pages/:key/revisions/:id/restore', async (req, res, p) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.restore(p.key, p.id, s.username))
  })
  route('POST', '/api/pages/:key/duplicate', async (req, res, p) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.duplicatePage(p.key, await readJsonBody(req, 4096), s.username))
  })
  route('POST', '/api/pages/:key/publish-state', async (req, res, p) => {
    const s = requireAuth(req, W)
    const body = await readJsonBody(req, 1024)
    send(res, 200, await site.setPublished(p.key, Boolean(body.published), s.username))
  })

  route('PUT', '/api/global/draft', async (req, res) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.saveGlobalDraft(await readJsonBody(req, cfg.maxBodyBytes), s.username))
  })
  route('DELETE', '/api/global/draft', async (req, res) => { requireAuth(req, W); send(res, 200, await site.discardGlobalDraft()) })
  route('GET', '/api/global/validate', async (req, res) => { requireAuth(req); send(res, 200, site.validateGlobal()) })
  route('POST', '/api/global/publish', async (req, res) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.publishGlobal(await readJsonBody(req, 4096), s.username))
  })

  route('GET', '/api/theme', async (req, res) => { requireAuth(req); send(res, 200, { ...site.getTheme(), fonts: Object.keys(FONTS) }) })
  route('PUT', '/api/theme', async (req, res) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.saveThemeDraft(await readJsonBody(req, 16384), s.username))
  })
  route('DELETE', '/api/theme', async (req, res) => {
    requireAuth(req, W)
    fs.rmSync(path.join(cfg.contentDir, 'drafts', 'theme.json'), { force: true })
    send(res, 200, { ok: true })
  })
  route('POST', '/api/theme/publish', async (req, res) => { const s = requireAuth(req, W); send(res, 200, await site.publishTheme(s.username)) })

  route('GET', '/api/data', async (req, res) => {
    requireAuth(req)
    send(res, 200, { types: Object.entries(CMS_TYPES).map(([k, v]) => ({ type: k, label: v.label, note: v.note })) })
  })
  route('GET', '/api/data/:type', async (req, res, p) => { requireAuth(req); send(res, 200, site.getData(p.type)) })
  route('PUT', '/api/data/:type', async (req, res, p) => {
    const s = requireAuth(req, W)
    send(res, 200, await site.saveDataDraft(p.type, await readJsonBody(req, cfg.maxBodyBytes), s.username))
  })
  route('DELETE', '/api/data/:type', async (req, res, p) => { requireAuth(req, W); send(res, 200, await site.discardDataDraft(p.type)) })
  route('POST', '/api/data/:type/publish', async (req, res, p) => { const s = requireAuth(req, W); send(res, 200, await site.publishData(p.type, s.username)) })

  route('GET', '/api/media', async (req, res, p, url) => {
    requireAuth(req)
    send(res, 200, media.list({ q: url.searchParams.get('q') || '', type: url.searchParams.get('type') || '', folder: url.searchParams.get('folder') || '' }))
  })
  route('POST', '/api/media/upload', async (req, res) => {
    const s = requireAuth(req, W)
    const buf = await readBody(req, cfg.maxUploadBytes + 1)
    let name = 'image'
    try { name = decodeURIComponent(String(req.headers['x-file-name'] || 'image')) } catch { /* keep default */ }
    send(res, 200, await site.exclusive(() => media.upload(buf, name, s.username)))
  })
  route('POST', '/api/media/alt', async (req, res) => {
    requireAuth(req, W)
    const b = await readJsonBody(req, 4096)
    send(res, 200, await site.exclusive(() => media.setAlt(b.path, b.alt)))
  })
  route('POST', '/api/media/rename', async (req, res) => {
    const s = requireAuth(req, W)
    const b = await readJsonBody(req, 4096)
    send(res, 200, await site.exclusive(() => media.rename(b.path, b.name, s.username)))
  })
  route('POST', '/api/media/delete', async (req, res) => {
    const s = requireAuth(req, W)
    const b = await readJsonBody(req, 4096)
    send(res, 200, await site.exclusive(() => media.remove(b.path, s.username)))
  })

  const componentsFile = path.join(cfg.contentDir, 'components.json')
  route('GET', '/api/components', async (req, res) => { requireAuth(req); send(res, 200, { components: readJson(componentsFile, []) }) })
  route('POST', '/api/components', async (req, res) => {
    const s = requireAuth(req, W)
    const b = await readJsonBody(req, 2_000_000)
    const name = String(b.name || '').trim()
    if (!name || name.length > 80 || /[<>]/.test(name)) throw new HttpError(400, 'Enter a name (plain text)')
    if (typeof b.html !== 'string' || !b.html.trim() || b.html.length > 1_500_000) throw new HttpError(400, 'Nothing to save')
    // the section must exist on a published page (copied from the canvas); unsafe markup is refused
    const pageHtml = typeof b.fromKey === 'string' ? site.page(b.fromKey).html : ''
    const errors = securityIssues(b.html, pageHtml).filter((i) => i.level === 'error')
    if (errors.length) throw new HttpError(422, 'This section contains content that cannot be reused', { issues: errors })
    send(res, 200, await site.exclusive(() => {
      const list = readJson(componentsFile, [])
      const item = { id: Date.now().toString(36), name, html: b.html, createdAt: nowIso(), by: s.username }
      list.push(item)
      writeJson(componentsFile, list)
      return item
    }))
  })
  route('DELETE', '/api/components/:id', async (req, res, p) => {
    requireAuth(req, W)
    send(res, 200, await site.exclusive(() => {
      const list = readJson(componentsFile, [])
      writeJson(componentsFile, list.filter((c) => c.id !== p.id))
      return { ok: true }
    }))
  })

  // canvas (scripts inert, editor attached), live-like draft preview, revision preview
  route('GET', '/__admin/render/:key', async (req, res, p, url) => {
    if (!sessionOf(req)) return send(res, 302, '', { Location: '/admin/' })
    const { info } = site.page(p.key)
    const mode = url.searchParams.get('mode')
    const html = mode === 'edit' ? canvasHtml(p.key, info) : site.draftHtml(p.key).replace('</head>', () => '<meta name="robots" content="noindex">\n</head>')
    send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN' })
  })
  route('GET', '/__admin/revision/:key/:id', async (req, res, p) => {
    if (!sessionOf(req)) return send(res, 302, '', { Location: '/admin/' })
    send(res, 200, site.revision(p.key, p.id).html, { 'Content-Type': 'text/html; charset=utf-8', 'X-Frame-Options': 'SAMEORIGIN' })
  })

  // ------------------------------------------------------------ dispatcher

  async function handle(req, res) {
    const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'))
    const pathname = url.pathname
    try {
      if (pathname.startsWith('/api/') || pathname.startsWith('/__admin/')) {
        for (const r of routes) {
          if (r.method !== req.method) continue
          const m = r.re.exec(pathname)
          if (m) return await r.handler(req, res, Object.fromEntries(Object.entries(m.groups || {}).map(([k, v]) => [k, decodeURIComponent(v)])), url)
        }
        throw new HttpError(404, 'Unknown API route')
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed')
      if (pathname === '/admin') return send(res, 301, '', { Location: '/admin/' })
      return serveStatic(req, res, pathname)
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e)
      const status = e instanceof HttpError ? e.status : 500
      if (!res.headersSent) send(res, status, { error: e instanceof HttpError ? e.message : 'Server error', ...(e.details || {}) })
    }
  }

  const server = http.createServer((req, res) => { handle(req, res) })
  return { server, handle, cfg, site, sessions }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { server, cfg } = createServer()
  if (!cfg.users.size) console.warn('! No admin account yet. Run: npm run admin:set-password')
  server.listen(cfg.port, cfg.host, () => {
    console.log('IT Wala Dai website: http://' + cfg.host + ':' + cfg.port + '/')
    console.log('Visual admin:        http://' + cfg.host + ':' + cfg.port + '/admin/')
  })
}
