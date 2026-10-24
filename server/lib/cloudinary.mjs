import crypto from 'node:crypto'
import https from 'node:https'
import { HttpError } from './util.mjs'

function signature(params, secret) {
  const values = Object.keys(params).sort().map((key) => key + '=' + params[key]).join('&')
  return crypto.createHash('sha1').update(values + secret).digest('hex')
}

export class CloudinaryStore {
  constructor(config, fetcher = fetch) {
    this.cloudName = config.cloudName || ''
    this.apiKey = config.apiKey || ''
    this.apiSecret = config.apiSecret || ''
    this.fetch = fetcher
  }

  get configured() {
    return Boolean(this.cloudName && this.apiKey && this.apiSecret)
  }

  get partiallyConfigured() {
    return Boolean(this.cloudName || this.apiKey || this.apiSecret) && !this.configured
  }

  async upload(buffer, { publicId, contentType = 'application/octet-stream', overwrite = true }) {
    if (!this.configured) throw new HttpError(503, 'Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.admin.')
    const params = { overwrite: String(overwrite), public_id: publicId, timestamp: String(Math.floor(Date.now() / 1000)) }
    const form = new FormData()
    for (const [key, value] of Object.entries(params)) form.set(key, value)
    form.set('api_key', this.apiKey)
    form.set('signature', signature(params, this.apiSecret))
    form.set('file', new Blob([buffer], { type: contentType }), publicId.split('/').pop())
    let response
    try {
      response = await this.fetch('https://api.cloudinary.com/v1_1/' + encodeURIComponent(this.cloudName) + '/image/upload', {
        method: 'POST',
        body: form,
      })
    } catch (error) {
      throw new HttpError(502, 'Cloudinary upload failed: ' + error.message)
    }
    const text = await response.text()
    let result
    try { result = text ? JSON.parse(text) : {} } catch { result = {} }
    if (!response.ok) {
      throw new HttpError(502, 'Cloudinary upload failed (' + response.status + '): ' + (result.error?.message || text || 'Unknown response'))
    }
    if (typeof result.secure_url !== 'string' || !result.secure_url.startsWith('https://res.cloudinary.com/')) {
      throw new HttpError(502, 'Cloudinary returned an invalid secure image URL.')
    }
    return { secureUrl: result.secure_url, publicId: result.public_id }
  }

  testConnection() {
    if (!this.configured) throw new HttpError(503, 'Cloudinary is not configured.')
    const credentials = Buffer.from(this.apiKey + ':' + this.apiSecret).toString('base64')
    return new Promise((resolve, reject) => {
      const req = https.request({
        hostname: 'api.cloudinary.com',
        port: 443,
        path: '/v1_1/' + encodeURIComponent(this.cloudName) + '/resources/image?max_results=1',
        method: 'GET',
        headers: { Authorization: 'Basic ' + credentials, 'User-Agent': 'Mozilla/5.0' },
      }, (res) => {
        res.resume() // drain the response body
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ ok: true })
        } else {
          reject(new HttpError(502, 'Cloudinary connection failed (' + res.statusCode + '). Check the cloud name and API credentials.'))
        }
      })
      req.on('error', (err) => reject(new HttpError(502, 'Cloudinary connection failed: ' + err.message)))
      req.end()
    })
  }
}
