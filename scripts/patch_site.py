"""
IT Wala Dai — in-place patcher for the live HTML pages.

The generated pages have since been edited by hand (hero, logo, menu icons, CSS...), so
build_site.py must NOT be re-run any more. This script makes targeted, repeatable edits
to the live files instead:

  * same header menu (with icons) + footer quick links on every page
  * Find Project: category tabs + project cards (between itwd:projects markers)
  * creates /plus-two (free C & C++ for +2) and /testimonials if they don't exist yet
    (use --force-new-pages to regenerate them)

Run:  python scripts/patch_site.py
"""
import re
import sys
from html import escape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import build_site as B  # project/category data + html helpers (block, hidden, ...)

ROOT = B.ROOT

NAV = [
    ('/', 'Home', 'fas fa-home'),
    ('/programs', 'Find Project', 'far fa-folder'),
    ('/plus-two', 'For +2', 'far fa-graduation-cap'),
    ('/community', 'Community', 'far fa-users'),
    ('/testimonials', 'Testimonials', 'far fa-star'),
    ('/about', 'About', 'far fa-info-circle'),
    ('/contact', 'Contact', 'far fa-envelope'),
]
PAGES = {
    'index.html': '/',
    'programs/index.html': '/programs',
    'plus-two/index.html': '/plus-two',
    'community/index.html': '/community',
    'testimonials/index.html': '/testimonials',
    'about/index.html': '/about',
    'contact/index.html': '/contact',
}


def read(rel):
    return (ROOT / rel).read_text(encoding='utf-8')


def write(rel, s):
    p = ROOT / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding='utf-8')
    print('patched', rel)


# --------------------------------------------------------------------------- header + footer menu

def nav_items(active):
    out = []
    for i, (href, label, icon) in enumerate(NAV):
        cls = 'menu-item menu-item-type-custom menu-item-object-custom itwd-menu-%d' % i
        if href == active:
            cls += ' current-menu-item current_page_item'
        out.append('<li class="%s"><a href="%s"><i class="%s"></i><span>%s</span></a></li>' % (cls, href, icon, label))
    return '\n'.join(out) + '\n'


def set_menus(s, active):
    # header menus (mobile + desktop): items sit between the <ul ...> line and the hidden template menu
    for ul_open in ('<ul id="menu-primary-menu" class="">', '<ul id="menu-primary-menu-1" class="escul-menu">'):
        st = s.index(ul_open) + len(ul_open)
        en = s.index('<template data-itwd-hidden="template-menu">', st)
        s = s[:st] + '\n' + nav_items(active) + s[en:]
    # footer quick links
    ul_open = '<ul id="menu-quick-links" class="menu">'
    st = s.index(ul_open) + len(ul_open)
    en = s.index('<template data-itwd-hidden="template-footer-menu">', st)
    s = s[:st] + '\n' + ''.join('<li class="menu-item"><a href="%s">%s</a></li>\n' % (h, l) for h, l, _ in NAV) + s[en:]
    return s


# --------------------------------------------------------------------------- Find Project: tabs + cards

CAT_ICON = {
    'ai-ml': 'fal fa-brain',
    'web': 'fal fa-globe',
    'mobile': 'fal fa-mobile',
    'vision': 'fal fa-eye',
    'data': 'fal fa-chart-mixed',
    'nlp': 'fal fa-comments',
}


def split_stack(tech):
    """'MERN (MongoDB, Express), Khalti API' -> ['MERN (MongoDB, Express)', 'Khalti API']"""
    return [t.strip() for t in re.split(r',\s*(?![^()]*\))', tech) if t.strip()]


def projects_block():
    first = B.CATEGORIES[0][0]
    tabs = []
    for slug, name, _ in B.CATEGORIES:
        n = sum(1 for p in B.PROJECTS if p[0] == slug)
        tabs.append(
            '<button type="button" class="itwd-tab%s" role="tab" aria-selected="%s" data-itwd-filter="%s">'
            '<i class="%s"></i><span>%s</span><em>%d</em></button>'
            % (' is-active' if slug == first else '', 'true' if slug == first else 'false', slug, CAT_ICON[slug], name, n))
    cards = []
    counters = {}
    for cat, title, level, dur, tech, pid in B.PROJECTS:
        i = counters[cat] = counters.get(cat, -1) + 1
        stack = ''.join('<li>%s</li>' % t for t in split_stack(tech))
        cards.append(
            '<article class="itwd-proj" data-cat="%(cat)s" style="--i:%(i)d"%(hidden)s>'
            '<div class="itwd-proj__media"><img src="%(img)s" alt="%(alt)s" loading="lazy" decoding="async">'
            '<span class="itwd-proj__cat"><i class="%(icon)s"></i>%(catname)s</span>'
            '<span class="itwd-proj__level is-%(lvl)s">%(level)s</span></div>'
            '<div class="itwd-proj__body"><h3 class="itwd-proj__title">%(title)s</h3>'
            '<ul class="itwd-proj__stack">%(stack)s</ul>'
            '<div class="itwd-proj__foot"><span class="itwd-proj__dur"><i class="fal fa-clock"></i>%(dur)s</span>'
            '<a href="#start-project" class="th-btn btn-sm itwd-start" data-project="%(alt)s">Start Project%(arrow)s</a>'
            '</div></div></article>'
            % dict(cat=cat, i=i, hidden='' if cat == first else ' hidden', img=B.unsplash(pid), alt=title,
                   icon=CAT_ICON[cat], catname=B.CAT_NAME[cat], lvl=level.lower(), level=level, title=title,
                   stack=stack, dur=dur, arrow=B.ARROW_SVG))
    return ('<!-- itwd:projects:start -->\n'
            '<div class="itwd-projects">'
            '<div class="itwd-tabs" role="tablist" aria-label="Project categories">%s</div>'
            '<div class="itwd-proj-grid">%s</div>'
            '<div class="itwd-proj-nav" aria-hidden="true">'
            '<button type="button" class="itwd-proj-nav__btn" data-dir="-1" aria-label="Previous"><i class="far fa-arrow-left"></i></button>'
            '<span class="itwd-proj-nav__count"><b>1</b> / <span>5</span></span>'
            '<button type="button" class="itwd-proj-nav__btn" data-dir="1" aria-label="Next"><i class="far fa-arrow-right"></i></button>'
            '</div></div>\n'
            '<!-- itwd:projects:end -->') % (''.join(tabs), ''.join(cards))


def patch_projects(s):
    if '<!-- itwd:projects:start -->' in s:
        st = s.index('<!-- itwd:projects:start -->')
        en = s.index('<!-- itwd:projects:end -->') + len('<!-- itwd:projects:end -->')
    else:  # first run: replace chips + course grid + View More
        st = s.index('<div class="itwd-chips">')
        more = s.index('<div class="itwd-more-wrap')
        en = B.block(s, more)
    return s[:st] + projects_block() + s[en:]


# --------------------------------------------------------------------------- new pages (shell = contact page)

def shell_from_contact(title, description, crumb_title, crumb, content, body_extra=''):
    s = read('contact/index.html')
    s = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, s, count=1)
    s = re.sub(r'<meta name="description" content="[^"]*" />', '<meta name="description" content="%s" />' % description, s, count=1)
    s = s.replace('<h1 class="breadcumb-title">Contact</h1>', '<h1 class="breadcumb-title">%s</h1>' % crumb_title, 1)
    s = s.replace('<li><a href="/">Home</a></li><li>Contact</li>', '<li><a href="/">Home</a></li><li>%s</li>' % crumb, 1)
    st = s.index('<div class="builder-page-wrapper">') + len('<div class="builder-page-wrapper">')
    en = B.block(s, s.index('<div class="builder-page-wrapper">')) - len('</div>')
    s = s[:st] + '\n' + content + '\n' + body_extra + s[en:]
    return s


def home_app_banner():
    """The app banner your team built on the home page (kept identical here)."""
    s = read('index.html')
    st = s.index('<section class="itwd-app-banner"')
    return s[st:s.index('</section>', st) + len('</section>')]


def plus_two_content():
    courses = [
        dict(code='C', cls='c', name='C Programming', tag='Programming ki shuruaat',
             img=B.unsplash('1515879218367-8466d910aaa4'),
             topics=['Variables &amp; Data Types', 'Operators', 'If-else &amp; Loops', 'Arrays &amp; Strings',
                     'Functions', 'Pointers', 'Structures', 'File Handling']),
        dict(code='C++', cls='cpp', name='C++ Programming', tag='C ke baad agla level &mdash; OOP',
             img=B.unsplash('1555066931-4365d14bab8c'),
             topics=['C++ Basics', 'Classes &amp; Objects', 'Constructors', 'Inheritance',
                     'Polymorphism', 'Function Overloading', 'Operator Overloading', 'File I/O']),
    ]
    cards = ''.join(
        '<div class="col-lg-6"><article class="itwd-c2 itwd-c2--%(cls)s th_fade_anim" data-delay="%(delay)s">'
        '<div class="itwd-c2__media"><span class="itwd-c2__img"><img src="%(img)s" alt="%(name)s code" loading="lazy" decoding="async"></span>'
        '<span class="itwd-c2__free"><i class="fas fa-gift"></i>FREE</span>'
        '<span class="itwd-c2__lang">%(code)s</span></div>'
        '<div class="itwd-c2__body">'
        '<span class="itwd-c2__kicker"><i class="fal fa-mobile"></i>IT Wala Dai App pe</span>'
        '<h3 class="itwd-c2__name">%(name)s</h3><p class="itwd-c2__tag">%(tag)s</p>'
        '<ul class="itwd-c2__meta"><li><i class="fal fa-signal-bars"></i>Beginner</li>'
        '<li><i class="fal fa-video"></i>Live classes</li><li><i class="fal fa-tag"></i>Rs. 0</li></ul>'
        '<ul class="itwd-c2__topics">%(topics)s</ul>'
        '<a href="#start-project" class="th-btn itwd-start" data-kind="course" data-project="%(name)s">'
        'Free mein join karo%(arrow)s</a>'
        '</div></article></div>'
        % dict(c, delay='0.%d' % (2 + 2 * i), topics=''.join('<li>%s</li>' % t for t in c['topics']), arrow=B.ARROW_SVG)
        for i, c in enumerate(courses))

    app_features = [
        ('fal fa-signal-stream', 'Live classes', 'Teacher ke saath live padho, wahin sawaal poocho.'),
        ('fal fa-circle-play', 'Recorded videos', 'Class miss hui? Video baad mein dekh lo.'),
        ('fal fa-file-lines', 'Notes &amp; PDF', 'Har chapter ke simple notes, download karo.'),
        ('fal fa-laptop-code', 'Practice questions', 'Har topic ke baad code karke practice.'),
        ('fal fa-clipboard-check', 'Mock tests', 'Exam se pehle khud ko test karo.'),
        ('fal fa-comments-question', 'Doubt solving', 'Atak gaye? App pe doubt pucho, jawab pao.'),
    ]
    feat_html = ''.join(
        '<div class="col-lg-4 col-sm-6"><div class="itwd-appf th_fade_anim" data-delay="0.%d">'
        '<span class="itwd-appf__icon"><i class="%s"></i></span><div><h4>%s</h4><p>%s</p></div></div></div>'
        % (1 + i, ic, t, d) for i, (ic, t, d) in enumerate(app_features))

    steps = [('fal fa-download', 'App download karo', 'IT Wala Dai App &mdash; Android &amp; Windows (jaldi aa raha hai).'),
             ('fal fa-hand-pointer', 'C ya C++ chuno', 'Apna course select karo &mdash; bilkul free.'),
             ('fal fa-chalkboard-user', 'Live class join karo', 'Schedule app pe milega, bas join karo aur seekho.')]
    step_html = ''.join(
        '<div class="col-md-4"><div class="itwd-step th_fade_anim" data-delay="0.%d"><span class="itwd-step__num">%d</span>'
        '<i class="%s itwd-step__icon"></i><h4>%s</h4><p>%s</p></div></div>' % (2 + 2 * i, i + 1, ic, t, d)
        for i, (ic, t, d) in enumerate(steps))

    return '''
<section class="itwd-plus2 space">
  <div class="container">
    <div class="title-area text-center mb-30">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">For +2 Students &middot; 100%% Free</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">C aur C++ seekho &mdash; bilkul free</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Saari padhai <strong>IT Wala Dai App</strong> pe hogi &mdash; live classes, videos, notes aur practice. Bas app download karo aur shuru ho jao.</p>
    </div>
    <ul class="itwd-pills th_fade_anim">
      <li><i class="fal fa-badge-percent"></i>Rs. 0 fees</li>
      <li><i class="fal fa-mobile"></i>Sab kuch App pe</li>
      <li><i class="fal fa-book-open"></i>+2 syllabus ke saath</li>
    </ul>
    <div class="row gy-4">%s</div>
  </div>
</section>
<section class="itwd-plus2-app space-bottom">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">IT Wala Dai App</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Padhai sab ek App pe</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Class, notes, practice, test &mdash; sab kuch tumhare phone ya laptop pe.</p>
    </div>
    <div class="row gy-4">%s</div>
  </div>
</section>
<div class="itwd-plus2-banner th_fade_anim">%s</div>
<section class="itwd-plus2-steps space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Kaise shuru karein</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">3 simple steps</span></h2>
    </div>
    <div class="row gy-4">%s</div>
    <p class="itwd-note text-center mt-30 th_fade_anim">App jaldi launch ho raha hai &mdash; abhi join karo, launch hote hi sabse pehle access milega.</p>
  </div>
</section>
''' % (cards, feat_html, home_app_banner(), step_html)


TESTIMONIALS = [
    ('Bibek K.', 'BSc CSIT &middot; TU', 'AI Attendance Project',
     'Mera AI attendance project ab college mein actually use hota hai. External ne &lsquo;production-ready&rsquo; bola!'),
    ('Kritika B.', 'BCA &middot; Pokhara Univ.', 'Viva Prep',
     'Documentation aur viva prep sabse helpful tha. Pehli baar viva mein confident thi.'),
    ('Rohan M.', 'BIT &middot; Purbanchal', 'Mentor Review',
     'Mentor review ne meri bad habits pakdi. Isi project se internship mili.'),
]


def testimonials_content():
    def initials(n):
        return ''.join(w[0] for w in n.replace('.', '').split()[:2]).upper()

    stars = '<span class="itwd-t-stars" aria-label="5 out of 5">' + '<i class="fas fa-star"></i>' * 5 + '</span>'

    def person(name, meta):
        return ('<div class="itwd-t-person"><span class="itwd-t-avatar">%s</span>'
                '<div class="itwd-t-person__text"><h4>%s</h4><p>%s</p></div></div>' % (initials(name), name, meta))

    # featured: full-width banner (quote left, student right)
    feat_name, feat_meta, feat_tag, feat_quote = TESTIMONIALS[0]
    featured = ('<article class="itwd-t-featured th_fade_anim">'
                '<div class="itwd-t-featured__quote"><i class="fas fa-quote-left itwd-t-featured__mark"></i>'
                '<div class="itwd-t-featured__meta">%s<span class="itwd-t-chip">%s</span></div>'
                '<blockquote>%s</blockquote></div>'
                '<div class="itwd-t-featured__who">%s</div></article>'
                % (stars, feat_tag, feat_quote, person(feat_name, feat_meta)))
    # equal cards in one row: tag sits next to the stars (never squeezed beside the name)
    cards = ''.join(
        '<div class="col-lg-4 col-md-6"><article class="itwd-t-card th_fade_anim" data-delay="%.1f">'
        '<div class="itwd-t-card__top">%s<span class="itwd-t-chip">%s</span></div>'
        '<i class="fas fa-quote-right itwd-t-card__mark"></i>'
        '<p class="itwd-t-card__quote">%s</p>%s</article></div>'
        % (0.1 + i * 0.15, stars, t, q, person(n, m)) for i, (n, m, t, q) in enumerate(TESTIMONIALS[1:]))
    share = ('<div class="col-lg-4 col-md-12"><a href="/contact" class="itwd-t-share th_fade_anim" data-delay="0.4">'
             '<span class="itwd-t-share__icon"><i class="fal fa-pen-nib"></i></span>'
             '<strong>Apni story share karo</strong><small>IT Wala Dai ke saath project banaya? Humein batao — '
             'tumhari story yahan aa sakti hai.</small><span class="itwd-t-share__go">Story bhejo <i class="far fa-arrow-right"></i></span></a></div>')
    stats = [('1,200+', 'Happy students', 'fal fa-face-smile'), ('5.0', 'Average rating', 'fal fa-star'),
             ('92%', 'Got A / A+ grade', 'fal fa-award'), ('340+', 'Projects shipped', 'fal fa-rocket')]
    stat_html = ''.join('<div class="col-6 col-lg-3"><div class="itwd-t-stat th_fade_anim"><span class="itwd-t-stat__icon"><i class="%s"></i></span>'
                        '<strong>%s</strong><span>%s</span></div></div>' % (ic, v, l) for v, l, ic in stats)
    return '''
<section class="itwd-testi space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Testimonials</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Unke projects, unki zubaani.</span></h2>
      <p class="th_fade_anim itwd-sub-lead">CSIT, BIT, BCA students jinhone IT Wala Dai ke saath apna project banaya.</p>
    </div>
    <div class="row gy-4 mb-50">%s</div>
    %s
    <div class="row gy-4 mt-1">%s%s</div>
    <div class="text-center mt-50 th_fade_anim"><a href="/programs" class="th-btn">Apna project shuru karo%s</a></div>
  </div>
</section>
''' % (stat_html, featured, cards, share, B.ARROW_SVG)


def start_modal_html():
    s = read('programs/index.html')
    st = s.index('<div class="itwd-modal" id="start-project"')
    return s[st:B.block(s, st)]


def create_new_pages(force=False):
    modal = start_modal_html()
    pages = {
        'plus-two/index.html': ('For +2 Students &#8211; Free C &amp; C++ Courses &#8211; IT Wala Dai',
                                'Free C and C++ programming courses for +2 (Grade 11-12) students in Nepal.',
                                'Free C &amp; C++ for +2', 'For +2', plus_two_content(), modal),
        'testimonials/index.html': ('Testimonials &#8211; IT Wala Dai',
                                    'What CSIT, BIT and BCA students say about building their projects with IT Wala Dai.',
                                    'Testimonials', 'Testimonials', testimonials_content(), ''),
    }
    for rel, (title, desc, ctitle, crumb, content, extra) in pages.items():
        path = ROOT / rel
        regenerate = force is True or (isinstance(force, str) and force in rel)
        if path.exists() and '<!-- itwd:page -->' in path.read_text(encoding='utf-8') and not regenerate:
            print('kept', rel, '(exists; use --force-new-pages to regenerate)')
            continue
        if path.exists() and '<!-- itwd:page -->' not in path.read_text(encoding='utf-8'):
            # an old Escul template page lives here -> keep a copy instead of deleting it
            backup = ROOT / '_original' / rel
            backup.parent.mkdir(parents=True, exist_ok=True)
            if not backup.exists():
                backup.write_text(path.read_text(encoding='utf-8'), encoding='utf-8')
                print('backed up template page ->', backup.relative_to(ROOT))
        write(rel, shell_from_contact(title, desc, ctitle, crumb, '<!-- itwd:page -->' + content, extra))


def main():
    # --force-new-pages regenerates both new pages; --force-new-pages=testimonials (or =plus-two) just one
    force = False
    for arg in sys.argv[1:]:
        if arg == '--force-new-pages':
            force = True
        elif arg.startswith('--force-new-pages='):
            force = arg.split('=', 1)[1]
    create_new_pages(force=force)
    for rel, active in PAGES.items():
        s = read(rel)
        s = set_menus(s, active)
        if rel == 'programs/index.html':
            s = patch_projects(s)
        if rel == 'contact/index.html':
            s = s.replace('Dai se seedhi baat — hello@itwaladai.com', 'Dai se seedhi baat — itwaladai@gmail.com')
        write(rel, s)


if __name__ == '__main__':
    main()
