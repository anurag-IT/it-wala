import { HttpError } from './util.mjs'

const TABLE = 'itwd_cms_content'

export class SupabaseStore {
  constructor(config, fetcher = fetch) {
    this.url = String(config.supabaseUrl || '').replace(/\/+$/, '')
    this.key = config.supabaseServiceRoleKey || ''
    this.fetch = fetcher
  }

  get configured() {
    return Boolean(this.url && this.key)
  }

  get partiallyConfigured() {
    return Boolean(this.url || this.key) && !this.configured
  }

  async request(path, options = {}) {
    if (!this.configured) throw new HttpError(503, 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.admin.')
    let response
    try {
      response = await this.fetch(this.url + '/rest/v1/' + path, {
        ...options,
        headers: {
          apikey: this.key,
          Authorization: 'Bearer ' + this.key,
          ...(options.headers || {}),
        },
      })
    } catch (error) {
      throw new HttpError(502, 'Supabase request failed: ' + error.message)
    }
    const text = await response.text()
    if (!response.ok) {
      let detail = text
      try { detail = JSON.parse(text).message || text } catch { /* retain the response text */ }
      throw new HttpError(502, 'Supabase request failed (' + response.status + '): ' + detail)
    }
    return text ? JSON.parse(text) : null
  }

  upsert(type, data) {
    return this.request(TABLE + '?on_conflict=type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ type, data, updated_at: new Date().toISOString() }),
    })
  }

  async get(type) {
    const rows = await this.request(TABLE + '?type=eq.' + encodeURIComponent(type) + '&select=data&limit=1')
    return rows?.[0]?.data ?? null
  }

  insertIfMissing(type, data) {
    return this.request(TABLE + '?on_conflict=type', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: JSON.stringify({ type, data, updated_at: new Date().toISOString() }),
    })
  }

  async testConnection() {
    await this.request(TABLE + '?select=type&limit=1')
    return { ok: true }
  }
}
