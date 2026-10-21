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
from urllib.parse import quote
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


def shell_plain(title, description, content, body_extra=''):
    """Contact-page shell without the theme breadcrumb banner (for pages with their own header)."""
    s = shell_from_contact(title, description, 'x', 'x', content, body_extra)
    st = s.index('<div class="breadcumb-wrapper')
    return s[:st] + s[B.block(s, st):]


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

    # Edunex-style course cards (they link to the course detail pages)
    cards = ''.join('<div class="col-xl-4 col-md-6">%s</div>' % course_card(c, 0.2 + 0.2 * i) for i, c in enumerate(COURSES))

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
    <div class="row gy-4 justify-content-center">%s</div>
  </div>
</section>
<section class="itwd-plus2-app space-bottom" id="app">
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


# --------------------------------------------------------------------------- +2 courses (cards + detail pages)

INSTRUCTOR = dict(
    name='Sachin Kushwaha',
    role='IT Wala Dai Mentor &middot; C &amp; C++',
    bio=('Sachin Kushwaha IT Wala Dai ke mentor hain. Wo +2 students ko C aur C++ simple Hinglish mein, '
         'real examples aur roz ki practice ke saath sikhate hain &mdash; taaki concept clear ho aur exam ke saath '
         'coding confidence bhi aaye.'),
)


def instructor_photo():
    for p in (ROOT / 'mentor').glob('*'):
        if 'sachin' in p.stem.lower():
            return '/mentor/' + quote(p.name)
    return '/wp-content/uploads/2026/02/team_2_1.jpg'


COURSES = [
    dict(
        slug='c-programming', code='C', cls='c', name='C Programming',
        title='C Programming &mdash; zero se pointers tak',
        short='Programming ki shuruaat C se karo. Variables se lekar pointers aur file handling tak &mdash; '
              'simple language, live classes aur roz ki practice ke saath.',
        img='1515879218367-8466d910aaa4', level='Beginner', weeks='~8 weeks',
        goals=['C program likhna, compile aur run karna', 'Variables, data types aur operators samajhna',
               'if-else, switch aur loops se logic banana', 'Arrays aur strings ke saath kaam karna',
               'Functions aur recursion use karna', 'Pointers ka concept clear karna',
               'Structures se apna data type banana', 'Files mein data save aur read karna'],
        skills=['C Language', 'Logic Building', 'Problem Solving', 'Loops &amp; Patterns', 'Arrays',
                'Functions', 'Pointers', 'Structures', 'File Handling', 'Debugging'],
        desc=['Ye course un +2 students ke liye hai jo programming bilkul zero se shuru karna chahte hain. '
              'Har topic pehle simple example se samjhaya jaata hai, phir live class mein saath mein code karte hain.',
              'Saari classes <strong>IT Wala Dai App</strong> pe hongi &mdash; live class miss ho jaye to recording dekh lo, '
              'notes download karo aur har chapter ke baad practice questions solve karo.'],
        reqs=['Koi coding experience zaroori nahi', 'Laptop/computer best hai &mdash; phone pe online compiler bhi chalega',
              'Internet connection (live classes ke liye)', 'Seekhne ka mann &mdash; baaki Dai sambhal lega!'],
        audience=['Grade 11&ndash;12 ke Computer Science students', 'Jo programming pehli baar seekh rahe hain',
                  'Board exam ke C questions ki tayyari karne wale', 'Jo aage BSc CSIT / BIT / BCA karna chahte hain'],
        modules=[
            ('Getting Started', ['Programming kya hai aur C kyun?', 'Setup: VS Code / Code::Blocks + GCC',
                                 'Pehla program: Hello World']),
            ('C ke Basics', ['Variables &amp; data types', 'Input / Output: printf &amp; scanf',
                             'Operators &amp; expressions', 'Type conversion']),
            ('Control Flow', ['if, else-if &amp; switch', 'Loops: for, while, do-while', 'break &amp; continue',
                              'Practice: pattern printing']),
            ('Arrays &amp; Strings', ['1D arrays', '2D arrays (matrix)', 'Strings &amp; string functions',
                                      'Practice: searching &amp; sorting']),
            ('Functions', ['Function banana aur call karna', 'Call by value vs call by reference', 'Recursion']),
            ('Pointers, Structures &amp; Files', ['Pointers ke basics', 'Pointers + arrays', 'Structures &amp; unions',
                                                   'File handling: fopen, fprintf, fscanf']),
        ],
    ),
    dict(
        slug='cpp-programming', code='C++', cls='cpp', name='C++ Programming',
        title='C++ Programming &mdash; OOP simple tareeke se',
        short='C ke baad agla level. Classes, objects, inheritance aur polymorphism &mdash; '
              'Object-Oriented Programming ko real examples aur mini project ke saath seekho.',
        img='1555066931-4365d14bab8c', level='Intermediate', weeks='~8 weeks',
        goals=['C aur C++ ka difference samajhna', 'Classes aur objects design karna',
               'Constructors &amp; destructors use karna', 'Inheritance se code reuse karna',
               'Function &amp; operator overloading', 'Virtual functions aur polymorphism',
               'fstream se file I/O karna', 'Ek complete mini project banana'],
        skills=['C++', 'OOP', 'Classes &amp; Objects', 'Inheritance', 'Polymorphism', 'Overloading',
                'Templates', 'File I/O', 'Exception Handling', 'Mini Project'],
        desc=['Is course mein hum Object-Oriented Programming ko simple tareeke se samjhenge &mdash; har concept ek '
              'real-life example (student, bank account, library) ke saath.',
              'Saari classes <strong>IT Wala Dai App</strong> pe hongi &mdash; live classes, recordings, notes aur practice '
              'questions sab ek jagah. Course ke end mein tum apna mini project banaoge.'],
        reqs=['C ke basics aate ho to best (nahi aate to pehle hamara free C course karo)',
              'Laptop/computer best hai &mdash; phone pe online compiler bhi chalega',
              'Internet connection (live classes ke liye)', 'Practice karne ka josh!'],
        audience=['Grade 12 ke Computer Science students (OOP chapter)', 'Jinhone C seekh liya hai aur aage badhna hai',
                  'Jo OOP concepts clear karna chahte hain', 'Jo aage BSc CSIT / BIT / BCA karna chahte hain'],
        modules=[
            ('C se C++ tak', ['C vs C++', 'cin, cout &amp; namespaces', 'References &amp; function overloading']),
            ('OOP Basics', ['Classes &amp; objects', 'Access specifiers', 'Constructors &amp; destructors',
                            'this pointer &amp; static members']),
            ('Inheritance', ['Types of inheritance', 'Constructors in inheritance', 'Practice: student result system']),
            ('Polymorphism', ['Function overloading', 'Operator overloading', 'Virtual functions',
                              'Abstract classes']),
            ('Files &amp; Templates', ['File I/O with fstream', 'Templates ka intro', 'Exception handling basics']),
            ('Mini Project', ['Project plan: library / bank system', 'Build &amp; present']),
        ],
    ),
]

COURSE_FAQ = [
    ('Kya course sach mein free hai?', 'Haan, bilkul. Fees Rs. 0 hai &mdash; koi hidden charge nahi.'),
    ('Classes kahan hongi?', 'Saari classes IT Wala Dai App pe hongi &mdash; live classes, recordings, notes aur practice '
                             'questions sab app mein milenge. App jaldi launch ho raha hai.'),
    ('Kya pehle se coding aani chahiye?', 'C course bilkul zero se shuru hota hai. C++ ke liye C ke basics helpful hain '
                                          '&mdash; nahi aate to pehle free C course karo.'),
    ('Laptop zaroori hai?', 'Laptop/computer best hai. Classes phone pe bhi dekh sakte ho aur practice online compiler pe '
                            'kar sakte ho.'),
    ('Join kaise karein?', '"Free mein join karo" dabao, form bharo &mdash; WhatsApp pe class details aur app access ki '
                           'jaankari hum bhejenge.'),
]


def course_url(c):
    return '/plus-two/%s' % c['slug']


def n_lessons(c):
    return sum(len(ls) for _, ls in c['modules'])


def course_card(c, delay=0.2):
    url = course_url(c)
    return (
        '<article class="itwd-ec itwd-ec--%(cls)s th_fade_anim" data-delay="%(delay).1f">'
        '<div class="itwd-ec__img"><a href="%(url)s" aria-label="%(name)s"><img src="%(img)s" alt="%(name)s" loading="lazy" decoding="async"></a>'
        '<span class="itwd-ec__lang">%(code)s</span>'
        '<button type="button" class="itwd-ec__wish" data-wish="%(slug)s" aria-label="Save course"><i class="far fa-heart"></i></button></div>'
        '<div class="itwd-ec__body">'
        '<div class="itwd-ec__catlvl"><span class="itwd-ec__cat">+2 Computer Science</span><span class="itwd-ec__lvl">%(level)s</span></div>'
        '<h3 class="itwd-ec__title"><a href="%(url)s">%(title)s</a></h3>'
        '<div class="itwd-ec__author"><img src="%(photo)s" alt="%(iname)s"><span>%(iname)s</span></div>'
        '<div class="itwd-ec__meta"><span><i class="fal fa-book-open"></i>%(lessons)d Lessons</span>'
        '<span><i class="fal fa-clock"></i>%(weeks)s</span><span><i class="fal fa-signal-stream"></i>Live</span></div>'
        '<div class="itwd-ec__foot"><span class="itwd-ec__app"><i class="fal fa-mobile"></i>IT Wala Dai App</span>'
        '<span class="itwd-ec__price">Free</span></div>'
        '<a href="%(url)s" class="th-btn w-100 itwd-ec__btn">Course dekho%(arrow)s</a>'
        '</div></article>'
        % dict(c, url=url, img=B.unsplash(c['img']), delay=delay, photo=instructor_photo(),
               iname=INSTRUCTOR['name'], lessons=n_lessons(c), arrow=B.ARROW_SVG))


def course_detail_content(c):
    photo = instructor_photo()
    others = [o for o in COURSES if o['slug'] != c['slug']]
    goals = ''.join('<li><span class="itwd-ico"><i class="fas fa-check"></i></span>%s</li>' % g for g in c['goals'])
    skills = ''.join('<li>%s</li>' % s for s in c['skills'])
    reqs = ''.join('<li>%s</li>' % r for r in c['reqs'])
    audience = ''.join('<div class="col-md-6"><div class="itwd-cd-aud"><span class="itwd-ico"><i class="fas fa-check"></i></span><span>%s</span></div></div>' % a
                       for a in c['audience'])
    mods = []
    for i, (mname, lessons) in enumerate(c['modules']):
        rows = ''.join('<li><span class="itwd-cd-lesson__play"><i class="fas fa-play"></i></span><span>%s</span>'
                       '<em class="itwd-cd-lesson__tag">Live</em><i class="fal fa-lock itwd-cd-lesson__lock"></i></li>' % l
                       for l in lessons)
        mods.append(
            '<div class="itwd-acc%(open)s"><button type="button" class="itwd-acc__head" aria-expanded="%(exp)s">'
            '<span class="itwd-acc__num">%(num)02d</span><span class="itwd-acc__title">%(name)s<small>%(n)d lessons</small></span>'
            '<i class="far fa-chevron-down itwd-acc__chev"></i></button>'
            '<div class="itwd-acc__body"><div><ul class="itwd-cd-lessons">%(rows)s</ul></div></div></div>'
            % dict(open=' is-open' if i == 0 else '', exp='true' if i == 0 else 'false', num=i + 1, name=mname,
                   n=len(lessons), rows=rows))
    faqs = ''.join(
        '<div class="itwd-acc%s"><button type="button" class="itwd-acc__head" aria-expanded="%s">'
        '<span class="itwd-acc__q">Q%d.</span><span class="itwd-acc__title">%s</span><i class="far fa-chevron-down itwd-acc__chev"></i></button>'
        '<div class="itwd-acc__body"><div><p class="itwd-acc__answer">%s</p></div></div></div>'
        % (' is-open' if i == 0 else '', 'true' if i == 0 else 'false', i + 1, q, a) for i, (q, a) in enumerate(COURSE_FAQ))
    includes = [('fal fa-signal-stream', 'Live classes on IT Wala Dai App'), ('fal fa-circle-play', 'Class recordings'),
                ('fal fa-file-lines', 'Notes &amp; PDF'), ('fal fa-laptop-code', 'Practice questions &amp; mock tests'),
                ('fal fa-comments-question', 'Doubt solving'), ('fal fa-mobile', 'Mobile &amp; desktop pe access')]
    inc = ''.join('<li><span><i class="%s"></i></span>%s</li>' % x for x in includes)
    lessons = n_lessons(c)
    related = ''.join('<div class="col-lg-4 col-md-6">%s</div>' % course_card(o, 0.2) for o in others)
    return '''
<section class="itwd-cd-hero">
  <div class="container">
    <div class="row">
      <div class="col-lg-8">
        <ul class="itwd-cd-crumb th_fade_anim"><li><a href="/"><i class="fal fa-house"></i>Home</a></li><li><a href="/plus-two">For +2</a></li><li>%(name)s</li></ul>
        <span class="itwd-cd-cat th_fade_anim">+2 Computer Science &middot; Free Course</span>
        <h1 class="itwd-cd-title th_fade_anim">%(title)s</h1>
        <p class="itwd-cd-lead th_fade_anim">%(short)s</p>
        <ul class="itwd-cd-pills th_fade_anim">
          <li><i class="fal fa-signal-bars"></i>%(level)s</li>
          <li><i class="fal fa-book-open"></i>%(lessons)d Lessons</li>
          <li><i class="fal fa-clock"></i>%(weeks)s</li>
          <li><i class="fal fa-signal-stream"></i>Live on App</li>
          <li class="is-free"><i class="fal fa-tag"></i>Rs. 0</li>
        </ul>
        <div class="itwd-cd-by th_fade_anim">
          <div class="itwd-cd-by__who"><img src="%(photo)s" alt="%(iname)s"><span><small>Instructor</small><strong>%(iname)s</strong></span></div>
          <div class="itwd-cd-by__actions">
            <button type="button" class="itwd-cd-action" data-share><i class="far fa-share-nodes"></i>Share</button>
            <button type="button" class="itwd-cd-action" data-wish="%(slug)s"><i class="far fa-heart"></i>Wishlist</button>
          </div>
        </div>
        <a href="#start-project" class="th-btn w-100 itwd-start itwd-cd-mobile-join d-lg-none" data-kind="course" data-project="%(name)s">Free mein join karo%(arrow)s</a>
      </div>
    </div>
  </div>
  <span class="itwd-cd-hero__spark" aria-hidden="true"><i class="fas fa-sparkles"></i></span>
</section>

<section class="itwd-cd space-bottom">
  <div class="container">
    <div class="row gx-xl-5 gy-5">
      <div class="col-lg-8 itwd-cd__main">
        <nav class="itwd-cd-tabs" aria-label="Course sections">
          <a href="#cd-overview" class="is-active">Overview</a><a href="#cd-curriculum">Curriculum</a>
          <a href="#cd-instructor">Instructor</a><a href="#cd-faq">FAQs</a>
        </nav>

        <div id="cd-overview" class="itwd-cd-sec">
          <div class="itwd-cd-box th_fade_anim"><h3>Kya seekhoge</h3><ul class="itwd-cd-goals">%(goals)s</ul></div>
          <h3 class="itwd-cd-h">Skills jo milengi</h3><ul class="itwd-cd-skills th_fade_anim">%(skills)s</ul>
          <h3 class="itwd-cd-h">Course ke baare mein</h3><div class="itwd-cd-desc th_fade_anim"><p>%(desc0)s</p><p>%(desc1)s</p></div>
          <h3 class="itwd-cd-h">Requirements</h3><ul class="itwd-cd-reqs th_fade_anim">%(reqs)s</ul>
          <h3 class="itwd-cd-h">Ye course kiske liye hai</h3><div class="row g-3 th_fade_anim">%(audience)s</div>
        </div>

        <div id="cd-curriculum" class="itwd-cd-sec">
          <div class="itwd-cd-h itwd-cd-h--row"><h3>Course curriculum</h3><span>%(nmods)d modules &middot; %(lessons)d lessons &middot; live + recorded</span></div>
          <div class="itwd-acc-group">%(mods)s</div>
        </div>

        <div id="cd-instructor" class="itwd-cd-sec">
          <h3 class="itwd-cd-h">Apne instructor se milo</h3>
          <div class="itwd-cd-inst th_fade_anim">
            <div class="itwd-cd-inst__img"><img src="%(photo)s" alt="%(iname)s"></div>
            <div class="itwd-cd-inst__body">
              <h4>%(iname)s</h4><span class="itwd-cd-inst__role">%(irole)s</span>
              <ul class="itwd-cd-inst__stats"><li><strong>2</strong><span>Courses</span></li><li><strong>Live</strong><span>Classes</span></li><li><strong>+2</strong><span>Focus</span></li></ul>
              <p>%(ibio)s</p>
            </div>
          </div>
        </div>

        <div id="cd-faq" class="itwd-cd-sec">
          <h3 class="itwd-cd-h">Aksar pooche jaane wale sawaal</h3>
          <div class="itwd-acc-group">%(faqs)s</div>
        </div>
      </div>

      <div class="col-lg-4">
        <aside class="itwd-cd-side">
          <div class="itwd-cd-side__img"><img src="%(img)s" alt="%(name)s"><span class="itwd-cd-side__lang">%(code)s</span></div>
          <div class="itwd-cd-side__price"><strong>Free</strong><span>100%% Free</span></div>
          <a href="#start-project" class="th-btn w-100 itwd-start" data-kind="course" data-project="%(name)s">Free mein join karo%(arrow)s</a>
          <a href="/plus-two#app" class="itwd-cd-side__ghost"><i class="fal fa-mobile"></i>App jaldi aa raha hai</a>
          <p class="itwd-cd-side__note"><i class="fal fa-shield-check"></i>Koi fees nahi, koi card detail nahi</p>
          <h4>Is course mein milega</h4>
          <ul class="itwd-cd-side__inc">%(inc)s</ul>
          <div class="itwd-cd-side__share"><span>Share karo:</span>
            <a href="https://wa.me/?text=%(shareurl)s" target="_blank" rel="noopener" aria-label="WhatsApp"><i class="fab fa-whatsapp"></i></a>
            <a href="https://www.facebook.com/sharer/sharer.php?u=%(shareurl)s" target="_blank" rel="noopener" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
            <button type="button" data-share aria-label="Copy link"><i class="far fa-link"></i></button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</section>

<section class="itwd-cd-related space-bottom">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Keep learning</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Aur free courses</span></h2>
    </div>
    <div class="row gy-4 justify-content-center">%(related)s</div>
  </div>
</section>
''' % dict(c, title=c['title'], photo=photo, iname=INSTRUCTOR['name'], irole=INSTRUCTOR['role'], ibio=INSTRUCTOR['bio'],
           lessons=lessons, nmods=len(c['modules']), goals=goals, skills=skills, desc0=c['desc'][0], desc1=c['desc'][1],
           reqs=reqs, audience=audience, mods=''.join(mods), faqs=faqs, inc=inc, img=B.unsplash(c['img']),
           arrow=B.ARROW_SVG, related=related,
           shareurl=quote('IT Wala Dai — free %s course: https://itwaladai.com%s' % (c['name'], course_url(c))))


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
    for c in COURSES:
        pages['plus-two/%s/index.html' % c['slug']] = (
            '%s &#8211; Free +2 Course &#8211; IT Wala Dai' % c['name'],
            'Free %s course for +2 students in Nepal, live on the IT Wala Dai App. Instructor: %s.' % (c['name'], INSTRUCTOR['name']),
            None, None, course_detail_content(c), modal)
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
        if ctitle is None:
            write(rel, shell_plain(title, desc, '<!-- itwd:page -->' + content, extra))
        else:
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
    pages = dict(PAGES, **{'plus-two/%s/index.html' % c['slug']: '/plus-two' for c in COURSES})
    for rel, active in pages.items():
        s = read(rel)
        s = set_menus(s, active)
        if rel == 'programs/index.html':
            s = patch_projects(s)
        if rel == 'contact/index.html':
            s = s.replace('Dai se seedhi baat — hello@itwaladai.com', 'Dai se seedhi baat — itwaladai@gmail.com')
        write(rel, s)


if __name__ == '__main__':
    main()
