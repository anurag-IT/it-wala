// End-to-end tests of the admin API against a temporary copy of the site.  npm test
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { copySite, startServer, client } from './helpers.mjs'
import { getRegions } from '../lib/pages.mjs'
import { securityIssues, cleanStyleModel, compileStyles } from '../lib/htmlsafe.mjs'

let root, srv, c

before(async () => {
  root = copySite()
  srv = await startServer(root)
  c = client(srv.base)
})
after(async () => {
  await srv.close()
  fs.rmSync(root, { recursive: true, force: true })
})

const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8')
const mainOf = (rel) => getRegions(read(rel)).main

test('admin data is never served publicly', async () => {
  for (const p of ['/content/data/courses.json', '/server/server.mjs', '/scripts/patch_site.py', '/.env.admin']) {
    const r = await fetch(srv.base + p)
    assert.equal(r.status, 404, p)
  }
  assert.equal((await fetch(srv.base + '/')).status, 200)
  assert.equal((await fetch(srv.base + '/about')).status, 200)
})

test('editing operations require a session and a CSRF token', async () => {
  const anon = client(srv.base)
  assert.equal((await anon.req('GET', '/api/pages')).status, 401)
  assert.equal((await anon.req('PUT', '/api/pages/home/draft', { version: 0, main: 'x' })).status, 401)
  assert.equal((await anon.req('POST', '/api/media/upload', undefined, { raw: Buffer.from('x') })).status, 401)
  assert.equal((await anon.req('GET', '/__admin/render/home?mode=edit')).status, 302)
  assert.equal((await anon.login('wrong-password-123')).status, 401)
  assert.equal((await c.login()).status, 200)
  const noToken = await c.req('PUT', '/api/pages/home/draft', { version: 0, main: mainOf('index.html') }, { noCsrf: true })
  assert.equal(noToken.status, 403)
})

test('pages are discovered from the real site', async () => {
  const r = await c.req('GET', '/api/pages')
  assert.equal(r.status, 200)
  const routes = r.json.pages.map((p) => p.route)
  for (const route of ['/', '/about', '/contact', '/programs', '/plus-two', '/plus-two/cpp-programming', '/free-it-consultation', '/hackathon']) {
    assert.ok(routes.includes(route), route)
  }
  assert.equal(r.json.pages.find((p) => p.route === '/plus-two/cpp-programming').managedPage, true)
  assert.equal(r.json.pages.find((p) => p.route === '/about').managedPage, false)
})

test('draft -> reload -> publish -> revision restore', async () => {
  const before = read('about/index.html')
  const main = mainOf('about/index.html').replace('About IT Wala Dai', 'About IT Wala Dai TEST')
  assert.notEqual(main, mainOf('about/index.html'))
  const save = await c.req('PUT', '/api/pages/about/draft', { version: 0, main, meta: { title: 'About test', description: 'desc' }, styles: {} })
  assert.equal(save.status, 200, JSON.stringify(save.json))
  assert.equal(save.json.version, 1)
  // reload: draft is persisted, the live page is unchanged
  const state = await c.req('GET', '/api/pages/about')
  assert.equal(state.json.version, 1)
  assert.equal(state.json.meta.title, 'About test')
  assert.equal(read('about/index.html'), before)
  const draftRender = await c.req('GET', '/__admin/render/about?mode=preview')
  assert.match(draftRender.text, /About IT Wala Dai TEST/)
  assert.doesNotMatch((await (await fetch(srv.base + '/about')).text()), /About IT Wala Dai TEST/)
  // a stale editor (version 0) cannot overwrite the newer draft
  assert.equal((await c.req('PUT', '/api/pages/about/draft', { version: 0, main })).status, 409)
  // publish (warnings must be accepted explicitly)
  const pub = await c.req('POST', '/api/pages/about/publish', { version: 1, acceptWarnings: true })
  assert.equal(pub.status, 200, JSON.stringify(pub.json))
  const live = await (await fetch(srv.base + '/about')).text()
  assert.match(live, /About IT Wala Dai TEST/)
  assert.match(live, /<title>About test<\/title>/)
  // revision history + restore
  const revs = await c.req('GET', '/api/pages/about/revisions')
  assert.ok(revs.json.revisions.length >= 1)
  const restore = await c.req('POST', '/api/pages/about/revisions/' + revs.json.revisions[0].id + '/restore', {})
  assert.equal(restore.status, 200)
  assert.equal(read('about/index.html'), before)
})

test('unsafe HTML, URLs and CSS are rejected', async () => {
  const main = mainOf('contact/index.html')
  const bad = [
    main + '<script>alert(1)</script>',
    main + '<img src="/x.png" onerror="alert(1)">',
    main + '<a href="javascript:alert(1)">x</a>',
    main + '<a href=" jav&#x09;ascript:alert(1)">x</a>',
    main + '<iframe src="https://evil.example/"></iframe>',
    main + '<div style="background:url(javascript:alert(1))">x</div>',
  ]
  for (const b of bad) {
    const r = await c.req('PUT', '/api/pages/contact/draft', { version: 0, main: b })
    assert.equal(r.status, 422, b.slice(-70))
  }
  const ok = await c.req('PUT', '/api/pages/contact/draft', {
    version: 0, main: main + '<div class="itwd-embed"><iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ" title="Video" allowfullscreen></iframe></div>',
  })
  assert.equal(ok.status, 200, JSON.stringify(ok.json))
  const badCss = await c.req('PUT', '/api/pages/contact/draft', { version: 1, styles: { 'itwd-e-abc123': { desktop: { 'background-image': 'url(javascript:alert(1))' } } } })
  assert.equal(badCss.status, 422)
  const badProp = await c.req('PUT', '/api/pages/contact/draft', { version: 1, styles: { 'itwd-e-abc123': { desktop: { behavior: 'x' } } } })
  assert.equal(badProp.status, 422)
  await c.req('DELETE', '/api/pages/contact/draft')
})

test('unit: security + style compiler', () => {
  assert.equal(securityIssues('<a href="#" onClick="return true">x</a>', '<a href="#" onclick="return true">x</a>').length, 0)
  assert.equal(securityIssues('<a href="/about/" class="updated" onclick="return true">About</a>', '<a href="#" onclick="return true">Home</a>').length, 0)
  assert.equal(securityIssues('<a href="#" onclick="steal()">x</a>', '<a href="#" onclick="return true">x</a>').length, 1)
  const { model, issues } = cleanStyleModel({ 'itwd-e-ab12cd': { desktop: { 'font-size': '42px', color: '#ff0000' }, mobile: { 'font-size': '28px', display: 'none' }, hover: { color: '#000' } } })
  assert.equal(issues.length, 0)
  const css = compileStyles(model)
  assert.match(css, /\.itwd-e-ab12cd \{\n {2}font-size: 42px !important;/)
  assert.match(css, /@media \(max-width: 767px\) \{\n {2}\.itwd-e-ab12cd \{\n {4}font-size: 28px !important;\n {4}display: none !important;/)
  assert.match(css, /\.itwd-e-ab12cd:hover/)
})

test('styles (incl. mobile overrides) are published into the page', async () => {
  const main = mainOf('testimonials/index.html').replace('class="breadcumb-title"', 'class="breadcumb-title"')
  const styles = { 'itwd-e-tt0001': { desktop: { color: '#123456' }, mobile: { 'font-size': '20px' } } }
  const withKey = main.replace('<section class="itwd-testi2 space">', '<section class="itwd-testi2 space itwd-e-tt0001">')
  assert.notEqual(withKey, main)
  const s = await c.req('PUT', '/api/pages/testimonials/draft', { version: 0, main: withKey, styles })
  assert.equal(s.status, 200, JSON.stringify(s.json))
  const p = await c.req('POST', '/api/pages/testimonials/publish', { version: 1, acceptWarnings: true })
  assert.equal(p.status, 200, JSON.stringify(p.json))
  const live = read('testimonials/index.html')
  assert.match(live, /<style id="itwd-page-styles">[\s\S]*\.itwd-e-tt0001 \{\n {2}color: #123456 !important;[\s\S]*max-width: 767px/)
  assert.match(live, /itwd-testi2 space itwd-e-tt0001/)
})

test('shared header/footer: one change reaches every page, active menu stays per page', async () => {
  const home = getRegions(read('index.html'))
  const header = home.header.replace(/(<a\b[^>]*\bonclick="return true"[^>]*)(>Home<\/a>)/i, '$1 title="Edited safely"$2')
  assert.notEqual(header, home.header, 'test fixture should edit an existing legacy navigation link')
  const sideTab = home.sideTab.replace('<strong>Pranam Software</strong>', '<strong>Pranam Software Edited</strong>')
  assert.notEqual(sideTab, home.sideTab)
  const footer = home.footer.replace('Quick Links', 'Quick Links X')
  assert.notEqual(footer, home.footer)
  const s = await c.req('PUT', '/api/global/draft', { version: 0, header, footer, sideTab })
  assert.equal(s.status, 200, JSON.stringify(s.json))
  const p = await c.req('POST', '/api/global/publish', { version: 1, acceptWarnings: true })
  assert.equal(p.status, 200, JSON.stringify(p.json))
  for (const rel of ['index.html', 'about/index.html', 'plus-two/cpp-programming/index.html']) {
    assert.match(read(rel), /Quick Links X/, rel)
    assert.match(read(rel), /Pranam Software Edited/, rel)
  }
  assert.match(getRegions(read('about/index.html')).header, /current-menu-item current_page_item"><a href="\/about" aria-current="page">/)
  assert.match(getRegions(read('plus-two/cpp-programming/index.html')).header, /current-menu-item current_page_item"><a href="\/plus-two" aria-current="page">/)
})

test('header buttons validate and publish phone number and chosen order on desktop and mobile', async () => {
  const initial = await c.req('GET', '/api/data/header_controls')
  assert.equal(initial.status, 200)
  const data = structuredClone(initial.json.published)
  const bad = { ...data, order: ['call', 'call'] }
  assert.equal((await c.req('PUT', '/api/data/header_controls', { version: 0, data: bad })).status, 422)
  const badPhone = { ...data, phoneNumber: 'not a phone' }
  assert.equal((await c.req('PUT', '/api/data/header_controls', { version: 0, data: badPhone })).status, 422)
  data.phoneNumber = '+977 98000-12345'
  data.joinLabel = 'Student Login'
  data.order = ['join', 'call']
  assert.equal((await c.req('PUT', '/api/data/header_controls', { version: 0, data })).status, 200)
  assert.equal((await c.req('POST', '/api/data/header_controls/publish', {})).status, 200)
  const live = read('index.html')
  const desktop = live.split('<!-- itwd:header-actions:start -->')[1].split('<!-- itwd:header-actions:end -->')[0]
  const mobile = live.split('<!-- itwd:mobile-actions:start -->')[1].split('<!-- itwd:mobile-actions:end -->')[0]
  assert.ok(desktop.indexOf('Student Login') < desktop.indexOf('tel:+9779800012345'))
  assert.match(desktop, /<span>\+977 98000-12345<\/span>/)
  assert.ok(mobile.indexOf('Student Login') < mobile.indexOf('tel:+9779800012345'))
  assert.match(mobile, /<span>\+977 98000-12345<\/span>/)
  assert.equal((await c.req('GET', '/api/data/header_controls')).json.published.phoneNumber, '+977 98000-12345')
})

test('CMS: course edits reach the home card, +2 page and course page; bad data is refused', async () => {
  const d = await c.req('GET', '/api/data/courses')
  assert.equal(d.status, 200)
  const data = structuredClone(d.json.published)
  data[0].name = 'C++ for +2 Students TEST'
  const bad = structuredClone(data)
  bad[0].img = 'javascript:alert(1)'
  assert.equal((await c.req('PUT', '/api/data/courses', { version: 0, data: bad })).status, 422)
  const s = await c.req('PUT', '/api/data/courses', { version: 0, data })
  assert.equal(s.status, 200, JSON.stringify(s.json))
  const p = await c.req('POST', '/api/data/courses/publish', {})
  assert.equal(p.status, 200, JSON.stringify(p.json))
  assert.match(read('index.html'), /C\+\+ for \+2 Students TEST/)
  assert.match(read('plus-two/cpp-programming/index.html'), /C\+\+ for \+2 Students TEST/)
  // the visual-editor content outside the managed blocks was not touched
  assert.match(read('index.html'), /itwd:home-courses:start/)
})

test('homepage college strip drafts, publishes, repeats logos for the loop and never changes college records', async () => {
  await c.login()
  const collegesBefore = read('content/data/colleges.json')
  const initial = await c.req('GET', '/api/data/college_strip')
  assert.equal(initial.status, 200)
  const data = structuredClone(initial.json.published)
  data.push({ name: 'Test University', image: '/college/kmc.png', url: null, alt: 'Test University logo', order: 0, active: true })
  assert.equal((await c.req('PUT', '/api/data/college_strip', { version: 0, data })).status, 200)
  assert.equal((await c.req('POST', '/api/data/college_strip/publish', {})).status, 200)
  let home = read('index.html')
  assert.match(home, /Test University/)
  assert.match(home, /Test University logo/)
  assert.match(home, /aria-hidden="true"[^>]*><img src="\/college\/kmc\.png" alt=""/)
  assert.match(fs.readFileSync(path.join(root, 'assets/itwd/itwd.css'), 'utf8'), /translateX\(-50%\)/)

  let current = (await c.req('GET', '/api/data/college_strip')).json.published
  const testItem = current.find((x) => x.name === 'Test University')
  testItem.name = 'Test University Updated'
  testItem.image = '/college/ccrc.png'
  testItem.order = 2
  assert.equal((await c.req('PUT', '/api/data/college_strip', { version: 0, data: current })).status, 200)
  assert.equal((await c.req('POST', '/api/data/college_strip/publish', {})).status, 200)
  home = read('index.html')
  current = (await c.req('GET', '/api/data/college_strip')).json.published
  assert.equal(current.find((x) => x.name === 'Test University Updated').order, 2)
  assert.match(home, /src="\/college\/ccrc\.png" alt="Test University logo"/)
  const track = home.split('<!-- itwd:home-college-strip:start -->')[1].split('<!-- itwd:home-college-strip:end -->')[0]
  assert.ok(track.indexOf('src="/college/ccrc.png"') < track.indexOf('alt="Test University logo"'))
  assert.ok(track.indexOf('alt="Test University logo"') < track.indexOf('src="/college/kmc.png"'))

  current = (await c.req('GET', '/api/data/college_strip')).json.published
  const updated = current.find((x) => x.name === 'Test University Updated')
  updated.active = false
  assert.equal((await c.req('PUT', '/api/data/college_strip', { version: 0, data: current })).status, 200)
  const reloaded = (await c.req('GET', '/api/data/college_strip')).json.draft
  assert.equal(reloaded.find((x) => x.name === 'Test University Updated').image, '/college/ccrc.png')
  assert.equal((await c.req('POST', '/api/data/college_strip/publish', {})).status, 200)
  home = read('index.html').split('<!-- itwd:home-college-strip:start -->')[1].split('<!-- itwd:home-college-strip:end -->')[0]
  assert.doesNotMatch(home, /alt="Test University logo"/)

  current = (await c.req('GET', '/api/data/college_strip')).json.published
  const beforeRemove = current.length
  current = current.filter((x) => x.name !== 'Test University Updated')
  assert.equal(current.length, beforeRemove - 1)
  assert.equal((await c.req('PUT', '/api/data/college_strip', { version: 0, data: current })).status, 200)
  assert.equal((await c.req('POST', '/api/data/college_strip/publish', {})).status, 200)
  const finalTrack = read('index.html').split('<!-- itwd:home-college-strip:start -->')[1].split('<!-- itwd:home-college-strip:end -->')[0]
  assert.doesNotMatch(finalTrack, /alt="Test University logo"/)
  assert.equal(read('content/data/colleges.json'), collegesBefore)
  assert.equal(fs.existsSync(path.join(root, 'college', 'ccrc.png')), true)
  assert.equal((await fetch(srv.base + '/free-it-consultation')).status, 200)
})

test('media: real image upload, fake image refused, used image cannot be deleted', async () => {
  const png = Buffer.from('89504e470d0a1a0a0000000d49484452000000020000000308060000009d3f5d3a0000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082', 'hex')
  const up = await c.req('POST', '/api/media/upload', undefined, { raw: png, headers: { 'Content-Type': 'application/octet-stream', 'X-File-Name': 'My Photo.png' } })
  assert.equal(up.status, 200, JSON.stringify(up.json))
  assert.match(up.json.path, /^assets\/uploads\/\d{4}-\d{2}\/my-photo-[0-9a-f]{6}\.png$/)
  assert.equal(up.json.width, 2)
  assert.equal(up.json.height, 3)
  const fake = await c.req('POST', '/api/media/upload', undefined, { raw: Buffer.from('<svg onload=alert(1)></svg>'), headers: { 'X-File-Name': 'x.png' } })
  assert.equal(fake.status, 415)
  const used = await c.req('POST', '/api/media/delete', { path: 'assets/itwd/pranam-logo.png' })
  assert.equal(used.status, 409)
  const del = await c.req('POST', '/api/media/delete', { path: up.json.path })
  assert.equal(del.status, 200)
  assert.equal(fs.existsSync(path.join(root, up.json.path)), false)
})

test('theme tokens publish to the shared stylesheet', async () => {
  assert.equal((await c.req('PUT', '/api/theme', { primary: 'red' })).status, 422)
  assert.equal((await c.req('PUT', '/api/theme', { primary: '#0A8F7A' })).status, 200)
  assert.equal((await c.req('POST', '/api/theme/publish', {})).status, 200)
  assert.match(read('assets/itwd/theme-tokens.css'), /--theme-color: #0A8F7A;/)
})

test('duplicate page stays private until published', async () => {
  const d = await c.req('POST', '/api/pages/hackathon/duplicate', { slug: 'events-test', title: 'Events test' })
  assert.equal(d.status, 200, JSON.stringify(d.json))
  assert.equal((await fetch(srv.base + '/events-test')).status, 404)
  assert.equal((await c.req('POST', '/api/pages/events-test/publish-state', { published: true })).status, 200)
  const live = await fetch(srv.base + '/events-test')
  assert.equal(live.status, 200)
  assert.match(await live.text(), /<title>Events test<\/title>/)
  assert.equal((await c.req('POST', '/api/pages/about/publish-state', { published: false })).status, 403)
})

test('login is rate limited', async () => {
  const x = client(srv.base)
  let last
  for (let i = 0; i < 6; i++) last = await x.login('nope-nope-nope-' + i)
  assert.equal(last.status, 429)
})
