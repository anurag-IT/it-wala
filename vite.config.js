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

export default defineConfig({
  appType: 'mpa',
  server: { port: 3000 },
  plugins: [cleanUrls()],
})
