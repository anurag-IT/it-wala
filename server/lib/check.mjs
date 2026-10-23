// Pre-publish checks: broken internal links, missing images, empty image sources, links without a name.
// Problems the draft INTRODUCES are errors (publishing is blocked); problems that already exist on the live page are
// reported as warnings so the editor can still publish unrelated changes.
import fs from 'node:fs'
import path from 'node:path'
import { scanTags, unsafeUrl } from './htmlsafe.mjs'

export function makeResolver(root) {
  const cache = new Map()
  return function exists(urlPath) {
    let p = String(urlPath).split('#')[0].split('?')[0]
    if (!p) return true
    try { p = decodeURIComponent(p) } catch { return false }
    if (cache.has(p)) return cache.get(p)
    const abs = path.join(root, p)
    let ok = false
    if (abs.startsWith(root)) {
      if (!path.extname(p)) ok = fs.existsSync(path.join(abs, 'index.html')) || (fs.existsSync(abs) && fs.statSync(abs).isFile())
      else ok = fs.existsSync(abs) && fs.statSync(abs).isFile()
    }
    cache.set(p, ok)
    return ok
  }
}

function refs(html) {
  const out = { links: [], images: [], emptyImages: 0, unnamedLinks: 0, anchors: new Set() }
  const tags = scanTags(html)
  for (const t of tags) {
    const a = Object.fromEntries(t.attrs)
    if (a.id) out.anchors.add(a.id)
    if (t.name === 'a') {
      if (a.href && !a.href.startsWith('mailto:') && !a.href.startsWith('tel:')) out.links.push(a.href)
    }
    if (t.name === 'img') {
      if (!a.src || !a.src.trim()) out.emptyImages++
      else out.images.push(a.src)
      if (a.srcset) for (const part of a.srcset.split(',')) out.images.push(part.trim().split(/\s+/)[0])
    }
    if (a['data-bg-src']) out.images.push(a['data-bg-src'])
  }
  // links whose visible text is empty and that have no aria-label / title / img alt
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const attrs = m[1]
    const inner = m[2]
    if (/aria-label=|title=/.test(attrs)) continue
    if (inner.replace(/<[^>]*>/g, '').trim()) continue
    if (/<img[^>]*alt="[^"]+"/.test(inner)) continue
    if (/is-disabled/.test(attrs)) continue
    out.unnamedLinks++
  }
  return out
}

/**
 * @param {string} next   draft HTML (the regions being published)
 * @param {string} prev   the same regions as currently published
 * @param {(p:string)=>boolean} exists   internal path resolver
 * @param {string} pageHtml   whole draft page (for #anchor checks)
 */
export function checkContent(next, prev, exists, pageHtml = next) {
  const issues = []
  const n = refs(next)
  const p = refs(prev)
  const pageAnchors = refs(pageHtml).anchors
  const internal = (u) => u.startsWith('/') && !u.startsWith('//')
  const brokenPrev = new Set([...p.links, ...p.images].filter((u) => internal(u) && !exists(u)))
  const seen = new Set()
  for (const u of n.links) {
    if (seen.has('l' + u)) continue
    seen.add('l' + u)
    if (unsafeUrl(u, 'href')) issues.push({ level: 'error', code: 'unsafe-link', message: 'Unsafe link: ' + u.slice(0, 80) })
    else if (internal(u) && !exists(u)) {
      issues.push({ level: brokenPrev.has(u) ? 'warning' : 'error', code: 'broken-link', message: 'Link to a page that does not exist: ' + u })
    } else if (u.startsWith('#') && u.length > 1 && !pageAnchors.has(u.slice(1)) && u !== '#start-project') {
      issues.push({ level: 'warning', code: 'missing-anchor', message: 'Link to a section id that is not on this page: ' + u })
    }
  }
  for (const u of n.images) {
    if (seen.has('i' + u)) continue
    seen.add('i' + u)
    if (internal(u) && !exists(u)) {
      issues.push({ level: brokenPrev.has(u) ? 'warning' : 'error', code: 'missing-image', message: 'Image file not found: ' + u })
    }
  }
  if (n.emptyImages > p.emptyImages) issues.push({ level: 'error', code: 'empty-image', message: n.emptyImages - p.emptyImages + ' image(s) without a source' })
  if (n.unnamedLinks > p.unnamedLinks) {
    issues.push({ level: 'warning', code: 'unnamed-link', message: n.unnamedLinks - p.unnamedLinks + ' new link(s)/button(s) without visible text or label' })
  }
  return issues
}
