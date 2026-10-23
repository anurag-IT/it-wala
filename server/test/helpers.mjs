// Test helpers: a throw-away copy of the real site + a running admin server + a tiny HTTP client.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from '../server.mjs'
import { hashPassword } from '../lib/auth.mjs'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
export const PASSWORD = 'correct-horse-battery-staple'

export function copySite() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'itwd-site-'))
  const copy = (rel) => {
    const src = path.join(REPO, rel)
    if (fs.existsSync(src)) fs.cpSync(src, path.join(tmp, rel), { recursive: true })
  }
  for (const rel of ['index.html', '404.html', 'about', 'contact', 'community', 'free-it-consultation', 'hackathon', 'plus-two',
    'programs', 'testimonials', 'scripts', 'admin', '_original', 'home-i-university', 'home-ii-online-education', 'about-us', 'contact-us', 'assets/itwd', 'college', 'mentor', 'content/data', 'content/theme.json']) copy(rel)
  fs.rmSync(path.join(tmp, 'scripts', '__pycache__'), { recursive: true, force: true })
  return tmp
}

export async function startServer(root) {
  const { server, site } = createServer({
    root, port: 0, host: '127.0.0.1', envFile: path.join(root, '.env.none'),
    env: { ADMIN_USERNAME: 'admin', ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), ADMIN_USERS: '' },
  })
  await new Promise((r) => server.listen(0, '127.0.0.1', r))
  const base = 'http://127.0.0.1:' + server.address().port
  return { server, site, base, close: () => new Promise((r) => server.close(r)) }
}

export function client(base) {
  let cookie = ''
  let csrf = ''
  async function req(method, url, body, { raw, headers = {}, noCsrf } = {}) {
    const h = { ...headers }
    if (cookie) h.Cookie = cookie
    if (csrf && !noCsrf && method !== 'GET') h['X-CSRF-Token'] = csrf
    let payload
    if (raw) payload = raw
    else if (body !== undefined) { h['Content-Type'] = 'application/json'; payload = JSON.stringify(body) }
    const res = await fetch(base + url, { method, headers: h, body: payload, redirect: 'manual' })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* html or text */ }
    return { status: res.status, json, text, headers: res.headers }
  }
  return {
    req,
    async login(password = PASSWORD) {
      const r = await req('POST', '/api/login', { username: 'admin', password })
      if (r.status === 200) csrf = r.json.csrf
      return r
    },
    forgetCsrf() { csrf = '' },
  }
}
