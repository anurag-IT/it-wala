"""
IT Wala Dai — static site builder.

Builds the live pages from the original Escul template pages:

    /                  -> index.html            (from _original/index.html)
    /programs          -> programs/index.html   (Find Project)
    /about             -> about/index.html
    /contact           -> contact/index.html
    /community         -> community/index.html  (Coming soon + countdown)

Nothing from the template is deleted. Template sections that are not used
are kept inside <template data-itwd-hidden="..."> tags: they stay in the
HTML but are never rendered. To bring one back, remove the <template> wrapper.

Run:  python scripts/build_site.py
"""
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parent.parent

SRC = {
    'home': ROOT / '_original' / 'index.html',      # Home II (Digital Education)
    'hi': ROOT / 'home-i-university' / 'index.html',  # Home (University)
    'hii': ROOT / 'home-ii-online-education' / 'index.html',  # Home (Online Education)
    'contact': ROOT / 'contact-us' / 'index.html',
    'about': ROOT / 'about-us' / 'index.html',
}
POST_ID = {'home': '4945', 'hi': '4897', 'hii': '4943', 'contact': '6038', 'about': '5912'}
_cache = {}


def src(key):
    if key not in _cache:
        _cache[key] = SRC[key].read_text(encoding='utf-8')
    return _cache[key]


# --------------------------------------------------------------------------- helpers

def absify(s):
    """Make asset paths root-absolute so a page works at any URL depth."""
    s = re.sub(r'(?:\.\./)+(wp-content|wp-includes|wp-json)/', r'/\1/', s)
    s = re.sub(r'(?<=[\s"\'(,=])(wp-content|wp-includes|wp-json)/', r'/\1/', s)
    return s


def kill_template_links(s):
    """Relative links into the old template pages -> '#' (those pages are hidden)."""
    return re.sub(r'href="(?!#|https?:|tel:|mailto:|/|javascript:)[^"]*"', 'href="#"', s)


def block(html, start):
    """Return end index of the element whose opening tag starts at `start`."""
    tag = re.match(r'<(\w+)', html[start:]).group(1)
    depth = 0
    for t in re.finditer(r'<(/?)%s\b[^>]*>' % tag, html[start:]):
        depth += -1 if t.group(1) else 1
        if depth == 0:
            return start + t.end()
    raise ValueError('unclosed <%s> at %d' % (tag, start))


def section(key, did):
    html = src(key)
    m = re.search(r'<div class="elementor-element elementor-element-%s ' % did, html)
    if not m:
        raise KeyError('%s: section %s not found' % (key, did))
    return absify(html[m.start():block(html, m.start())])


def wrap(key, html):
    pid = POST_ID[key]
    return ('<div data-elementor-type="wp-page" data-elementor-id="%s" class="elementor elementor-%s">\n%s\n</div>\n'
            % (pid, pid, html))


def hidden(name, html):
    return '\n<template data-itwd-hidden="%s">\n%s\n</template>\n' % (name, html)


def rep(s, old, new, count=1):
    n = s.count(old)
    if n != count:
        raise AssertionError('expected %d x %r, found %d' % (count, old[:80], n))
    return s.replace(old, new)


def resub(s, pattern, new, count=1, flags=re.S):
    out, n = re.subn(pattern, new, s, flags=flags)
    if n != count:
        raise AssertionError('expected %d x /%s/, found %d' % (count, pattern[:80], n))
    return out


def seq(s, pattern, values, flags=re.S):
    """Replace successive matches of `pattern` with successive values (callable or str)."""
    it = iter(values)
    matches = list(re.finditer(pattern, s, flags))
    if len(matches) != len(values):
        raise AssertionError('expected %d x /%s/, found %d' % (len(values), pattern[:80], len(matches)))
    out, last = [], 0
    for m, v in zip(matches, it):
        out.append(s[last:m.start()])
        out.append(v(m) if callable(v) else v)
        last = m.end()
    out.append(s[last:])
    return ''.join(out)


def split_items(s, opener):
    """Split s into [prefix, item1, item2, ..., suffix] where items are elements starting with `opener`."""
    parts, pos, items = [], 0, []
    starts = [m.start() for m in re.finditer(re.escape(opener), s)]
    # keep only top-level ones (not nested inside a previous item)
    for st in starts:
        if items and st < items[-1][1]:
            continue
        items.append((st, block(s, st)))
    prefix = s[:items[0][0]]
    suffix = s[items[-1][1]:]
    between = [s[items[i][1]:items[i + 1][0]] for i in range(len(items) - 1)]
    return prefix, [s[a:b] for a, b in items], between, suffix


ARROW_SVG = re.search(r'<svg class="ms-2" width="16" height="14".*?</svg>', src('home'), re.S).group(0)

# --------------------------------------------------------------------------- brand

SITE = 'IT Wala Dai'
EMAIL = 'itwaladai@gmail.com'
PHONE = '+977 982-3415625'
PHONE_TEL = '+9779823415625'
WHATSAPP = '9779823415625'
SOCIAL = {
    'youtube': 'https://youtube.com/@itwaladai',
    'instagram': 'https://instagram.com/itwaladai',
    'facebook': 'https://facebook.com/itwaladai',
    'github': 'https://github.com/itwaladai',
}
LOGO = '/assets/itwd/logo.svg'
LOGO_WHITE = '/assets/itwd/logo-white.svg'

NAV = [
    ('/', 'Home'),
    ('/programs', 'Find Project'),
    ('/community', 'Community'),
    ('/about', 'About'),
    ('/contact', 'Contact'),
]


def nav_items(active):
    out = []
    for i, (href, label) in enumerate(NAV):
        cls = 'menu-item menu-item-type-custom menu-item-object-custom itwd-menu-%d' % i
        if href == active:
            cls += ' current-menu-item current_page_item'
        out.append('<li class="%s"><a href="%s">%s</a></li>' % (cls, href, label))
    return '\n'.join(out)


def social_links(cls_i=''):
    icons = [('facebook', 'fab fa-facebook-f'), ('instagram', 'fab fa-instagram'),
             ('youtube', 'fab fa-youtube'), ('github', 'fab fa-github')]
    return ''.join('<a href="%s" target="_blank" rel="noopener"><i aria-hidden="true" class="%s"></i></a>'
                   % (SOCIAL[k], ic) for k, ic in icons)


# --------------------------------------------------------------------------- shell (head/header/footer)

def build_shell(active, title, description):
    """Return (before_content, after_content) using the original home page shell."""
    html = src('home')
    a = html.index('<div data-elementor-type="wp-page" data-elementor-id="4945"')
    b = block(html, a)
    before, after = html[:a], html[b:]

    # ---- head
    before = re.sub(r'<title>.*?</title>', '<title>%s</title>' % title, before, count=1)
    extra_css = ''.join(
        "<link rel='stylesheet' id='itwd-post-%s-css' href='%s' media='all' />\n" % (k, href)
        for k, href in [
            ('4897', 'wp-content/uploads/elementor/css/post-48978fc8.css?ver=1791735267'),
            ('4943', 'wp-content/uploads/elementor/css/post-4943417a.css?ver=1791735265'),
            ('6038', 'wp-content/uploads/elementor/css/post-6038d4f1.css?ver=1791709444'),
            ('5912', 'wp-content/uploads/elementor/css/post-59125702.css?ver=1791744650'),
        ])
    extra_css += ('<meta name="description" content="%s" />\n'
                  "<link rel='stylesheet' id='itwd-css' href='/assets/itwd/itwd.css' media='all' />\n" % description)
    before = rep(before, '</head>', extra_css + '</head>')

    # ---- preloader (+ its "Cancel Preloader" button) removed
    st = before.index('<div class="preloader ">')
    before = before[:st] + before[block(before, st):]

    # ---- header: menus (mobile + desktop)
    for ul_open in ('<ul id="menu-primary-menu" class="">', '<ul id="menu-primary-menu-1" class="escul-menu">'):
        st = before.index(ul_open)
        en = block(before, st)
        inner = before[st + len(ul_open):en - len('</ul>')]
        before = (before[:st] + ul_open + '\n' + nav_items(active)
                  + hidden('template-menu', inner) + '</ul>' + before[en:])

    # ---- header: side menu
    before = rep(before, '<p class="about-text">University education is the foundation for shaping skilled, '
                         'knowledgeable, and responsible individuals who contribute meaningfully to society.</p>'
                         '<a href="courses/index.html" class="th-btn btn-sm">Enroll Now',
                 '<p class="about-text">IT Wala Dai — Nepal ka IT big brother. +2 aur Bachelor IT students ke liye '
                 'free courses, project guidance, college info aur community.</p>'
                 '<a href="/programs" class="th-btn btn-sm">Project shuru karo')
    st = before.index('<div id="escul_recent_posts_widget-3"')
    en = block(before, st)
    before = before[:st] + hidden('sidemenu-recent-posts', before[st:en]) + before[en:]
    before = rep(before, '<h3 class="widget_title">Subscribe Now</h3>', '<h3 class="widget_title">Updates pao</h3>')
    before = resub(before, r'(<div class="th-social style3 mt-30">).*?(</div>)', r'\g<1>%s\2' % social_links())

    # ---- header: buttons
    before = resub(before, r'<button type="button" class="icon-btn style-border searchBoxToggler[^"]*">.*?</button>',
                   lambda m: hidden('header-search', m.group(0)))
    before = rep(before, '<a href="#" class="th-btn">APPLY NOW', '<a href="/contact" class="th-btn">FREE CONSULT')

    # ---- logos / home links
    before = before.replace('wp-content/uploads/2026/01/logo.svg" alt="logo"', LOGO + '" alt="IT Wala Dai"')

    # ---- footer
    after = rep(after, 'Join Our Newsletter', 'Dai ki updates, seedha inbox mein')
    after = rep(after, 'Subscribe our newsletter to get our latest update &amp; news.',
                'Naye free courses, hackathon dates aur project ideas — sabse pehle tumhe.')
    after = rep(after, 'wp-content/uploads/2026/01/logo.svg" alt="logo"', LOGO_WHITE + '" alt="IT Wala Dai"')
    after = rep(after, '<p class="about-text">University education is the foundation for shaping skilled, knowledgeable.</p>',
                '<p class="about-text">AI se apna college project banao. Built in Nepal, for Nepali students.</p>')
    after = rep(after, 'Take Your Learning with You', 'IT Wala Dai App — coming soon')
    after = resub(after, r'<a href="#" class="th-btn style2 btn-sm"><i class="fab fa-apple"></i>.*?</a>',
                  '<a href="#" onclick="return false" class="th-btn style2 btn-sm"><i class="fab fa-windows"></i>'
                  '<span class="details"><span class="small-text">Coming soon on</span><span class="big-text">Windows</span></span></a>')
    after = rep(after, '<span class="small-text">Get It On</span><span class="big-text">Play Store</span>',
                '<span class="small-text">Coming soon on</span><span class="big-text">Google Play</span>')
    after = rep(after, '<a href="#" class="th-btn style8 btn-sm text-white ">',
                '<a href="#" onclick="return false" class="th-btn style8 btn-sm text-white ">')

    def footer_menu(title_old, title_new, items):
        nonlocal after
        st = after.index('<h3 class="widget_title">%s</h3>' % title_old)
        ul = after.index('<ul ', st)
        en = block(after, ul)
        ul_open = after[ul:after.index('>', ul) + 1]
        lis = ''.join('<li class="menu-item"><a href="%s">%s</a></li>\n' % it for it in items)
        after = (after[:st] + '<h3 class="widget_title">%s</h3>' % title_new + after[st + len('<h3 class="widget_title">%s</h3>' % title_old):ul]
                 + ul_open + '\n' + lis + hidden('template-footer-menu', after[ul + len(ul_open):en - 5]) + '</ul>' + after[en:])

    footer_menu('Quick Links', 'Quick Links', NAV)
    footer_menu('Resources', 'For Students', [
        ('/programs', 'AI Project Lab'),
        ('/#free-courses', 'Free +2 Courses'),
        ('/programs#featured-projects', 'Project Ideas'),
        ('/#faq', 'FAQ'),
        ('/community', 'Community (coming soon)'),
    ])
    after = rep(after, '<p class="box-text">Toll Free Customer Care</p><a href="tel:+01 234 567 890" class="box-link">+01 234 567 890</a>',
                '<p class="box-text">Phone / WhatsApp</p><a href="tel:%s" class="box-link">%s</a>' % (PHONE_TEL, PHONE))
    after = rep(after, '<p class="box-text">Need live support?</p><a href="mailto:mailinfo@escul.com" class="box-link">mailinfo@escul.com</a>',
                '<p class="box-text">Email (reply 24 ghante mein)</p><a href="mailto:%s" class="box-link">%s</a>' % (EMAIL, EMAIL))
    after = rep(after, 'Follow with Us:', 'Follow @itwaladai')
    after = resub(after, r'(<div class="th-social style4">).*?(</div>)', r'\g<1>%s\2' % social_links())
    after = resub(after, r'<p class="copyright-text">.*?</p>',
                  '<p class="copyright-text">Copyright <i class="fal fa-copyright"></i> 2026 '
                  '<a href="/">IT Wala Dai</a>, Kathmandu, Nepal. All rights reserved.</p>')

    after = rep(after, '</body>', '<script src="/assets/itwd/itwd.js"></script>\n</body>')

    before, after = absify(before), absify(after)
    before, after = kill_template_links(before), kill_template_links(after)
    return before, after


def breadcrumb(title, crumb):
    html = src('about')
    st = html.index('<div class="breadcumb-wrapper')
    bc = absify(html[st:block(html, st)])
    bc = rep(bc, '<h1 class="breadcumb-title">About Us</h1>', '<h1 class="breadcumb-title">%s</h1>' % title)
    bc = rep(bc, '<li><a href="https://wordpress.themehour.net/escul">Home</a></li><li>About Us</li>',
             '<li><a href="/">Home</a></li><li>%s</li>' % crumb)
    return bc


def page(path, active, title, description, content, crumb=None):
    before, after = build_shell(active, title, description)
    if crumb:
        before = rep(before, '<div id="smooth-content">', '<div id="smooth-content">' + crumb)
        before = before.replace('<body class="home ', '<body class="')
    out = ROOT / path
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(before + content + after, encoding='utf-8')
    print('wrote', out.relative_to(ROOT))


# =========================================================================== HOME

def marquee():
    items = ["Tribhuvan University", "Pokhara University", "Purbanchal University", "Kathmandu University",
             "IOE Pulchowk", "BSc CSIT", "BIT", "BCA", "BIM", "BE Computer"]
    li = ''.join('<li class="itwd-marquee__item">%s</li>' % i for i in items)
    dup = ''.join('<li class="itwd-marquee__item" aria-hidden="true">%s</li>' % i for i in items)
    return ('<section class="itwd-marquee-section" aria-label="Universities and courses">\n'
            '  <p class="itwd-marquee__label">Students from these universities &amp; courses build with us</p>\n'
            '  <div class="itwd-marquee" style="--marquee-duration: 35s">\n'
            '    <ul class="itwd-marquee__track">%s%s</ul>\n'
            '  </div>\n'
            '</section>\n') % (li, dup)


def home_hero():
    s = section('home', 'ad58cd2')
    s = rep(s, '>Learn Smart. Learn Digital.</span>', '>AI se apna college project banao.</span>')
    s = rep(s, '>Unlock Your</span>', '>IT Wala Dai</span>')
    s = rep(s, '>Digital Education in</span>', '>get all help and classes</span>')
    s = rep(s, '>Online Learning</span>', '>for IT and +2. Let us help you choose</span>')
    s = rep(s, 'Education can be thought of as the transmission of the values and accumulated knowledge of a society.',
            'BSc CSIT, BIT, BCA, BE aur BIM students ke liye — real-life project, industry mentor, weekly code review, '
            'deployment aur viva prep. 6 hafte mein, idea se viva tak.')
    s = resub(s, r'<a href="about-us/index.html" class="th-btn">GET STARTED(.*?)</a>',
              lambda m: '<a href="/programs" class="th-btn">Project shuru karo%s</a>'
                        '<a href="/programs#how-it-works" class="th-btn style-border">Kaise kaam karta hai?</a>' % m.group(1))
    s = rep(s, '</div></div></div><div class="col-xl-5',
            '<div class="itwd-hero-proof wow animate__fadeInUp" data-wow-delay="1s">'
            '<span class="itwd-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span>'
            '<span><strong>1,200+</strong> happy students &middot; 5-star rating</span></div>'
            '</div></div></div><div class="col-xl-5')
    # "275k+ Assigned Students" card is a baked-in image with template numbers -> hidden
    s = resub(s, r'<div class="hero-info-card-wrap.*?</div></div>', lambda m: hidden('hero-info-card', m.group(0)))
    return s


def home_offerings():
    """'Browse top essential...' category slider -> core offerings."""
    s = section('home', 'faea3de')
    s = rep(s, 'Browse top essential Digital Education Courses', 'Ek jagah, sab kuch — jo IT student ko chahiye')
    items = [
        ('/programs', 'AI Project <br> Lab'),
        ('/#free-courses', 'Free +2 <br> Courses'),
        ('/community', 'Student <br> Community'),
        ('/programs#categories', 'College <br> Finder'),
        ('/#more-for-plus-two', 'Monthly <br> Hackathon'),
    ]
    s = seq(s, r'<h3 class="box-title"><a href="[^"]*">[^<]*<br>[^<]*</a></h3><a class="icon-btn style8" href="[^"]*">',
            ['<h3 class="box-title"><a href="%s">%s</a></h3><a class="icon-btn style8" href="%s">' % (h, t, h) for h, t in items])
    return s


def free_courses(for_about=False):
    """Home I (University) 'Course categories' grid -> Free +2 coding courses (app promo)."""
    s = section('hi', 'a6f5da4')
    s = rep(s, 'data-id="a6f5da4"', 'data-id="a6f5da4" id="free-courses"')
    s = rep(s, '/>COURSE CATEGORIES</span>', '/>Free +2 Computer Courses for +2 Students</span>')
    s = rep(s, 'Explore diverse learning paths within our course\xa0categories</span></h2>',
            'Free ma Computer courses</span></h2>'
            '<p class="th_fade_anim itwd-sub-lead"><strong>Download IT Wala Dai App Today.</strong> Explore beginner-friendly '
            'computer programming lessons, learn IT fundamentals, and prepare for your next academic step with IT Wala Dai.</p>')
    courses = ['C++ Programming', 'Python for Beginners', 'Web Basics (HTML, CSS, JS)',
               'Computer Fundamentals', '+2 Computer Science', 'IT Career Guidance']
    s = seq(s, r'<h3 class="box-title"><a href="[^"]*">[^<]*</a></h3>',
            ['<h3 class="box-title"><a href="#free-courses">%s</a></h3>' % c for c in courses]
            + [lambda m: '<!--itwd-drop-->' + m.group(0)])
    # 7th card -> hidden; last cell -> app buttons
    s = resub(s, r'<div class="col-xl-3 col-lg-4 col-md-6 th_fade_anim"><div class="category-card"><div class="box-icon">'
                 r'<img decoding="async" src="[^"]*category1-7.svg" alt="Image"></div><div class="box-content"><!--itwd-drop-->.*?</div></div></div>',
              lambda m: hidden('free-course-card-7', m.group(0).replace('<!--itwd-drop-->', '')))
    s = rep(s, '<a href="../courses/index.html" class="category-btn th-btn style2">Explore All Categories</a></div>',
            '<a href="#" onclick="return false" class="category-btn th-btn style2"><i class="fab fa-google-play me-2"></i>Google Play &middot; coming soon</a></div>'
            '<div class="col-xl-3 col-lg-4 col-md-6 th_fade_anim"><a href="#" onclick="return false" class="category-btn th-btn"><i class="fab fa-windows me-2"></i>Windows &middot; coming soon</a></div>'
            '<div class="col-12 text-center th_fade_anim"><p class="itwd-note">App launching soon — screens shown are a design preview.</p></div>')
    return s


def home_benefits():
    """'Get To Know About Us' -> Not just code, complete package."""
    s = section('home', 'd1a8a77')
    s = rep(s, '<span class="text-theme">Happy</span> Student</span>', '<span class="text-theme">92%</span> A / A+ grade</span>')
    s = rep(s, ' Get To Know About Us </span>', ' AI Project Lab </span>')
    s = rep(s, 'A Smarter Way To Learn In The Digital World', 'Not just code, complete package.')
    s = rep(s, 'The admission process is designed to help students find the right academic program that matches their '
               'interests, goals, and talents. It typically involves submitting an application form. ',
            'Everything external examiners look for — all ready. You just understand the concept and stay confident. '
            '<strong>92% students ko A / A+ grade.</strong>')
    st = s.index('<div class="row gy-40">')
    en = block(s, st)
    row = s[st:en]
    pre, cards, between, suf = split_items(row, '<div class="col-md-6">')
    benefits = [
        ('Source code + GitHub repo', 'Complete, clean source code — tumhare GitHub pe.'),
        ('Live deployment', 'Real URL pe live project — external ko demo do.'),
        ('Project report', 'College format mein — proposal, mid-defense, final.'),
        ('PPT slides + demo video', 'Presentation aur demo video, dono ready.'),
        ('Mock viva', '30 common questions ki practice mentor ke saath.'),
        ('Plagiarism-safe', 'Concept tumhara — har feature tum samjhoge.'),
    ]
    new_cards = []
    for i, (t, d) in enumerate(benefits):
        c = cards[i % len(cards)]
        c = re.sub(r'<h3 class="box-title">[^<]*</h3>', '<h3 class="box-title">%s</h3>' % t, c)
        c = re.sub(r'<p class="box-text desc">[^<]*</p>', '<p class="box-text desc">%s</p>' % d, c)
        new_cards.append(c)
    s = s[:st] + pre + ''.join(new_cards) + suf + s[en:]
    s = rep(s, 'href="about-us/index.html">MORE ABOUT US', 'href="/programs">PROJECT DEKHO')
    return s


def counters(key, did):
    s = section(key, did)
    s = seq(s, r'<h2 class="box-number"><span class="counter-number">[^<]*</span>[^<]*</h2><p class="box-text">[^<]*</p>', [
        '<h2 class="box-number"><span class="counter-number">1.2</span>k+</h2><p class="box-text">Happy Students</p>',
        '<h2 class="box-number"><span class="counter-number">340</span>+</h2><p class="box-text">Projects Shipped</p>',
        '<h2 class="box-number"><span class="counter-number">92</span>%</h2><p class="box-text">Got A / A+ Grade</p>',
        '<h2 class="box-number"><span class="counter-number">40</span>+</h2><p class="box-text">Industry Mentors</p>',
    ])
    return s


def home_more_features():
    """'Why Choose Us' -> For +2 students, IT Wala Dai has more."""
    s = section('home', '558f02e')
    s = rep(s, 'data-id="558f02e"', 'data-id="558f02e" id="more-for-plus-two"')
    s = rep(s, 'Years Of Experience ** Years Of Experience **', 'Hackathon Prize Pool ** Hackathon Prize Pool **')
    s = rep(s, '<span class="counter-number">16</span>', '<span class="counter-number">50</span>K')
    s = rep(s, 'alt="img">Why Choose Us</span>', 'alt="img">+2 Students ke liye</span>')
    s = rep(s, 'Your Classroom, Anywhere In The World', 'For +2 students, IT Wala Dai has more.')
    s = rep(s, 'Digital education is transforming the way people learn by integrating technology, creativity, and '
               'innovation into the educational experience. It allows learners to access quality education anytime.',
            'School ke baad kya karein, kaunsa college, kaunsa course — confused ho? Dai hai na. '
            'Free coding, monthly hackathon aur sahi college choose karne mein help.')
    s = rep(s, '<ul><li>Learn At Your Own Pace</li><li>Certified Industry Experts</li><li>Affordable Learning For Everyone</li>'
               '<li>Lifetime Access</li><li>Practical Skill Development</li></ul>',
            '<ul><li>Free coding for +2 — C++, Python, Web in simple language</li>'
            '<li>Monthly hackathon — Rs. 50,000 prizes (+2 students only)</li>'
            '<li>College finder — CSIT, BIT, BCA — sahi choice</li>'
            '<li>Class Notes — study notes for Class 3–12</li>'
            '<li>IT Wala Dai App — Android &amp; Windows, coming soon</li></ul>')
    return s


def testimonials():
    s = section('home', 'ba8655c')
    s = rep(s, 'What Our Students Say’s About us!', 'Unke projects, unki zubaani.')
    data = [
        ('Production-ready project', 'Mera AI attendance project ab college mein actually use hota hai. External ne ‘production-ready’ bola!', 'Bibek K.', 'BSc CSIT &middot; TU'),
        ('Viva mein confident', 'Documentation aur viva prep sabse helpful tha. Pehli baar viva mein confident thi.', 'Kritika B.', 'BCA &middot; Pokhara Univ.'),
        ('Internship mil gayi', 'Mentor review ne meri bad habits pakdi. Isi project se internship mili.', 'Rohan M.', 'BIT &middot; Purbanchal'),
    ]
    s = seq(s, r'<h3 class="box-title">[^<]*</h3><p class="box-text text">[^<]*</p>',
            ['<h3 class="box-title">%s</h3><p class="box-text text">%s</p>' % (t, q) for t, q, _, _ in data])
    s = seq(s, r'<h4 class="testi-card_name name">[^<]*</h4><span class="testi-card_desig desig">[^<]*</span>',
            ['<h4 class="testi-card_name name">%s</h4><span class="testi-card_desig desig">%s</span>' % (n, d) for _, _, n, d in data])
    s = s.replace('<i class="fa-regular fa-star"></i>', '<i class="fa-solid fa-star"></i>')
    s = seq(s, r'<span class="rating-title">[^<]*</span>', ['<span class="rating-title"> 5.0</span>'] * 3)
    return s


FAQ = [
    ('Kya AI mera poora project bana dega?',
     'Nahi. AI tumhara tool hai, replacement nahi. Hum sikhate hain AI se fast kaise build karein, aur har feature ka '
     'concept tumhe samajh aaye — taaki viva mein confident raho.'),
    ('Kaunse students join kar sakte hain?',
     'BSc CSIT, BIT, BCA, BE Computer, BIM ya koi bhi IT bachelor student — 3rd semester se final year tak. '
     'Minor project aur final-year project dono.'),
    ('Project college ke format mein hoga?',
     'Haan. TU, PU, PoU aur KU ke report formats ke templates milte hain — proposal, mid-defense aur final report teeno.'),
    ('Agar mera apna idea hai toh?',
     'Bahut badhiya! Pehli call mein mentor tumhara idea dekhega, scope fix karega aur realistic 6-week plan banayega.'),
    ('Payment kaise hoti hai?',
     'eSewa, Khalti ya bank transfer. Team plan mein 2 installments allowed hain.'),
]


def faq():
    s = section('hii', '0ce34e1')
    s = rep(s, 'data-id="0ce34e1"', 'data-id="0ce34e1" id="faq"')
    s = rep(s, '<h3 class="box-title"><span class="counter-number">50</span>K</h3><p class="box-text">Active Students</p>',
            '<h3 class="box-title"><span class="counter-number">24</span>h</h3><p class="box-text">Reply time</p>')
    s = rep(s, '/>Faq’s</span>', '/>FAQ</span>')
    s = rep(s, 'Frequently Asked have any questions?</span></h2>',
            'Have questions? Here are answers.</span></h2>'
            '<p class="th_fade_anim">If you want to ask something else, just <a href="/contact" class="text-theme">message us</a> '
            '— reply within 24 hours.</p>')
    st = s.index('<div class="accordion" id="faqAccordion1">')
    en = block(s, st)
    acc = s[st:en]
    pre, cards, _, suf = split_items(acc, '<div class="accordion-card')
    closed, opened = cards[0], cards[1]
    out = []
    for i, (q, a) in enumerate(FAQ):
        c = opened if i == 0 else closed
        uid = 'itwd-faq-%d' % (i + 1)
        c = re.sub(r'6ad73b4e5a[0-9a-f]+', uid, c)
        c = re.sub(r'(<button[^>]*>)[^<]*(</button>)', lambda m: m.group(1) + q + m.group(2), c)
        c = re.sub(r'<p class="faq-text"><p>.*?</p></p>', '<p class="faq-text">%s</p>' % a, c, flags=re.S)
        out.append(c)
    s = s[:st] + pre + ''.join(out) + suf + s[en:]
    return s


def cta():
    s = section('home', 'c81e9b2')
    s = rep(s, 'alt="img">Join Our New Sessions</span>', 'alt="img">Nov 2026 batch &middot; 40 seats</span>')
    s = rep(s, 'Call To Enroll Your Digital Learning Course', 'Project ka deadline paas hai? Aaj hi shuru karo.')
    s = rep(s, '<a href="tel:+11234567890" class="cta-link mb-0">(+1) 123 456 7890</a>',
            '<p class="text-white mb-0 itwd-cta-text">Free 20-min consult call — mentor tumhara idea dekhega aur 6-week plan banayega.</p>')
    s = rep(s, '<a href="student-registration/index.html" class="th-btn style2">JOIN WITH US',
            '<a href="/contact" class="th-btn style2">Free consult book karo')
    return s


def build_home():
    c = []
    c.append(wrap('home', home_hero()))
    c.append(marquee())
    c.append(hidden('home-text-marquee', wrap('home', section('home', '4bb6bb4'))))
    c.append(wrap('home', home_offerings()))
    c.append(wrap('hi', free_courses()))
    c.append(hidden('home-featured-courses', wrap('home', section('home', 'b14b4e2'))))
    c.append(wrap('home', home_benefits()))
    c.append(wrap('home', counters('home', '5eba7ca')))
    c.append(hidden('home-teachers', wrap('home', section('home', 'c77d348'))))
    c.append(hidden('home-work-process', wrap('home', section('home', 'c3fedf5'))))
    c.append(wrap('home', home_more_features()))
    c.append(hidden('home-pricing', wrap('home', section('home', '2d2d1a7'))))
    c.append(wrap('home', testimonials()))
    c.append(wrap('hii', faq()))
    c.append(wrap('home', cta()))
    c.append(hidden('home-blog', wrap('home', section('home', '8d4ffe9'))))
    c.append(hidden('home-partners', wrap('home', section('home', 'eb4ce31'))))
    page('index.html', '/', 'IT Wala Dai &#8211; AI se apna college project banao',
         'IT Wala Dai — Nepali education & tech guidance platform for +2 and Bachelor IT students.',
         kill_template_links(''.join(c)))


# =========================================================================== FIND PROJECT (/programs)

def how_it_works():
    s = section('home', 'c3fedf5')
    s = rep(s, 'data-id="c3fedf5"', 'data-id="c3fedf5" id="how-it-works"')
    s = rep(s, '/>Work Process</span>', '/>How It Works</span>')
    s = rep(s, 'How Digital Learning Works</span></h2>',
            'From idea to viva, just 4 steps.</span></h2>'
            '<p class="th_fade_anim">A mentor guides you at every step. AI makes you fast, mentor makes you right.</p>')
    steps = [
        ('Idea choose <br> karo', '100+ vetted real-life ideas, ya apna idea lao. Mentor scope fix karta hai.'),
        ('AI ke saath <br> build', 'Claude, Copilot, Cursor — sahi tarike se. AI code likhta hai, concept tum samajhte ho.'),
        ('Weekly mentor <br> review', 'Industry engineer har hafte code, security aur architecture check karta hai.'),
        ('Deploy + viva <br> ready', 'Live URL, report, slides aur mock viva. External bole — ‘ye toh real hai!’'),
    ]
    s = seq(s, r'<h3 class="box-title">[^<]*<br>[^<]*</h3><p class="box-text">[^<]*</p>',
            ['<h3 class="box-title">%s</h3><p class="box-text">%s</p>' % st for st in steps])
    return s


def unsplash(photo_id):
    return 'https://images.unsplash.com/photo-%s?w=800&h=560&fit=crop&q=80&auto=format' % photo_id


# (slug, name, icon index from the template category icons)
CATEGORIES = [
    ('ai-ml', 'AI &amp; Machine Learning', 2),
    ('web', 'Web Applications', 4),
    ('mobile', 'Mobile Apps', 3),
    ('vision', 'Computer Vision', 1),
    ('data', 'Data Science', 5),
    ('nlp', 'NLP &amp; Chatbots', 6),
]
CAT_NAME = {slug: name for slug, name, _ in CATEGORIES}

# (category, title, level, duration, tech stack, unsplash photo id)
PROJECTS = [
    ('ai-ml', 'Student Performance Predictor', 'Intermediate', '5 weeks',
     'Python, Pandas, scikit-learn, Flask, React', '1557989048-03456d01a26e'),
    ('ai-ml', 'Crop Disease Detector App (Nepali)', 'Advanced', '6 weeks',
     'TensorFlow, Keras (CNN), TFLite, Flutter', '1692481060581-98c224124f12'),
    ('ai-ml', 'NEPSE Stock Price Forecaster', 'Advanced', '6 weeks',
     'Python, TensorFlow (LSTM), FastAPI, Next.js, Chart.js', '1611974789855-9c2a0a7236a3'),
    ('ai-ml', 'Movie &amp; Book Recommendation System', 'Intermediate', '5 weeks',
     'Python, scikit-learn, Surprise, Django, PostgreSQL', '1512070750041-b9479c107194'),
    ('ai-ml', 'Loan Default Risk Predictor', 'Intermediate', '5 weeks',
     'Python, XGBoost, SHAP, Streamlit', '1607863680198-23d4b2565df0'),

    ('web', 'Hospital OPD Queue Tracker', 'Beginner', '5 weeks',
     'Next.js, Supabase (PostgreSQL), Tailwind CSS', '1758654860024-9e352f70d1f9'),
    ('web', 'College Hostel Management System', 'Beginner', '5 weeks',
     'Laravel, MySQL, Bootstrap', '1555854877-bab0e564b8d5'),
    ('web', 'Event Ticketing with Khalti/eSewa', 'Intermediate', '6 weeks',
     'MERN (MongoDB, Express, React, Node.js), Khalti API', '1459749411175-04bf5292ceea'),
    ('web', 'Blood Bank &amp; Donor Finder', 'Intermediate', '5 weeks',
     'React, Node.js, MongoDB, Leaflet Maps', '1615461066159-fea0960485d5'),
    ('web', 'Student Freelance Marketplace', 'Advanced', '6 weeks',
     'Next.js, Prisma, PostgreSQL, Socket.io', '1612299273045-362a39972259'),

    ('mobile', 'College Bus Live Tracker', 'Intermediate', '5 weeks',
     'Flutter, Firebase, Google Maps API', '1613688263142-67f1e0c25ef1'),
    ('mobile', 'Personal Expense Tracker (NPR)', 'Beginner', '4 weeks',
     'Flutter, Hive (offline DB), fl_chart', '1763729948735-df50fc3540df'),
    ('mobile', 'Nepal Trekking Guide (Offline Maps)', 'Advanced', '6 weeks',
     'React Native, Mapbox, SQLite', '1544735716-392fe2489ffa'),
    ('mobile', 'Local Food Delivery App', 'Advanced', '6 weeks',
     'Flutter, Node.js, MongoDB, Khalti SDK', '1617347454431-f49d7ff5c3b1'),
    ('mobile', 'Medicine Reminder App', 'Beginner', '4 weeks',
     'Kotlin, Jetpack Compose, Room, WorkManager', '1584308666744-24d5c474f2ae'),

    ('vision', 'Smart Attendance with Face Recognition', 'Intermediate', '6 weeks',
     'Python, OpenCV, face_recognition, Flask, Next.js', '1776329255945-15212b50cd7f'),
    ('vision', 'Nepali Number Plate Recognition', 'Advanced', '6 weeks',
     'YOLOv8, EasyOCR, OpenCV, FastAPI', '1553708917-68ce200d86b2'),
    ('vision', 'Helmet Detection for Traffic', 'Intermediate', '5 weeks',
     'YOLOv8, OpenCV, Flask', '1634015190736-3cecd58f89fe'),
    ('vision', 'Sign Language to Text Translator', 'Advanced', '6 weeks',
     'MediaPipe, TensorFlow, Python, React', '1773800924117-a387786c60a0'),
    ('vision', 'Smart Waste Sorting Classifier', 'Intermediate', '5 weeks',
     'PyTorch (ResNet), Raspberry Pi, OpenCV', '1595278069441-2cf29f8005a4'),

    ('data', 'Kathmandu Air Quality Dashboard', 'Beginner', '4 weeks',
     'Python, Pandas, Plotly Dash, OpenAQ API', '1720412077065-ccd68a913720'),
    ('data', 'Nepal Tourism Trends Analysis', 'Beginner', '4 weeks',
     'Python, Pandas, Seaborn, Power BI', '1518002054494-3a6f94352e9d'),
    ('data', 'E-commerce Sales Analytics', 'Intermediate', '5 weeks',
     'SQL, Python, Pandas, Metabase', '1551288049-bebda4e38f71'),
    ('data', 'Telecom Customer Churn Analysis', 'Intermediate', '5 weeks',
     'Python, scikit-learn, Streamlit', '1766066014237-00645c74e9c6'),
    ('data', 'Dengue Outbreak Prediction', 'Advanced', '6 weeks',
     'Python, Prophet, GeoPandas, Folium', '1707943768453-7850f916ebde'),

    ('nlp', 'AI Study Buddy (RAG Chatbot)', 'Intermediate', '6 weeks',
     'Next.js, Vercel AI SDK, LangChain, pgvector', '1513258496099-48168024aec0'),
    ('nlp', 'Nepali Fake News Detector', 'Advanced', '6 weeks',
     'Python, Hugging Face (mBERT), FastAPI', '1504711434969-e33886168f5c'),
    ('nlp', 'College FAQ WhatsApp Bot', 'Intermediate', '5 weeks',
     'Node.js, WhatsApp Cloud API, OpenAI API', '1682941664177-7920d0e59418'),
    ('nlp', 'Nepali Text Summarizer', 'Advanced', '6 weeks',
     'Python, Hugging Face Transformers (mT5), Streamlit', '1532012197267-da84d127e765'),
    ('nlp', 'Resume Screening with NLP', 'Intermediate', '5 weeks',
     'Python, spaCy, Django, PostgreSQL', '1698047681432-006d2449c631'),
]


def project_categories():
    s = section('hii', '4d282c1')
    s = rep(s, 'data-id="4d282c1"', 'data-id="4d282c1" id="categories"')
    s = rep(s, '/>Our Courses Categories</span>', '/>Project Categories</span>')
    s = rep(s, 'Featured Course Categories', '%d project ideas, %d categories' % (len(PROJECTS), len(CATEGORIES)))
    s = rep(s, 'href="../courses/index.html">Enroll Now', 'href="#featured-projects" data-itwd-filter="all">Sab projects dekho')
    st = s.index('<div class="swiper-wrapper">')
    en = block(s, st)
    wrapper = s[st:en]
    pre, slides, between, suf = split_items(wrapper, '<div class="swiper-slide')
    out = []
    for slug, name, icon in CATEGORIES:
        n = sum(1 for p in PROJECTS if p[0] == slug)
        sl = slides[icon]
        sl = re.sub(r'<h3 class="box-title"><a href="[^"]*">[^<]*</a></h3>',
                    '<h3 class="box-title"><a href="#featured-projects" data-itwd-filter="%s">%s'
                    '<span class="itwd-cat-count">%d project ideas</span></a></h3>' % (slug, name, n), sl)
        sl = re.sub(r'<a class="icon-btn style-border2" href="[^"]*"',
                    '<a class="icon-btn style-border2" href="#featured-projects" data-itwd-filter="%s"' % slug, sl)
        sl = rep(sl, '<div class="category-card2">', '<div class="category-card2" data-itwd-filter="%s">' % slug)
        out.append(sl)
    s = s[:st] + pre + ''.join(out) + suf + s[en:]
    return s


def featured_projects():
    s = section('home', 'b14b4e2')
    s = rep(s, 'data-id="b14b4e2"', 'data-id="b14b4e2" id="featured-projects"')
    s = rep(s, '/>OUR COURSES</span>', '/>Featured Projects</span>')
    s = rep(s, 'Our Featured Courses', 'Real-life projects, mentor ke saath')
    s = rep(s, 'href="courses/index.html">Enroll Now', 'href="/contact">Free consult')
    st = s.index('<div class="th-course-row')
    en = block(s, st)
    row = s[st:en]
    pre, cards, between, suf = split_items(row, '<div class="th-course-single')
    tpl = cards[0]
    tpl = rep(tpl, '<div class="th-course-single th_fade_anim">', '<div class="th-course-single" data-cat="{cat}">')
    # ratings + student counts are not wanted -> removed
    st_r = tpl.index('<div class="box-rating">')
    tpl = tpl[:st_r] + tpl[block(tpl, st_r):]
    tpl = resub(tpl, r'(<div class="box-img">\s*)<a href="[^"]*">\s*<img decoding="async" src="[^"]*" alt="Course Image">\s*</a>',
                r'\1<span class="itwd-badge">{catname}</span><img decoding="async" loading="lazy" src="{img}" alt="{title}">')
    tpl = resub(tpl, r'<h3 class="box-title">\s*<a href="[^"]*">\s*[^<]*?\s*</a>\s*</h3>', '<h3 class="box-title">{title}</h3>')
    tpl = rep(tpl, '<div class="box-content">', '<p class="itwd-course-meta"><span>Tech stack:</span> {tech}</p>\n<div class="box-content">')
    tpl = rep(tpl, '<span class="course-info-title"> Lesson:</span>', '<span class="course-info-title"> Level:</span>')
    tpl = resub(tpl, r'(<span class="course-info-title"> Level:</span>\s*<h6 class="course-info-text">)[^<]*', r'\g<1> {level}')
    tpl = resub(tpl, r'(<span class="course-info-title"> Duration:</span>\s*<h6 class="course-info-text">)[^<]*', r'\g<1> {dur}')
    tpl = resub(tpl, r'<span class="box-price">.*?</span>\s*(<a )', r'\1')
    tpl = resub(tpl, r'<a href="[^"]*" class="th-btn btn-sm style-border2">\s*View Details',
                '<a href="#start-project" class="th-btn btn-sm style-border2 itwd-start" data-project="{title}">Start Project')
    fields = ('cat', 'catname', 'img', 'title', 'tech', 'level', 'dur')
    tpl = tpl.replace('{', '{{').replace('}', '}}')
    for k in fields:
        tpl = tpl.replace('{{%s}}' % k, '{%s}' % k)
    out = [tpl.format(cat=c, catname=CAT_NAME[c], img=unsplash(pid), title=t, tech=tech, level=lvl, dur=d)
           for c, t, lvl, d, tech, pid in PROJECTS]
    chips = ''.join('<button type="button" class="itwd-chip%s" data-itwd-filter="%s">%s</button>'
                    % (' is-active' if slug == 'all' else '', slug, name)
                    for slug, name in [('all', 'All Projects')] + [(c[0], c[1]) for c in CATEGORIES])
    # "All" view shows the first 2 rows; the rest opens with View More (a single category always shows in full)
    more = ('<div class="itwd-more-wrap text-center mt-40"><button type="button" class="th-btn itwd-view-more" '
            'data-limit="6">View More Projects%s</button></div>' % ARROW_SVG)
    s = s[:st] + '<div class="itwd-chips">%s</div>\n' % chips + pre + '\n'.join(out) + suf + more + s[en:]
    return s


def start_project_modal():
    return '''
<div class="itwd-modal" id="start-project" role="dialog" aria-modal="true" aria-labelledby="itwd-modal-title" hidden>
  <div class="itwd-modal__backdrop" data-itwd-close></div>
  <div class="itwd-modal__box">
    <button type="button" class="itwd-modal__close" data-itwd-close aria-label="Close"><i class="far fa-times"></i></button>
    <span class="itwd-modal__eyebrow">Start Project</span>
    <h3 class="itwd-modal__title" id="itwd-modal-title">Project</h3>
    <p class="itwd-modal__text">Details bharo &mdash; submit karte hi WhatsApp khulega aur message seedha IT Wala Dai ko jayega.</p>
    <form class="itwd-start-form" data-whatsapp="%s" novalidate>
      <input type="hidden" name="project">
      <div class="row">
        <div class="col-md-6 form-group style-border3"><input class="form-control" type="text" name="name" placeholder="Your Name *" required><i class="fal fa-user"></i></div>
        <div class="col-md-6 form-group style-border3"><input class="form-control" type="tel" name="phone" placeholder="Phone Number *" required><i class="fal fa-phone-alt"></i></div>
        <div class="col-12 form-group style-border3"><input class="form-control" type="email" name="email" placeholder="Email Address *" required><i class="fal fa-envelope"></i></div>
        <div class="col-12 form-group style-border3"><textarea class="form-control" name="description" rows="4" placeholder="Project ke baare mein batao &mdash; college, semester, deadline, apna idea..."></textarea><i class="fal fa-pencil"></i></div>
      </div>
      <p class="itwd-form-status" role="status" aria-live="polite"></p>
      <button type="submit" class="th-btn w-100"><i class="fab fa-whatsapp me-2"></i>WhatsApp pe bhejo</button>
    </form>
  </div>
</div>
''' % WHATSAPP


MENTOR_DIR = ROOT / 'mentor'
MENTOR_ORDER = ['sachin', 'anurag']


def mentors():
    """Only the 2 photos from the /mentor folder (no names, ratings or prices)."""
    s = section('home', 'c77d348')
    s = rep(s, 'data-id="c77d348"', 'data-id="c77d348" id="mentors"')
    s = rep(s, '/>Our Teachers</span>', '/>Our Mentors</span>')
    s = rep(s, 'Meet Our Professional\nTeachers', 'Industry engineers jo tumhara code review karenge')
    photos = [p for p in MENTOR_DIR.glob('*') if p.suffix.lower() in ('.jpg', '.jpeg', '.png', '.webp', '.avif')]
    # display order: names listed in MENTOR_ORDER first, anything else after (alphabetical)
    rank = lambda p: next((i for i, n in enumerate(MENTOR_ORDER) if n in p.stem.lower()), len(MENTOR_ORDER))
    photos = sorted(photos, key=lambda p: (rank(p), p.name.lower()))[:2]
    # name comes from the file name, e.g. "sachin kushwaha mentor 1.png" -> "Sachin Kushwaha"
    people = [('/mentor/' + quote(p.name), re.sub(r'\s*mentor.*$', '', p.stem, flags=re.I).strip().title()) for p in photos]
    if len(people) < 2:
        print('  ! mentor/: found %d image(s), need 2 -> template photos used as placeholders' % len(people))
        people += [('/wp-content/uploads/2026/02/team_2_%d.jpg' % i, 'Mentor') for i in (1, 2)][len(people):]
    st = s.index('<div class="slider-area">')
    en = block(s, st)
    cards = ''.join('<div class="col-lg-4 col-md-5 col-sm-6"><div class="team-card3 th_fade_anim"><div class="box-img">'
                    '<img decoding="async" src="%s" alt="%s"></div><div class="box-content"><h3 class="box-title">%s</h3>'
                    '<p class="box-text">IT Wala Dai Mentor</p></div></div></div>' % (src, name, name) for src, name in people)
    s = s[:st] + '<div class="row gy-4 justify-content-center itwd-mentors">%s</div>' % cards + s[en:]
    return s


def build_programs():
    c = [
        wrap('home', how_it_works()),
        wrap('hii', project_categories()),
        wrap('home', featured_projects()),
        wrap('home', mentors()),
        wrap('home', cta()),
        start_project_modal(),
    ]
    page('programs/index.html', '/programs', 'Find Project &#8211; IT Wala Dai',
         'AI Project Lab — final-year project in 6 weeks with AI + mentor guidance. From idea to viva.',
         kill_template_links(''.join(c)), crumb=breadcrumb('Find Project', 'Find Project'))


# =========================================================================== ABOUT

def about_intro():
    s = section('hi', 'e0eff12')
    s = rep(s, 'CAMPUS OVERVIEW OR STUDENT TESTIMONIALS', 'BUILT IN NEPAL ** FOR NEPALI STUDENTS **')
    s = rep(s, '<div class="box-title"><span class="counter-number">50</span>K</div><span class="box-text">Active Students</span>',
            '<div class="box-title"><span class="counter-number">1.2</span>K+</div><span class="box-text">Happy Students</span>')
    s = rep(s, '/> ABOUT OUR UNIVERSITY</span>', '/> About IT Wala Dai</span>')
    s = rep(s, 'Welcome to Escul University.', 'Your Journey from +2 to IT Starts Here')
    s = rep(s, 'Collaboratively simplify user friendly networks after principle centered coordinate effective methods of '
               'empowerment distributed niche markets pursue market positioning web-readiness after resource sucking applications.',
            'IT Wala Dai is an education and technology guidance platform designed to help students in Nepal explore IT with '
            'greater confidence. <strong>Our mission:</strong> making IT learning and career guidance accessible to every curious student.')
    s = resub(s, r'<li>Get access to 4,000\+ of our top courses</li>\s*<li>Popular topics to learn now</li>\s*<li>Find the right instructor for you</li>',
              '<li>Learning programming</li><li>+2 computer topics</li><li>Project ideas &amp; viva prep</li>'
              '<li>College &amp; course information</li><li>A student community</li>')
    s = rep(s, 'href="../about-us/index.html">LEARN MORE', 'href="/programs">FIND PROJECT')
    return s


OFFERS = ['Learn Programming', 'Free +2 Computer Learning Resources', 'Project Discovery',
          'College and Course Guidance', 'Community and Collaboration', 'Events and Opportunities', 'Career Exploration']


def about_offers():
    s = section('hi', 'a6f5da4')
    s = rep(s, '/>COURSE CATEGORIES</span>', '/>What IT Wala Dai Offers</span>')
    s = rep(s, 'Explore diverse learning paths within our course\xa0categories', 'One place for every curious IT student')
    links = ['/#free-courses', '/#free-courses', '/programs', '/programs#categories', '/community', '/#more-for-plus-two', '/contact']
    s = seq(s, r'<h3 class="box-title"><a href="[^"]*">[^<]*</a></h3>',
            ['<h3 class="box-title"><a href="%s">%s</a></h3>' % (l, o) for l, o in zip(links, OFFERS)])
    s = rep(s, '<a href="../courses/index.html" class="category-btn th-btn style2">Explore All Categories</a>',
            '<a href="/contact" class="category-btn th-btn style2">Dai se baat karo</a>')
    return s


def about_path():
    s = section('hi', '79a71af')
    s = rep(s, '/>ADMISSION PROCESS</span>', '/>Your Path</span>')
    s = rep(s, 'Step-by-step admission process', 'Six steps to your next move in IT')
    st = s.index('<div class="process-card-wrap1">')
    en = block(s, st)
    wrapdiv = s[st:en]
    pre, cards, between, suf = split_items(wrapdiv, '<div class="process-card th_fade_anim')
    steps = [
        ('Explore your interests', 'Dekho IT mein kya tumhe sabse zyada excite karta hai.'),
        ('Learn relevant IT skills', 'Free courses se basics strong karo — C++, Python, Web.'),
        ('Discover projects', 'Project ideas aur learning opportunities explore karo.'),
        ('Compare courses &amp; colleges', 'CSIT, BIT, BCA — kaunsa tumhare liye sahi hai, samjho.'),
        ('Connect with community', 'Seniors aur peers se seekho, sawaal poocho.'),
        ('Take your next step', 'Greater confidence ke saath apna agla kadam uthao.'),
    ]
    out = []
    for i, (t, d) in enumerate(steps):
        c = cards[i % len(cards)]
        c = re.sub(r'<h3 class="box-title">[^<]*</h3>', '<h3 class="box-title">%s</h3>' % t, c)
        c = re.sub(r'<p class="box-text">[^<]*</p>', '<p class="box-text">%s</p>' % d, c)
        out.append(c)
    s = s[:st] + pre + ''.join(out) + suf + s[en:]
    return s


def about_approach():
    s = section('hi', 'acda797')
    s = rep(s, '/>WHY CHOOSE US</span>', '/>Our Approach</span>')
    s = rep(s, 'University education is the foundation for shaping skilled, knowledgeable.', 'Friendly like an older sibling. Never corporate.')
    s = rep(s, 'Collaboratively simplify user friendly networks after principle centered coordinate effective methods of '
               'empowerment distributed niche markets pursue market positioning web-readiness after resource sucking applications. ',
            '<strong>Approachable learning</strong> — technical topics explained simply. '
            '<strong>Useful guidance</strong> — clear, practical information. '
            '<strong>Practice and collaboration</strong> — learn by doing.')
    s = seq(s, r'<h3 class="box-title">[^<]*</h3><p class="box-text desc">[^<]*</p>', [
        '<h3 class="box-title">Approachable learning</h3><p class="box-text desc">Simple language, real examples</p>',
        '<h3 class="box-title">Learn by doing</h3><p class="box-text desc">Practice, projects &amp; collaboration</p>',
    ])
    s = rep(s, '<div class="why-card-wrap1">',
            '<p class="itwd-disclaimer th_fade_anim">We’re a guidance and learning platform. We don’t promise guaranteed '
            'admission, employment or internships, and we don’t claim official affiliation with any university unless clearly stated.</p>'
            '<div class="why-card-wrap1">', 1)
    s = re.sub(r'<a href="https://www.youtube.com/watch\?v=_sI_Ps7JSEk" class="play-btn style2 popup-video">.*?</a>',
               lambda m: hidden('about-video-btn', m.group(0)), s, flags=re.S)
    return s


def build_about():
    order = [
        ('hi', 'f33c017', None),
        ('hi', 'e0eff12', about_intro),
        ('hi', '8279d49', lambda: counters('hi', '8279d49')),
        ('hi', 'a6f5da4', about_offers),
        ('hi', 'd0acb59', None),
        ('hi', '10a8c1e', None),
        ('hi', '79a71af', about_path),
        ('hi', 'acda797', about_approach),
        ('hi', '0225b12', None),
        ('hi', '2ca55b6', None),
        ('hi', '9955286', None),
        ('hi', '4ac00df', None),
        ('hi', '8e72882', None),
    ]
    c = []
    for key, did, fn in order:
        if fn:
            c.append(wrap(key, fn()))
        else:
            c.append(hidden('about-%s' % did, wrap(key, section(key, did))))
    page('about/index.html', '/about', 'About &#8211; IT Wala Dai',
         'IT Wala Dai is an education and technology guidance platform for students in Nepal.',
         kill_template_links(''.join(c)), crumb=breadcrumb('About IT Wala Dai', 'About'))


# =========================================================================== CONTACT

def contact_section():
    s = section('contact', '0ed34fa')
    s = rep(s, 'Contact Information</span></h2>', 'Dai se seedhi baat.</span></h2>')
    s = rep(s, "Thank you for your interest in Attach Web Agency. We're excited to hear from you and discuss...",
            'College, course, project, hackathon — kuch bhi poocho. Koi sawaal chhota nahi hota.')
    s = rep(s, '<h3 class="box-title">Call Us</h3><p class="box-text">Any time for flight booking.</p><a class="box-link" href="tel:253245636547">(+253)-2456-36547</a>',
            '<h3 class="box-title">Phone / WhatsApp</h3><p class="box-text">Call ya WhatsApp karo</p><a class="box-link" href="tel:%s">%s</a>' % (PHONE_TEL, PHONE))
    s = rep(s, '<h3 class="box-title">Official Email</h3><p class="box-text">Email us for any quires</p><a class="box-link" href="mailto:info@escul.com">info@escul.com</a>',
            '<h3 class="box-title">Email</h3><p class="box-text">Kuch bhi poocho</p><a class="box-link" href="mailto:%s">%s</a>' % (EMAIL, EMAIL))
    s = rep(s, '<h3 class="box-title">Our Location</h3><p class="box-text">Visit us today!</p><a class="box-link" href="https://www.google.com/maps">15 Maniel Lane, Berlin</a>',
            '<h3 class="box-title">Location</h3><p class="box-text">Built in Nepal</p><a class="box-link" href="https://www.google.com/maps/place/Kathmandu" target="_blank" rel="noopener">Kathmandu, Nepal</a>')
    s = rep(s, '<h3 class="box-title">Admission Apps</h3><p class="box-text">App for more details</p><a class="box-link" href="mailto:www.escul.com">www.escul.com</a>',
            '<h3 class="box-title">Reply Time</h3><p class="box-text">Hum jaldi jawab dete hain</p><a class="box-link" href="mailto:%s">24 ghante ke andar</a>' % EMAIL)
    s = rep(s, '<i class="fal fa-grid-2"></i>', '<i class="fal fa-clock"></i>')
    s = rep(s, '<h4 class="form-title">Get in Touch</h4>', '<h4 class="form-title">Message bhejo</h4>')
    # Contact Form 7 needs WordPress -> plain form handled by /assets/itwd/itwd.js (opens the mail app)
    s = rep(s, '<div class="wpcf7 no-js" id="wpcf7-f6056-p6038-o1"', '<div class="itwd-form-wrap" id="itwd-contact"')
    s = resub(s, r'<form action="[^"]*" method="post" class="wpcf7-form init"[^>]*>',
              '<form class="itwd-contact-form" data-mailto="%s" novalidate>' % EMAIL)
    s = resub(s, r'<fieldset class="hidden-fields-container">.*?</fieldset>', lambda m: hidden('cf7-hidden-fields', m.group(0)))
    s = rep(s, 'placeholder="Your Name" value="" type="text" name="your-name"', 'placeholder="Name" value="" type="text" name="your-name" required')
    s = rep(s, 'placeholder="Your Email" value="" type="email" name="your-email"', 'placeholder="Email" value="" type="email" name="your-email" required')
    s = rep(s, 'placeholder="Write Message...." name="your-message"', 'placeholder="Message — apna sawaal likho..." name="your-message" required')
    for name in ('your-phone', 'your-subject'):
        m = re.search(r'<div class="col-md-6 form-group style-border3">\s*<span class="wpcf7-form-control-wrap" data-name="%s">' % name, s)
        en = block(s, m.start())
        s = s[:m.start()] + hidden('contact-field-' + name, s[m.start():en]) + s[en:]
    m = re.search(r'<div class="form-group">\s*<div class="custom-checkbox">', s)
    en = block(s, m.start())
    s = s[:m.start()] + hidden('contact-privacy-checkbox', s[m.start():en]) + s[en:]
    s = resub(s, r'<p style="display: none !important;" class="akismet-fields-container".*?</p>', lambda m: hidden('akismet', m.group(0)))
    s = rep(s, 'SEND MESSAGE', 'MESSAGE BHEJO')
    s = rep(s, '<div class="wpcf7-response-output" aria-hidden="true"></div>', '<p class="itwd-form-status" role="status" aria-live="polite"></p>')
    return s


def build_contact():
    c = [wrap('contact', contact_section())]
    page('contact/index.html', '/contact', 'Contact &#8211; IT Wala Dai',
         'Dai se seedhi baat — hello@itwaladai.com, Kathmandu, Nepal. Reply within 24 hours.',
         kill_template_links(''.join(c)), crumb=breadcrumb('Contact', 'Contact'))


# =========================================================================== COMMUNITY (coming soon)

# Launch date for the community features (~3.5 months from Oct 2026). Change here if needed.
COMMUNITY_LAUNCH = '2027-02-01T10:00:00+05:45'


def community_section():
    feats = [
        ('fa-comments', 'Discussion Forum', 'CSIT, BIT, BCA — har topic pe seniors aur peers se baat.'),
        ('fa-circle-question', 'Q&amp;A', 'Doubt poocho, answer pao — koi sawaal chhota nahi hota.'),
        ('fa-diagram-project', 'Project Showcase', 'Apna project dikhao, feedback lo, team dhoondo.'),
        ('fa-users', 'Study Groups', '+2 aur bachelor students ke liye batch-wise groups.'),
    ]
    cards = ''.join(
        '<div class="col-xl-3 col-md-6"><div class="itwd-cs-card th_fade_anim"><div class="itwd-cs-card__icon"><i class="fal %s"></i></div>'
        '<h3 class="itwd-cs-card__title">%s</h3><p class="itwd-cs-card__text">%s</p></div></div>' % f for f in feats)
    units = ''.join('<div class="itwd-cd__unit"><span class="itwd-cd__num" data-cd="%s">00</span><span class="itwd-cd__label">%s</span></div>'
                    % (k, l) for k, l in [('days', 'Days'), ('hours', 'Hours'), ('minutes', 'Minutes'), ('seconds', 'Seconds')])
    return '''
<section class="itwd-coming-soon space" id="community">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Community &middot; Coming Soon</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">IT Wala Dai Community aa raha hai!</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Student discussion forum, Q&amp;A aur project showcase — sab ek jagah. Hum isse build kar rahe hain. Ye features open honge:</p>
    </div>
    <div class="itwd-countdown th_fade_anim" data-countdown="%s">%s</div>
    <p class="itwd-cd__done text-center" hidden>Community ab live hai! &#127881;</p>
    <div class="row gy-4 mt-40">%s</div>
    <div class="text-center mt-50 th_fade_anim">
      <a href="/contact" class="th-btn">Launch pe batana — message karo%s</a>
      <a href="/programs" class="th-btn style-border itwd-btn-ghost ms-sm-3 mt-3 mt-sm-0">Tab tak project dekho</a>
    </div>
  </div>
</section>
''' % (COMMUNITY_LAUNCH, units, cards, ARROW_SVG)


def build_community():
    page('community/index.html', '/community', 'Community (Coming Soon) &#8211; IT Wala Dai',
         'IT Wala Dai student community — forum, Q&A and project showcase. Coming soon.',
         community_section(), crumb=breadcrumb('Community', 'Community'))


if __name__ == '__main__':
    build_home()
    build_programs()
    build_about()
    build_contact()
    build_community()
