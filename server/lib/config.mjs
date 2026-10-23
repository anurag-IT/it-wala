// IT Wala Dai admin server — configuration (paths, environment, limits).
// Secrets are read from `.env.admin` (git-ignored, created by `npm run admin:set-password`) or the real environment.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(here, '..', '..')

function readEnvFile(file) {
  const out = {}
  if (!fs.existsSync(file)) return out
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const i = line.indexOf('=')
    if (i < 1) continue
    let v = line.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    out[line.slice(0, i).trim()] = v
  }
  return out
}

export function loadConfig(overrides = {}) {
  const root = path.resolve(overrides.root || process.env.ITWD_ROOT || DEFAULT_ROOT)
  const envFile = overrides.envFile || process.env.ITWD_ENV_FILE || path.join(root, '.env.admin')
  const env = { ...readEnvFile(envFile), ...process.env, ...(overrides.env || {}) }
  const contentDir = path.resolve(overrides.contentDir || env.ITWD_CONTENT_DIR || path.join(root, 'content'))
  return {
    root,
    envFile,
    contentDir,
    port: Number(overrides.port ?? env.ADMIN_PORT ?? 4000),
    host: overrides.host || env.ADMIN_HOST || '127.0.0.1',
    python: env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3'),
    // "user:scrypt$..." pairs separated by commas, or ADMIN_USERNAME + ADMIN_PASSWORD_HASH
    users: parseUsers(env, path.join(root, 'server', 'admin-account.json')),
    cookieSecure: env.COOKIE_SECURE === '1',
    sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES || 120),
    sessionMaxHours: Number(env.SESSION_MAX_HOURS || 12),
    maxUploadBytes: Number(env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
    maxBodyBytes: 6 * 1024 * 1024,
    trustProxy: env.TRUST_PROXY === '1',
  }
}

function parseUsers(env, sharedFile) {
  const users = new Map()
  if (env.ADMIN_USERNAME && env.ADMIN_PASSWORD_HASH) users.set(env.ADMIN_USERNAME, env.ADMIN_PASSWORD_HASH)
  for (const pair of (env.ADMIN_USERS || '').split(',').map((s) => s.trim()).filter(Boolean)) {
    const i = pair.indexOf(':')
    if (i > 0) users.set(pair.slice(0, i), pair.slice(i + 1))
  }
  // shared team login (server/admin-account.json, committed, hash only) when no private account is configured
  if (!users.size && sharedFile && fs.existsSync(sharedFile)) {
    try {
      const a = JSON.parse(fs.readFileSync(sharedFile, 'utf8'))
      if (a.username && String(a.passwordHash).startsWith('scrypt$')) users.set(a.username, a.passwordHash)
    } catch { /* ignore a broken file: no account */ }
  }
  return users
}
