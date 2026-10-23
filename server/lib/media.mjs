// Media library: browse project images, real usage (which pages/CSS/data reference a file), dimensions, safe uploads,
// rename with reference updates, delete only when unused, alt-text metadata.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { HttpError, readJson, writeJson, writeAtomic, ensureDir } from './util.mjs'

export const MEDIA_DIRS = ['assets/itwd', 'assets/uploads', 'college', 'mentor', 'app section', 'wp-content/uploads']
const EDITABLE_DIRS = ['assets/itwd', 'assets/uploads', 'college', 'mentor']   // rename/delete allowed (not theme files)
const IMG_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.svg'])

export function imageSize(buf) {
  try {
    if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    if (buf.toString('ascii', 0, 3) === 'GIF') return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
    if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const chunk = buf.toString('ascii', 12, 16)
      if (chunk === 'VP8X') return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) }
      if (chunk === 'VP8 ') return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
      if (chunk === 'VP8L') {
        const b = buf.readUInt32LE(21)
        return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 }
      }
    }
    if (buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2
      while (i < buf.length) {
        if (buf[i] !== 0xff) { i++; continue }
        const marker = buf[i + 1]
        const len = buf.readUInt16BE(i + 2)
        if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) }
        i += 2 + len
      }
    }
    if (buf.toString('ascii', 4, 12) === 'ftypavif') return { width: null, height: null }
    const head = buf.toString('utf8', 0, Math.min(buf.length, 4096))
    if (/<svg/i.test(head)) {
      const w = /\bwidth="([\d.]+)/.exec(head)
      const h = /\bheight="([\d.]+)/.exec(head)
      const vb = /viewBox="[\d.\s-]+?([\d.]+)\s+([\d.]+)"/.exec(head)
      return { width: w ? Math.round(w[1]) : vb ? Math.round(vb[1]) : null, height: h ? Math.round(h[1]) : vb ? Math.round(vb[2]) : null }
    }
  } catch { /* unreadable header */ }
  return { width: null, height: null }
}

// what kind of image a buffer really is (by content, not by the name the browser sent)
export function sniffImage(buf) {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf.toString('ascii', 1, 4) === 'PNG') return 'png'
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  if (buf.toString('ascii', 0, 6) === 'GIF87a' || buf.toString('ascii', 0, 6) === 'GIF89a') return 'gif'
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp'
  if (buf.toString('ascii', 4, 12) === 'ftypavif') return 'avif'
  return null
}

export class Media {
  constructor(site) {
    this.site = site
    this.root = site.root
  }

  metaFile() {
    return path.join(this.site.dir, 'media.json')
  }

  urlOf(rel) {
    return '/' + rel.split('/').map(encodeURIComponent).join('/').replace(/%40/g, '@')
  }

  /** every text file that can reference an image: site pages, our CSS, CMS data and drafts */
  referenceSources() {
    const files = this.site.listPages().map((p) => (p.file ? path.join(this.root, p.file) : path.join(this.site.dir, 'unpublished', p.key + '.html')))
    for (const f of ['assets/itwd/itwd.css', 'assets/itwd/editor-global.css', 'assets/itwd/theme-tokens.css']) files.push(path.join(this.root, f))
    const add = (dir) => { if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir)) if (f.endsWith('.json')) files.push(path.join(dir, f)) }
    add(path.join(this.root, 'content', 'data'))
    add(path.join(this.site.dir, 'drafts', 'pages'))
    add(path.join(this.site.dir, 'drafts', 'data'))
    files.push(path.join(this.site.dir, 'drafts', 'global.json'), path.join(this.site.dir, 'components.json'))
    return files.filter((f) => fs.existsSync(f))
  }

  usageIndex() {
    const sources = this.referenceSources().map((f) => ({ f: path.relative(this.root, f).split(path.sep).join('/'), text: fs.readFileSync(f, 'utf8') }))
    return (rel) => {
      const raw = '/' + rel
      const enc = this.urlOf(rel)
      const base = path.basename(rel)
      const json = raw.replace(/\//g, '\\/')
      return sources.filter((s) => s.text.includes(raw) || s.text.includes(enc) || s.text.includes(json) ||
        (rel.startsWith('assets/itwd/') && s.f.endsWith('.css') && s.text.includes(base))).map((s) => s.f)
    }
  }

  list({ q = '', type = '', folder = '' } = {}) {
    const meta = readJson(this.metaFile(), {})
    const used = this.usageIndex()
    const items = []
    for (const dir of MEDIA_DIRS) {
      const abs = path.join(this.root, dir)
      if (!fs.existsSync(abs)) continue
      const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, e.name)
          if (e.isDirectory()) { walk(full); continue }
          const ext = path.extname(e.name).toLowerCase()
          if (!IMG_EXT.has(ext)) continue
          const rel = path.relative(this.root, full).split(path.sep).join('/')
          if (q && !rel.toLowerCase().includes(q.toLowerCase())) continue
          if (type && ext.slice(1) !== type && !(type === 'jpg' && ext === '.jpeg')) continue
          if (folder && !rel.startsWith(folder + '/')) continue
          const stat = fs.statSync(full)
          const fd = fs.openSync(full, 'r')
          const head = Buffer.alloc(Math.min(stat.size, 65536))
          fs.readSync(fd, head, 0, head.length, 0)
          fs.closeSync(fd)
          const usedBy = used(rel)
          items.push({
            path: rel, url: this.urlOf(rel), folder: dir, name: e.name, ext: ext.slice(1), size: stat.size,
            ...imageSize(head), modified: stat.mtime.toISOString(), alt: meta[rel]?.alt || '',
            usedBy, editable: EDITABLE_DIRS.some((x) => rel.startsWith(x + '/')),
          })
        }
      }
      walk(abs)
    }
    items.sort((a, b) => b.modified.localeCompare(a.modified))
    return { items, folders: MEDIA_DIRS }
  }

  setAlt(rel, alt) {
    if (typeof alt !== 'string' || alt.length > 300 || /[<>]/.test(alt)) throw new HttpError(400, 'Alt text must be plain text (max 300)')
    this.assertKnown(rel)
    const meta = readJson(this.metaFile(), {})
    meta[rel] = { ...(meta[rel] || {}), alt: alt.trim() }
    writeJson(this.metaFile(), meta)
    return { ok: true }
  }

  assertKnown(rel) {
    const clean = path.posix.normalize(String(rel || ''))
    if (clean.startsWith('..') || !MEDIA_DIRS.some((d) => clean.startsWith(d + '/'))) throw new HttpError(400, 'Not a media file')
    if (!fs.existsSync(path.join(this.root, clean))) throw new HttpError(404, 'File not found')
    return clean
  }

  upload(buf, originalName, by) {
    if (!buf.length) throw new HttpError(400, 'Empty file')
    if (buf.length > this.site.cfg.maxUploadBytes) throw new HttpError(413, 'Image is larger than ' + Math.round(this.site.cfg.maxUploadBytes / 1048576) + ' MB')
    const kind = sniffImage(buf)
    if (!kind) throw new HttpError(415, 'Only PNG, JPG, WebP, GIF and AVIF images can be uploaded (SVG is not accepted for security reasons).')
    const base = path.basename(String(originalName || 'image')).replace(/\.[^.]*$/, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image'
    const month = new Date().toISOString().slice(0, 7)
    const rel = 'assets/uploads/' + month + '/' + base + '-' + crypto.randomBytes(3).toString('hex') + '.' + kind
    ensureDir(path.join(this.root, path.dirname(rel)))
    fs.writeFileSync(path.join(this.root, rel), buf, { flag: 'wx' })
    this.site.audit(by, 'upload', { path: rel, bytes: buf.length })
    return { path: rel, url: this.urlOf(rel), ...imageSize(buf), size: buf.length }
  }

  rename(rel, newName, by) {
    const from = this.assertKnown(rel)
    if (!EDITABLE_DIRS.some((x) => from.startsWith(x + '/'))) throw new HttpError(403, 'Theme files cannot be renamed')
    const ext = path.extname(from)
    const base = String(newName || '').replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    if (!base) throw new HttpError(400, 'Enter a new name')
    const to = path.posix.join(path.posix.dirname(from), base + ext)
    if (fs.existsSync(path.join(this.root, to))) throw new HttpError(409, 'A file with that name already exists')
    // update every reference first (pages, CSS, CMS data, drafts), then move the file
    const variants = [['/' + from, '/' + to], [this.urlOf(from), this.urlOf(to)], [('/' + from).replace(/\//g, '\\/'), ('/' + to).replace(/\//g, '\\/')]]
    const changed = []
    for (const f of this.referenceSources()) {
      const text = fs.readFileSync(f, 'utf8')
      let next = text
      for (const [a, b] of variants) next = next.split(a).join(b)
      if (next !== text) {
        writeAtomic(f, next)
        changed.push(path.relative(this.root, f).split(path.sep).join('/'))
      }
    }
    fs.renameSync(path.join(this.root, from), path.join(this.root, to))
    const meta = readJson(this.metaFile(), {})
    if (meta[from]) { meta[to] = meta[from]; delete meta[from]; writeJson(this.metaFile(), meta) }
    this.site.audit(by, 'rename-media', { from, to, changed })
    return { path: to, url: this.urlOf(to), updatedReferences: changed }
  }

  remove(rel, by) {
    const file = this.assertKnown(rel)
    if (!EDITABLE_DIRS.some((x) => file.startsWith(x + '/'))) throw new HttpError(403, 'Theme files cannot be deleted from the admin')
    const usedBy = this.usageIndex()(file)
    if (usedBy.length) throw new HttpError(409, 'This image is still used and was not deleted.', { usedBy })
    fs.rmSync(path.join(this.root, file))
    this.site.audit(by, 'delete-media', { path: file })
    return { ok: true }
  }
}
