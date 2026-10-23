"""
IT Wala Dai — re-render the CMS-managed blocks of the published pages from content/data/*.json.

The visual admin panel edits page layout/content directly in the HTML files. Content that comes from structured
records (courses, testimonials, FAQs, programmes, colleges, projects, navigation) lives in clearly marked blocks:

    <!-- itwd:NAME:start --> ... <!-- itwd:NAME:end -->

This script only rewrites those blocks (and the course detail pages, which are generated entirely from course data),
so visual edits elsewhere on a page are never touched.

    python scripts/cms_render.py --init          one-time: wrap the managed blocks in markers + add the theme stylesheets
    python scripts/cms_render.py courses         re-render everything that shows course data
    python scripts/cms_render.py all             every type

Prints a JSON summary: {"changed": [relative file paths], "created": [...]}
"""
import json
import re
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_site as B  # noqa: E402
import patch_site as P  # noqa: E402
import v2_content as V  # noqa: E402
import v3_content as V3  # noqa: E402
from course_data import COURSES  # noqa: E402

ROOT = B.ROOT

# managed block -> file it lives in
BLOCK_FILE = {
    'home-courses': 'index.html',
    'cpp-facts': 'index.html',
    'home-testimonials': 'index.html',
    'home-faq': 'index.html',
    'home-college-strip': 'index.html',
    'projects': 'programs/index.html',
    'plus2-courses': 'plus-two/index.html',
    'testimonials-grid': 'testimonials/index.html',
    'consult-programmes': 'free-it-consultation/index.html',
    'consult-colleges': 'free-it-consultation/index.html',
    'consult-faq': 'free-it-consultation/index.html',
}
TYPE_BLOCKS = {
    'courses': ['home-courses', 'cpp-facts', 'plus2-courses'],
    'college_strip': ['home-college-strip'],
    'testimonials': ['home-testimonials', 'testimonials-grid'],
    'faqs': ['home-faq', 'consult-faq'],
    'programmes': ['consult-programmes'],
    'colleges': ['consult-colleges'],
    'projects': ['projects'],
    'nav': [],
    'header_controls': [],
}
COURSE_PAGES_TYPES = ('courses', 'faqs')   # course detail pages are generated from course data + course FAQ

THEME_LINKS = ("<link rel='stylesheet' id='itwd-theme-css' href='/assets/itwd/theme-tokens.css' media='all' />\n"
               "<link rel='stylesheet' id='itwd-editor-global-css' href='/assets/itwd/editor-global.css' media='all' />\n")
PAGE_STYLE_RE = re.compile(r'<style id="itwd-page-styles">.*?</style>\s*', re.S)


def finalize(html):
    """Same post-processing the pages get (placeholders, accessible names, optimized image paths)."""
    return V3.patch_performance(V3.patch_a11y(V3.fix_placeholders(html)))


def render(name):
    if name == 'home-college-strip':
        data = json.loads((ROOT / 'content' / 'data' / 'college_strip.json').read_text(encoding='utf-8'))
        active = sorted((item for item in data if item.get('active')), key=lambda item: item['order'])
        def items(repeated=False):
            out = []
            for item in active:
                image = escape(item['image'], quote=True)
                alt = '' if repeated else escape(item.get('alt') or item['name'], quote=True)
                logo = '<img src="%s" alt="%s" decoding="async">' % (image, alt)
                url = item.get('url')
                if url:
                    logo = '<a href="%s"%s>%s</a>' % (escape(url, quote=True), ' aria-hidden="true" tabindex="-1"' if repeated else '', logo)
                out.append('<li class="itwd-marquee__item"%s>%s</li>' % (' aria-hidden="true"' if repeated else '', logo))
            return ''.join(out)
        return '<ul class="itwd-marquee__track">%s%s</ul>' % (items(), items(True))
    if name == 'home-courses':
        return '<div class="th-course-row columns-3 itwd-home-courses">' + V3.home_courses() + '</div>'
    if name == 'cpp-facts':
        return re.search(r'<ul class="itwd-promo__facts th_fade_anim">.*?</ul>', V3.cpp_section(), re.S).group(0)
    if name == 'home-testimonials':
        fake = '<div class="swiper th-slider" id="testiSlide1"><div class="swiper-wrapper"></div></div>'
        out = V.patch_home_testimonials(fake)
        return out[out.index('<div class="swiper-wrapper">'):-len('</div>')]
    if name == 'home-faq':
        return V.faq_accordion(V.HOME_FAQ)
    if name == 'projects':
        blk = P.projects_block()
        return blk[blk.index('-->') + 3:blk.rindex('<!--')]
    if name == 'plus2-courses':
        return ('<div class="row gy-4 justify-content-center">' +
                ''.join('<div class="col-xl-4 col-md-6">%s</div>' % P.course_card(c, 0.2 + 0.2 * i) for i, c in enumerate(COURSES)) +
                '</div>')
    if name == 'testimonials-grid':
        return '<div class="itwd-tgrid">%s</div>' % ''.join(V.testimonial_card(t, i) for i, t in enumerate(V.TESTIMONIALS))
    if name == 'consult-programmes':
        return V3.courses_section()
    if name == 'consult-colleges':
        return V3.colleges_section()
    if name == 'consult-faq':
        return '<div class="itwd-acc-group">%s</div>' % ''.join(
            '<div class="itwd-acc%s"><button type="button" class="itwd-acc__head" aria-expanded="%s">'
            '<span class="itwd-acc__q">Q%d.</span><span class="itwd-acc__title">%s</span><i class="far fa-chevron-down itwd-acc__chev"></i></button>'
            '<div class="itwd-acc__body"><div><p class="itwd-acc__answer">%s</p></div></div></div>'
            % (' is-open' if i == 0 else '', 'true' if i == 0 else 'false', i + 1, q, a) for i, (q, a) in enumerate(V.CONSULT_FAQ))
    raise KeyError(name)


def markers(name):
    return '<!-- itwd:%s:start -->' % name, '<!-- itwd:%s:end -->' % name


def replace_block(s, name, inner):
    a, b = markers(name)
    if a not in s or b not in s:
        raise ValueError('managed block %s has no markers (run --init first)' % name)
    st = s.index(a) + len(a)
    return s[:st] + inner + s[s.index(b):]


def replace_marker(s, name, inner):
    a, b = markers(name)
    if a not in s or b not in s:
        raise ValueError('managed block %s has no markers (run --init first)' % name)
    st = s.index(a) + len(a)
    en = s.index(b, st)
    return s[:st] + inner + s[en:]


def render_header_controls(data, mobile=False):
    phone = str(data['phoneNumber']).strip()
    tel = ('+' if phone.startswith('+') else '') + re.sub(r'\D', '', phone)
    label = escape(str(data['joinLabel']).strip())
    phone_text = escape(phone)
    if mobile:
        call = '<a class="itwd-mobile-join__call" href="tel:%s"><i class="far fa-phone-alt" aria-hidden="true"></i><span>%s</span></a>' % (escape(tel, quote=True), phone_text)
        join = '<button type="button" class="th-btn w-100" data-itwd-join aria-haspopup="dialog" aria-controls="itwd-join"><i class="fas fa-graduation-cap me-2" aria-hidden="true"></i><span>%s</span></button>' % label
    else:
        call = '<a href="tel:%s" class="th-btn itwd-phone-cta" aria-label="Call IT Wala Dai"><i class="far fa-phone-alt" aria-hidden="true"></i><span>%s</span></a>' % (escape(tel, quote=True), phone_text)
        join = '<button type="button" class="itwd-join-cta" data-itwd-join aria-haspopup="dialog" aria-controls="itwd-join"><i class="fas fa-graduation-cap" aria-hidden="true"></i><span>%s</span><i class="far fa-arrow-right" aria-hidden="true"></i></button>' % label
    items = {'call': call, 'join': join}
    return ''.join(items[x] for x in data['order'])


# ---------------------------------------------------------------- one-time marker insertion (wrap the current blocks)

def _wrap(s, name, start, end):
    a, b = markers(name)
    return s[:start] + a + s[start:end] + b + s[end:]


def _wrap_div(s, name, opening, after=None):
    if markers(name)[0] in s:
        return s
    st = s.index(opening, s.index(after) if after else 0)
    return _wrap(s, name, st, B.block(s, st))


def _wrap_section(s, name, opening):
    if markers(name)[0] in s:
        return s
    st = s.index(opening)
    return _wrap(s, name, st, s.index('</section>', st) + len('</section>'))


def init_file(rel, s):
    if '<!-- itwd:header-actions:start -->' not in s:
        head = s.find('<div class="header-button">')
        phone = s.find('<a href="tel:', head)
        join = s.find('class="itwd-join-cta"', phone)
        end = s.find('</button>', join)
        if head < 0 or phone < 0 or join < 0 or end < 0:
            raise ValueError('header action buttons not found in %s' % rel)
        s = _wrap(s, 'header-actions', phone, end + len('</button>'))
    if '<!-- itwd:mobile-actions:start -->' not in s:
        start = s.find('<div class="itwd-mobile-join">')
        if start < 0:
            raise ValueError('mobile header actions not found in %s' % rel)
        s = _wrap(s, 'mobile-actions', start, B.block(s, start))
    if rel == 'index.html':
        s = _wrap_div(s, 'home-courses', '<div class="th-course-row columns-3 itwd-home-courses">')
        if markers('cpp-facts')[0] not in s:
            st = s.index('<ul class="itwd-promo__facts th_fade_anim">', s.index('<!-- itwd:cpp-promo:start -->'))
            s = _wrap(s, 'cpp-facts', st, s.index('</ul>', st) + len('</ul>'))
        s = _wrap_div(s, 'home-testimonials', '<div class="swiper-wrapper">', after='id="testiSlide1"')
        s = _wrap_div(s, 'home-faq', '<div class="accordion" id="faqAccordion1">')
        if markers('home-college-strip')[0] not in s:
            st = s.index('<ul class="itwd-marquee__track">', s.index('<section class="itwd-marquee-section"'))
            end = s.index('</ul>', st) + len('</ul>')
            s = _wrap(s, 'home-college-strip', st, end)
    elif rel == 'plus-two/index.html':
        s = _wrap_div(s, 'plus2-courses', '<div class="row gy-4 justify-content-center">', after='<section class="itwd-plus2 space">')
    elif rel == 'testimonials/index.html':
        s = _wrap_div(s, 'testimonials-grid', '<div class="itwd-tgrid">')
    elif rel == 'free-it-consultation/index.html':
        s = _wrap_section(s, 'consult-programmes', '<section class="itwd-fc-sec space" id="courses">')
        s = _wrap_section(s, 'consult-colleges', '<section class="itwd-fc-sec itwd-fc-sec--tint space" id="colleges">')
        s = _wrap_div(s, 'consult-faq', '<div class="itwd-acc-group">', after='Consultation ko barema prashna')
    if 'id=\'itwd-theme-css\'' not in s:
        link = "<link rel='stylesheet' id='itwd-css' href='/assets/itwd/itwd.css' media='all' />\n"
        s = s.replace(link, link + THEME_LINKS, 1)
    return s


# ---------------------------------------------------------------- pages

def site_pages():
    """(relative path, active nav route) of every IT Wala Dai page."""
    out = []
    for p in [ROOT / 'index.html'] + sorted(ROOT.glob('*/index.html')) + sorted(ROOT.glob('*/*/index.html')):
        rel = p.relative_to(ROOT).as_posix()
        if rel.split('/')[0] in ('node_modules', '_original', 'it-wala', 'admin', 'content', 'dist'):
            continue
        if '/assets/itwd/itwd.js' not in p.read_text(encoding='utf-8'):
            continue
        route = '/' if rel == 'index.html' else '/' + rel[:-len('/index.html')]
        active = '/plus-two' if route.startswith('/plus-two/') else route
        out.append((rel, active))
    return out


def regenerate_course_pages():
    """Course detail pages are 100% generated from course data (managed pages)."""
    changed, created = [], []
    for c in COURSES:
        rel = 'plus-two/%s/index.html' % c['slug']
        path = ROOT / rel
        old = path.read_text(encoding='utf-8') if path.exists() else None
        P.create_new_pages(force='plus-two/%s/' % c['slug'])
        s = P.shared(P.read(rel), '/plus-two')
        s = init_file(rel, PAGE_STYLE_RE.sub('', s))
        if old:  # keep this page's own (head) editor styles, never the contact page's
            m = PAGE_STYLE_RE.search(old)
            if m:
                s = s.replace('</head>', m.group(0) + '</head>', 1)
        P.write(rel, s)   # always: create_new_pages() above already wrote the raw (unpatched) page
        if s != old:
            (changed if old else created).append(rel)
    return changed, created


def run(types):
    changed, created = set(), []
    files = {}

    def get(rel):
        if rel not in files:
            files[rel] = (ROOT / rel).read_text(encoding='utf-8')
        return files[rel]
    for t in types:
        if t == 'header_controls':
            data = json.loads((ROOT / 'content' / 'data' / 'header_controls.json').read_text(encoding='utf-8'))
            for rel, _active in site_pages():
                page = get(rel)
                page = replace_marker(page, 'header-actions', render_header_controls(data))
                page = replace_marker(page, 'mobile-actions', render_header_controls(data, mobile=True))
                files[rel] = page
            continue
        for name in TYPE_BLOCKS[t]:
            rel = BLOCK_FILE[name]
            files[rel] = replace_block(get(rel), name, finalize(render(name)))
        if t == 'nav':
            for rel, active in site_pages():
                files[rel] = P.set_menus(get(rel), active)
    for rel, s in files.items():
        if s != (ROOT / rel).read_text(encoding='utf-8'):
            (ROOT / rel).write_text(s, encoding='utf-8')
            changed.add(rel)
    if any(t in COURSE_PAGES_TYPES for t in types):
        ch, cr = regenerate_course_pages()
        changed.update(ch)
        created += cr
    return sorted(changed), created


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    if '--init' in sys.argv:
        done = []
        for rel, _ in site_pages():
            s = (ROOT / rel).read_text(encoding='utf-8')
            n = init_file(rel, s)
            if n != s:
                (ROOT / rel).write_text(n, encoding='utf-8')
                done.append(rel)
        print(json.dumps({'changed': done, 'created': []}))
        return
    types = list(TYPE_BLOCKS) if args == ['all'] else args
    bad = [t for t in types if t not in TYPE_BLOCKS]
    if not types or bad:
        sys.exit('usage: cms_render.py --init | all | ' + ' '.join(TYPE_BLOCKS) + (' (unknown: %s)' % bad if bad else ''))
    import io
    import contextlib
    with contextlib.redirect_stdout(io.StringIO()):   # patch_site prints "patched ..." lines
        changed, created = run(types)
    print(json.dumps({'changed': changed, 'created': created}))


if __name__ == '__main__':
    main()
