import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { Site } from '../lib/site.mjs'
import { Media } from '../lib/media.mjs'
import { CloudinaryStore } from '../lib/cloudinary.mjs'
import { sniffImage } from '../lib/media.mjs'

const cfg = loadConfig()
const cloudinary = new CloudinaryStore(cfg)
if (!cloudinary.configured) throw new Error('Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env.admin before running this command.')

const media = new Media(new Site(cfg))
const items = media.list().items
let uploaded = 0
let skipped = 0
for (const item of items) {
  const file = path.join(cfg.root, item.path)
  const buffer = fs.readFileSync(file)
  const kind = sniffImage(buffer)
  if (!kind) { skipped++; continue }
  if (item.cloudUrl) { skipped++; continue }
  const publicId = 'it-wala/migrated/' + item.path.replace(/\.[^.]+$/, '').replace(/\\/g, '/')
  const contentType = ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' })[kind]
  const result = await cloudinary.upload(buffer, { publicId, contentType })
  media.setCloudUrl(item.path, result.secureUrl)
  uploaded++
  console.log('Copied ' + item.path)
}
console.log('Cloudinary copy complete. Uploaded: ' + uploaded + '; skipped: ' + skipped + '. All local originals and existing page references were preserved.')
