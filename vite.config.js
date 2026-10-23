import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'

// Serve clean URLs like /programs -> /programs/index.html (static multi-page site)
const cleanUrls = () => ({
  name: 'clean-urls',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [pathname, query] = req.url.split('?')
      if (!path.extname(pathname)) {
        const dir = path.join(server.config.root, decodeURIComponent(pathname))
        if (fs.existsSync(path.join(dir, 'index.html'))) {
          req.url = pathname.replace(/\/?$/, '/index.html') + (query ? `?${query}` : '')
        }
      }
      next()
    })
  },
})

// The mirrored WordPress theme/plugin files (/wp-content, /wp-includes) are already-minified classic scripts and
// stylesheets. Without this, Vite's dev server transforms every one of them and appends an inline source map
// (three.js 1.1 MB -> 6 MB, ~16 MB of JS/CSS per page), which made first page loads slow or incomplete until a
// refresh hit Vite's cache. Serve them exactly as they are on disk instead (the same bytes a static host serves).
const RAW_PREFIXES = ['/wp-content/', '/wp-includes/']
const RAW_TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }
const rawLegacyAssets = () => ({
  name: 'raw-legacy-assets',
  configureServer(server) {
    const root = path.resolve(server.config.root)
    server.middlewares.use((req, res, next) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') return next()
      let pathname
      try { pathname = decodeURIComponent(req.url.split('?')[0]) } catch { return next() }
      const type = RAW_TYPES[path.extname(pathname)]
      if (!type || !RAW_PREFIXES.some((p) => pathname.startsWith(p))) return next()
      const file = path.join(root, pathname)
      if (!file.startsWith(root) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return next()
      const stat = fs.statSync(file)
      const etag = `W/"${stat.size}-${stat.mtimeMs}"`
      res.setHeader('Content-Type', type)
      res.setHeader('ETag', etag)
      res.setHeader('Cache-Control', 'no-cache')
      if (req.headers['if-none-match'] === etag) { res.statusCode = 304; return res.end() }
      res.setHeader('Content-Length', stat.size)
      if (req.method === 'HEAD') return res.end()
      fs.createReadStream(file).pipe(res)
    })
  },
})

// Visual admin (/admin) runs inside this dev server: no second server or port needed.
// /admin/*, /api/* and /__admin/* go to server/server.mjs (login, drafts, publish); everything else stays Vite.
const ADMIN_PREFIXES = ['/admin', '/api', '/__admin']
const visualAdmin = () => {
  let handle = null
  const mount = (middlewares, root) => {
    middlewares.use(async (req, res, next) => {
      const pathname = req.url.split('?')[0]
      if (!ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'))) return next()
      if (!handle) {
        const { createServer } = await import('./server/server.mjs')
        const admin = createServer({ root })
        if (!admin.cfg.users.size) console.warn('\n! /admin has no login yet. Run: npm run admin:set-password -- --shared\n')
        handle = admin.handle
      }
      handle(req, res)
    })
  }
  return {
    name: 'itwd-visual-admin',
    configureServer(server) { mount(server.middlewares, path.resolve(server.config.root)) },
    configurePreviewServer(server) { mount(server.middlewares, path.resolve(server.config.root)) },
  }
}

export default defineConfig({
  appType: 'mpa',
  server: {
    port: 3000,
    // Vite's defaults + the admin's private working data (audit log, drafts, revisions, unpublished pages)
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/content/private/**', '**/content/drafts/**',
      '**/content/revisions/**', '**/content/unpublished/**'] },
    // admin autosaves and revisions are not site files: don't trigger page reloads for them
    watch: { ignored: ['**/content/drafts/**', '**/content/revisions/**', '**/content/private/**', '**/content/published/**'] },
  },
  plugins: [visualAdmin(), cleanUrls(), rawLegacyAssets()],
})
