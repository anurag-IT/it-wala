import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import { SupabaseStore } from '../lib/supabase.mjs'
import { CloudinaryStore } from '../lib/cloudinary.mjs'

test('Supabase CMS writes use service credentials and update only the requested record', async () => {
  let request
  const store = new SupabaseStore({
    supabaseUrl: 'https://project.supabase.co/',
    supabaseServiceRoleKey: 'server-only-secret',
  }, async (url, options) => {
    request = { url, options }
    return new Response(null, { status: 204 })
  })

  await store.upsert('faqs', [{ q: 'Question', a: 'Answer' }])
  assert.equal(request.url, 'https://project.supabase.co/rest/v1/itwd_cms_content?on_conflict=type')
  assert.equal(request.options.method, 'POST')
  assert.equal(request.options.headers.apikey, 'server-only-secret')
  assert.equal(request.options.headers.Authorization, 'Bearer server-only-secret')
  assert.match(request.options.headers.Prefer, /resolution=merge-duplicates/)
  assert.deepEqual(JSON.parse(request.options.body), {
    type: 'faqs',
    data: [{ q: 'Question', a: 'Answer' }],
    updated_at: JSON.parse(request.options.body).updated_at,
  })
})

test('initial Supabase import ignores existing records', async () => {
  let prefer
  const store = new SupabaseStore({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'server-only-secret',
  }, async (_url, options) => {
    prefer = options.headers.Prefer
    return new Response(null, { status: 204 })
  })
  await store.insertIfMissing('courses', [])
  assert.match(prefer, /resolution=ignore-duplicates/)
})

test('Supabase CMS reads return the stored published record', async () => {
  const store = new SupabaseStore({
    supabaseUrl: 'https://project.supabase.co',
    supabaseServiceRoleKey: 'server-only-secret',
  }, async (url) => {
    assert.match(url, /itwd_cms_content\?type=eq\.courses&select=data&limit=1$/)
    return Response.json([{ data: [{ name: 'Cloud course' }] }])
  })
  assert.deepEqual(await store.get('courses'), [{ name: 'Cloud course' }])
})

test('Cloudinary uploads are signed and return only secure delivery URLs', async () => {
  let request
  const store = new CloudinaryStore({
    cloudName: 'demo-cloud',
    apiKey: 'api-key',
    apiSecret: 'api-secret',
  }, async (url, options) => {
    request = { url, options }
    return Response.json({ secure_url: 'https://res.cloudinary.com/demo-cloud/image/upload/sample.png', public_id: 'it-wala/sample' })
  })

  const result = await store.upload(Buffer.from('image-bytes'), { publicId: 'it-wala/sample', contentType: 'image/png' })
  assert.equal(request.url, 'https://api.cloudinary.com/v1_1/demo-cloud/image/upload')
  const form = request.options.body
  const params = {
    overwrite: form.get('overwrite'),
    public_id: form.get('public_id'),
    timestamp: form.get('timestamp'),
  }
  const canonical = Object.keys(params).sort().map((key) => key + '=' + params[key]).join('&')
  const expected = crypto.createHash('sha1').update(canonical + 'api-secret').digest('hex')
  assert.equal(form.get('signature'), expected)
  assert.equal(form.get('api_key'), 'api-key')
  assert.equal(form.get('file').type, 'image/png')
  assert.deepEqual(result, {
    secureUrl: 'https://res.cloudinary.com/demo-cloud/image/upload/sample.png',
    publicId: 'it-wala/sample',
  })
})

test('partial service credentials are detected instead of silently falling back', () => {
  assert.equal(new SupabaseStore({ supabaseUrl: 'https://project.supabase.co' }).partiallyConfigured, true)
  assert.equal(new CloudinaryStore({ cloudName: 'demo-cloud' }).partiallyConfigured, true)
})
