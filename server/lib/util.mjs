// Small shared helpers: atomic file writes, JSON IO, HTTP responses and request bodies.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true })
}

// write to a temp file in the same folder, then rename: readers never see a half-written file
export function writeAtomic(file, data) {
  ensureDir(path.dirname(file))
  const tmp = path.join(path.dirname(file), '.' + path.basename(file) + '.' + crypto.randomBytes(6).toString('hex') + '.tmp')
  fs.writeFileSync(tmp, data)
  fs.renameSync(tmp, file)
}

export function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (e) {
    if (e.code === 'ENOENT') return fallback
    throw e
  }
}

export function writeJson(file, value) {
  writeAtomic(file, JSON.stringify(value, null, 2) + '\n')
}

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex')

export function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body)
  const payload = isJson ? JSON.stringify(body) : body
  res.writeHead(status, {
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers,
  })
  res.end(payload)
}

export function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (c) => {
      size += c.length
      if (size > limit) {
        reject(new HttpError(413, 'Request body too large'))
        req.destroy()
        return
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

export async function readJsonBody(req, limit) {
  const type = req.headers['content-type'] || ''
  if (!type.includes('application/json')) throw new HttpError(415, 'Expected application/json')
  const buf = await readBody(req, limit)
  try {
    return JSON.parse(buf.toString('utf8') || '{}')
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

export function parseCookies(header) {
  const out = {}
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

export const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject', '.otf': 'font/otf', '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.pdf': 'application/pdf',
}

export function nowIso() {
  return new Date().toISOString()
}
