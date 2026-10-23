// Element library for the visual editor. Every snippet uses classes that exist in the site CSS (theme + itwd.css)
// and, where interactive, markup that assets/itwd/itwd.js already powers on the published site.
// Placeholder text is clearly a placeholder — no invented statistics, testimonials or links.

const uid = () => Math.random().toString(36).slice(2, 7)
const esc = (s) => String(s ?? '').replace(/&(?![a-z]+;|#\d+;)/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const ARROW = '<i class="far fa-arrow-right ms-2"></i>'

function accordion(items) {
  const id = uid()
  return '<div class="itwd-gacc" data-itwd-accordion>' + items.map(([icon, title, text], i) =>
    '<div class="itwd-gacc__item"><h3 class="itwd-gacc__h"><button type="button" class="itwd-gacc__btn" id="acc-' + id + '-b' + i +
    '" aria-expanded="false" aria-controls="acc-' + id + '-p' + i + '"><span class="itwd-gacc__icon" aria-hidden="true"><i class="' + icon +
    '"></i></span><span class="itwd-gacc__title">' + title + '</span><i class="far fa-chevron-down itwd-gacc__chev" aria-hidden="true"></i></button></h3>' +
    '<div class="itwd-gacc__panel" id="acc-' + id + '-p' + i + '" role="region" aria-labelledby="acc-' + id + '-b' + i + '"><div class="itwd-gacc__inner"><p>' +
    text + '</p></div></div></div>').join('') + '</div>'
}

const card = (title = 'Card title', text = 'Card ko chhoto description yaha lekhnuhos.') =>
  '<div class="itwd-card"><span class="itwd-card__icon"><i class="fal fa-star"></i></span><h3 class="itwd-card__title">' + title +
  '</h3><p class="itwd-card__text">' + text + '</p></div>'

export const GROUPS = ['Basic', 'Layout', 'Content blocks', 'From your data', 'Saved sections']

export function buildSnippets(data = {}) {
  const s = [
    { id: 'heading', group: 'Basic', label: 'Heading', icon: 'H', html: () => '<h2 class="sec-title itwd-new-heading">Naya heading lekhnuhos</h2>' },
    { id: 'text', group: 'Basic', label: 'Text', icon: '¶', html: () => '<p class="itwd-new-text">Yaha aafno text lekhnuhos. Double-click garera edit garna saknuhunchha.</p>' },
    { id: 'richtext', group: 'Basic', label: 'Rich text', icon: '≣', html: () => '<div class="itwd-richtext"><p><strong>Mukhya kura:</strong> yaha detail lekhnuhos.</p><p>Arko paragraph yaha lekhnuhos.</p><ul><li>Pahilo point</li><li>Dosro point</li></ul></div>' },
    { id: 'button', group: 'Basic', label: 'Button', icon: '▭', html: () => '<div class="itwd-btn-row"><a href="/contact" class="th-btn">Button text' + ARROW + '</a></div>' },
    { id: 'image', group: 'Basic', label: 'Image', icon: '🖼', html: () => '<figure class="itwd-figure"><img src="/assets/itwd/logo-mark.webp" alt="Image ko description lekhnuhos" width="360" height="324" loading="lazy"></figure>' },
    { id: 'video', group: 'Basic', label: 'Video (YouTube)', icon: '▶', html: () => '<div class="itwd-embed itwd-embed--empty" data-itwd-video><p>YouTube video URL properties panel ma rakhnuhos.</p></div>' },
    { id: 'icon', group: 'Basic', label: 'Icon', icon: '★', html: () => '<span class="itwd-icon-wrap"><i class="fal fa-star itwd-icon" aria-hidden="true"></i></span>' },
    { id: 'divider', group: 'Basic', label: 'Divider', icon: '—', html: () => '<hr class="itwd-divider">' },
    { id: 'spacer', group: 'Basic', label: 'Spacer', icon: '↕', html: () => '<div class="itwd-spacer" aria-hidden="true"></div>' },
    { id: 'container', group: 'Layout', label: 'Container', icon: '▢', html: () => '<div class="container itwd-box"><p>Container bhitra elements drag garnuhos.</p></div>' },
    { id: 'two-col', group: 'Layout', label: 'Two-column section', icon: '▥', html: () => '<section class="space itwd-sec"><div class="container"><div class="row gy-4 align-items-center"><div class="col-lg-6"><h2 class="sec-title">Section heading</h2><p>Section ko text yaha lekhnuhos.</p></div><div class="col-lg-6"><p>Dosro column — yaha image, card wa text drag garnuhos.</p></div></div></div></section>' },
    { id: 'three-col', group: 'Layout', label: 'Three-column section', icon: '▦', html: () => '<section class="space itwd-sec"><div class="container"><div class="row gy-4"><div class="col-lg-4">' + card() + '</div><div class="col-lg-4">' + card() + '</div><div class="col-lg-4">' + card() + '</div></div></div></section>' },
    { id: 'grid', group: 'Layout', label: 'Card grid', icon: '⊞', html: () => '<div class="itwd-grid">' + card() + card() + card() + '</div>' },
    { id: 'card', group: 'Content blocks', label: 'Card', icon: '▤', html: () => card() },
    { id: 'img-text', group: 'Content blocks', label: 'Image & text', icon: '◧', html: () => '<section class="space itwd-sec"><div class="container"><div class="row gy-4 align-items-center"><div class="col-lg-6"><figure class="itwd-figure"><img src="/assets/itwd/logo-mark.webp" alt="Image ko description lekhnuhos" width="360" height="324" loading="lazy"></figure></div><div class="col-lg-6"><h2 class="sec-title">Heading lekhnuhos</h2><p>Description yaha lekhnuhos.</p><div class="itwd-btn-row"><a href="/contact" class="th-btn">Button text' + ARROW + '</a></div></div></div></div></section>' },
    { id: 'cta', group: 'Content blocks', label: 'Call to action', icon: '📣', html: () => '<section class="itwd-cta-block"><div class="container"><div class="itwd-cta-block__inner"><h2 class="sec-title">Call to action heading</h2><p>Chhoto message yaha lekhnuhos.</p><div class="itwd-btn-pair"><a href="/free-it-consultation" class="th-btn">Pahilo button' + ARROW + '</a><a href="/contact" class="th-btn style-border2">Dosro button</a></div></div></div></section>' },
    { id: 'accordion', group: 'Content blocks', label: 'Accordion', icon: '☰', html: () => accordion([['fal fa-circle-info', 'Pahilo item', 'Item ko detail yaha lekhnuhos.'], ['fal fa-circle-info', 'Dosro item', 'Item ko detail yaha lekhnuhos.'], ['fal fa-circle-info', 'Tesro item', 'Item ko detail yaha lekhnuhos.']]) },
    { id: 'faq', group: 'Content blocks', label: 'FAQ', icon: '?', html: () => accordion([['fal fa-circle-question', 'Prashna yaha lekhnuhos?', 'Uttar yaha lekhnuhos.'], ['fal fa-circle-question', 'Arko prashna?', 'Uttar yaha lekhnuhos.']]) },
    { id: 'testimonial', group: 'Content blocks', label: 'Testimonial card', icon: '❝', html: () => '<article class="itwd-tc itwd-tc--static"><div class="itwd-tc__top"><span class="itwd-tc__cat">Category</span><i class="fas fa-quote-right" aria-hidden="true"></i></div><p class="itwd-tc__quote">Student ko asli feedback yaha rakhnuhos (sample feedback publish nagarnuhos).</p><div class="itwd-tc__who"><span class="itwd-tc__avatar" aria-hidden="true">AB</span><div><h4>Student ko naam</h4><p>Course / college</p></div></div></article>' },
    { id: 'stats', group: 'Content blocks', label: 'Statistics', icon: '#', html: () => '<div class="itwd-stats"><div class="itwd-stat"><strong>00</strong><span>Label lekhnuhos</span></div><div class="itwd-stat"><strong>00</strong><span>Label lekhnuhos</span></div><div class="itwd-stat"><strong>00</strong><span>Label lekhnuhos</span></div></div>', note: 'Use only real numbers.' },
    { id: 'form', group: 'Content blocks', label: 'Contact form (WhatsApp)', icon: '✉', html: () => '<form class="itwd-wa-form" novalidate><div class="row g-3"><div class="col-md-6"><label class="itwd-flabel" for="waf-' + uid() + '">Naam *</label><input class="form-control" name="name" type="text" required></div><div class="col-md-6"><label class="itwd-flabel">Phone / WhatsApp *</label><input class="form-control" name="phone" type="tel" required></div><div class="col-12"><label class="itwd-flabel">Message *</label><textarea class="form-control" name="message" rows="4" required></textarea></div></div><p class="itwd-form-status" role="status" aria-live="polite"></p><button type="submit" class="th-btn w-100"><i class="fab fa-whatsapp me-2"></i>WhatsApp ma pathaunuhos</button></form>', note: 'Opens WhatsApp with the message; nothing is stored.' },
  ]
  for (const c of data.courses || []) {
    s.push({ id: 'course-' + c.slug, group: 'From your data', label: 'Course card: ' + strip(c.name), icon: '🎓', note: 'Static copy of the course data',
      html: () => '<a class="itwd-card itwd-card--link" href="/plus-two/' + esc(c.slug) + '"><span class="itwd-card__tag">Free course</span><h3 class="itwd-card__title">' + c.name + '</h3><p class="itwd-card__text">' + c.short + '</p><span class="itwd-card__meta">' + esc(c.duration) + ' &middot; ' + lessons(c) + ' lessons</span></a>' })
  }
  for (const p of ((data.projects || {}).projects || []).slice(0, 40)) {
    s.push({ id: 'project-' + slug(p.title), group: 'From your data', label: 'Project card: ' + strip(p.title), icon: '💡', note: 'Static copy',
      html: () => '<div class="itwd-card"><span class="itwd-card__tag">' + esc(p.level) + '</span><h3 class="itwd-card__title">' + p.title + '</h3><p class="itwd-card__text">' + esc(p.tech) + '</p><span class="itwd-card__meta"><i class="fal fa-clock"></i> ' + esc(p.duration) + '</span><div class="itwd-btn-row"><a href="#start-project" class="th-btn btn-sm itwd-start" data-kind="project" data-project="' + esc(strip(p.title)) + '">Guidance Sodhnuhos</a></div></div>' })
  }
  for (const c of data.colleges || []) {
    s.push({ id: 'college-' + slug(c.name), group: 'From your data', label: 'College card: ' + strip(c.name), icon: '🏫', note: 'Static copy',
      html: () => '<div class="itwd-card"><span class="itwd-card__tag">' + (c.kind === 'foreign' ? 'Foreign-affiliated' : 'Nepal university') + '</span><h3 class="itwd-card__title">' + c.name + '</h3><p class="itwd-card__text">' + c.univ + '</p><div class="itwd-btn-row"><a href="' + esc(c.url) + '" class="th-btn btn-sm style-border2" target="_blank" rel="noopener">Official Info Hernuhos</a></div></div>' })
  }
  for (const comp of data.components || []) {
    s.push({ id: 'component-' + comp.id, group: 'Saved sections', label: comp.name, icon: '♻', note: 'Reusable section', html: () => comp.html, componentId: comp.id })
  }
  return s
}

const strip = (s) => String(s).replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&mdash;/g, '—').replace(/&[a-z]+;/g, ' ')
const slug = (s) => strip(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
const lessons = (c) => (c.modules || []).reduce((n, m) => n + (m.lessons || []).length, 0)
