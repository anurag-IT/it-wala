// Authentication: scrypt password hashes, server-side sessions (HttpOnly cookie), CSRF tokens, login rate limiting.
import crypto from 'node:crypto'

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 }

export function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 10) throw new Error('Password must be at least 10 characters')
  const salt = crypto.randomBytes(16)
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$')
}

export function verifyPassword(password, stored) {
  try {
    const [algo, N, r, p, saltB64, hashB64] = String(stored).split('$')
    if (algo !== 'scrypt') return false
    const expected = Buffer.from(hashB64, 'base64')
    const actual = crypto.scryptSync(String(password), Buffer.from(saltB64, 'base64'), expected.length,
      { N: Number(N), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024 })
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}

// A real hash of a random secret: used to spend the same time when the username is unknown (no user enumeration).
const DUMMY_HASH = hashPassword(crypto.randomBytes(24).toString('hex'))

export class Sessions {
  constructor({ idleMinutes = 120, maxHours = 12 } = {}) {
    this.idleMs = idleMinutes * 60 * 1000
    this.maxMs = maxHours * 3600 * 1000
    this.map = new Map()
  }

  create(username) {
    const id = crypto.randomBytes(32).toString('base64url')
    const now = Date.now()
    const s = { id, username, csrf: crypto.randomBytes(24).toString('base64url'), created: now, seen: now }
    this.map.set(id, s)
    return s
  }

  get(id) {
    if (!id) return null
    const s = this.map.get(id)
    if (!s) return null
    const now = Date.now()
    if (now - s.seen > this.idleMs || now - s.created > this.maxMs) {
      this.map.delete(id)
      return null
    }
    s.seen = now
    return s
  }

  destroy(id) {
    this.map.delete(id)
  }
}

export class RateLimiter {
  constructor({ max = 5, windowMs = 15 * 60 * 1000 } = {}) {
    this.max = max
    this.windowMs = windowMs
    this.hits = new Map()
  }

  check(key) {
    const now = Date.now()
    const list = (this.hits.get(key) || []).filter((t) => now - t < this.windowMs)
    this.hits.set(key, list)
    return { allowed: list.length < this.max, retryAfter: list.length ? Math.ceil((this.windowMs - (now - list[0])) / 1000) : 0 }
  }

  fail(key) {
    const list = this.hits.get(key) || []
    list.push(Date.now())
    this.hits.set(key, list)
  }

  reset(key) {
    this.hits.delete(key)
  }
}

export function authenticate(users, username, password) {
  const stored = users.get(String(username || ''))
  const ok = verifyPassword(password, stored || DUMMY_HASH)
  return Boolean(stored) && ok
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''))
  const y = Buffer.from(String(b || ''))
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y)
}
