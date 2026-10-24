import fs from 'node:fs'
import path from 'node:path'
import { loadConfig } from '../lib/config.mjs'
import { CMS_TYPES } from '../lib/cms.mjs'
import { readJson } from '../lib/util.mjs'
import { SupabaseStore } from '../lib/supabase.mjs'

const cfg = loadConfig()
const store = new SupabaseStore(cfg)
if (!store.configured) throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.admin before running this command.')

let imported = 0
for (const type of Object.keys(CMS_TYPES)) {
  const file = path.join(cfg.root, 'content', 'data', type + '.json')
  if (!fs.existsSync(file)) continue
  await store.insertIfMissing(type, readJson(file, null))
  imported++
}
console.log('Supabase import complete. Existing rows were left unchanged; local content files were not modified. Rows checked: ' + imported)
