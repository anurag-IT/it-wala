"""
IT Wala Dai — v4 website upgrade (applied by patch_site.py, every patch is idempotent).

  * same header on every page (logo, phone, Join Now — the home page header is the source of truth)
  * home: brand message under the hero image, +2 C++ section (before the girl's guidance section),
          All Things (Find Project + Coming Soon cards), flat app section, three real courses,
          +2 / bachelor promo boxes, project-guidance features, stats, +2 section (hackathon = coming soon)
  * Bachelor Project page (/programs): guidance wording + the five project-guidance features
  * /hackathon (coming soon) + coming-soon banner on /community, one countdown target in itwd.js
  * Free Guidance After +2: verified programme + college data (official sources, checked Oct 2026)
  * contact location, enquiry form copy, Pranam Software logo
"""
import re
from html import escape

import build_site as B
import v2_content as V
from course_data import COURSE_BY_SLUG, n_lessons, course_url, course_img

ARROW = B.ARROW_SVG
HACKATHON_URL = '/hackathon'
PRANAM_URL = 'https://www.pranamsoftware.com.np/'
PRANAM_LOGO = '/assets/itwd/pranam-logo.png'


def put(s, name, html, insert):
    """Replace the block between <!-- itwd:name:start/end --> markers, or insert it the first time."""
    a, b = '<!-- itwd:%s:start -->' % name, '<!-- itwd:%s:end -->' % name
    html = a + html + b
    if a in s:
        return s[:s.index(a)] + html + s[s.index(b) + len(b):]
    return insert(s, html)


def before(anchor):
    def ins(s, html):
        i = s.index(anchor)
        return s[:i] + html + '\n' + s[i:]
    return ins


def swap(s, old, new):
    """Idempotent string swap: fine if the new text is already there."""
    if old in s:
        return s.replace(old, new)
    assert new in s, 'patch anchor not found: %s' % old[:80]
    return s


# --------------------------------------------------------------------------- same header on every page

def header_parts(home):
    h = home[home.index('<header class="th-header'):]
    logo = re.search(r'<div class="header-logo">.*?</div>', h, re.S).group(0)
    hb = h.index('<div class="header-button">')
    t_end = h.index('</template>', hb) + len('</template>')
    side = h.index('<button type="button" class="icon-btn style-border sideMenuInfo"', hb)
    assert t_end < side
    mobile_logo = re.search(r'<div class="mobile-logo">.*?</div>', home, re.S).group(0)
    return logo, h[t_end:side], mobile_logo


def patch_header(s, home):
    logo, buttons, mobile_logo = header_parts(home)
    st = s.index('<header class="th-header')
    en = s.index('</header>', st)
    h = s[st:en]
    h = re.sub(r'<div class="header-logo">.*?</div>', lambda m: logo, h, count=1, flags=re.S)
    hb = h.index('<div class="header-button">')
    t_end = h.index('</template>', hb) + len('</template>')
    side = h.index('<button type="button" class="icon-btn style-border sideMenuInfo"', hb)
    h = h[:t_end] + buttons + h[side:]
    s = s[:st] + h + s[en:]
    return re.sub(r'<div class="mobile-logo">.*?</div>', lambda m: mobile_logo, s, count=1, flags=re.S)


# --------------------------------------------------------------------------- enquiry form (start-project modal)
# The default copy below is replaced per button by itwd.js (course vs project guidance, see MODAL_COPY there).

MODAL_INTRO = (
    '<div class="itwd-modal__intro">'
    '<p class="itwd-modal__lead">Hajurko learning journey yahi bata suru hunchha!</p>'
    '<p class="itwd-modal__text">Form bharnuhos, ani WhatsApp bata Dai sanga direct kura garnuhos. Hajurko interest ra '
    'learning needs bujhera course ko barema clear information pauna saknuhunchha.</p></div>')


def patch_modal_copy(s):
    if '<div class="itwd-modal__intro">' in s:
        return re.sub(r'<div class="itwd-modal__intro">.*?</p></div>', lambda m: MODAL_INTRO, s, count=1, flags=re.S)
    return re.sub(r'<p class="itwd-modal__text">.*?</p>', lambda m: MODAL_INTRO, s, count=1, flags=re.S)


def patch_home_modal(s, modal_html):
    """The home course cards open the same enquiry form as the course / project pages."""
    return put(s, 'home-modal', patch_modal_copy(modal_html), before('<footer>'))


def patch_footer_links(s):
    return s.replace('<li class="menu-item"><a href="/programs">AI Project Lab</a></li>',
                     '<li class="menu-item"><a href="/programs">Find Project</a></li>')


# --------------------------------------------------------------------------- home: brand message under the hero image

FONT_LINK = ('<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
             '<link href="https://fonts.googleapis.com/css2?family=Caveat:wght@600;700&amp;display=swap" rel="stylesheet">')

BRAND_MSG = '''<div class="itwd-brandmsg wow animate__fadeInUp" data-wow-delay="0.5s">
  <p class="itwd-brandmsg__script">Your IT Journey, <span>Dai Ko Saath!</span></p>
  <p class="itwd-brandmsg__text">Coding siknuhos, aafno future bujhnuhos, ra IT ko journey confidence ka saath suru garnuhos.</p>
  <svg class="itwd-brandmsg__arrow" viewBox="0 0 120 96" fill="none" aria-hidden="true" focusable="false">
    <path class="itwd-draw" d="M8 10 C 58 -2, 108 22, 96 56 C 90 72, 76 80, 60 86" />
    <path class="itwd-draw itwd-draw--head" d="M72 76 L59 87 L75 92" />
  </svg>
</div>'''


def patch_hero_message(s):
    s = put(s, 'font-caveat', FONT_LINK, before('</head>'))

    def after_image(s, html):
        m = re.search(r'<div class="thumb itwd-hero-main-image"><img[^>]*></div>', s)
        return s[:m.end()] + html + s[m.end():]
    return put(s, 'brand-msg', BRAND_MSG, after_image)


# --------------------------------------------------------------------------- home: +2 C++ section (first), girl's guidance section stays second

def cpp_section():
    c = COURSE_BY_SLUG['cpp-programming']
    points = ['Beginner-friendly C++ learning', 'Step-by-step programming concepts', 'Practical coding exercises',
              'Class 11 ra Class 12 ko learning support']
    return '''
<section class="itwd-cpp" aria-labelledby="itwd-cpp-title">
  <span class="itwd-promo__blob itwd-cpp__blob" aria-hidden="true"></span>
  <div class="container">
    <div class="itwd-cpp__grid">
      <div class="itwd-cpp__visual th_fade_anim">
        <span class="itwd-cpp__ring" aria-hidden="true"></span>
        <img src="/assets/itwd/plus2-cpp-boy.webp" alt="C++ exam ko tension ma laptop agadi baseko +2 student" width="600" height="1107" decoding="async">
        <span class="itwd-promo__badge itwd-cpp__badge--a"><i class="fas fa-code"></i>Basics bata suru</span>
        <span class="itwd-promo__badge itwd-cpp__badge--b"><i class="fas fa-gift"></i>100%% Free</span>
      </div>
      <div class="itwd-cpp__content">
        <span class="itwd-promo__label itwd-cpp__label th_fade_anim"><i class="fal fa-laptop-code"></i>Free C++ Learning for +2 Students</span>
        <h2 class="itwd-promo__title th_fade_anim" id="itwd-cpp-title">+2 ma <span class="itwd-hl">C++</span> garo lagchha? Aba Dai sanga sajilo tarikale siknuhos!</h2>
        <p class="itwd-promo__text th_fade_anim">Class 11 ra Class 12 ko Computer Science padhdai hunuhunchha? C++ ko concepts, programming logic, syntax ra practical coding bujhna garo bhairako chha? IT Wala Dai sanga basics bata step-by-step siknuhos, code practice garnuhos, ra aafno programming foundation majboot banaunuhos.</p>
        <ul class="itwd-cpp__points th_fade_anim">%(points)s</ul>
        <div class="itwd-btn-pair th_fade_anim">
          <a href="%(url)s" class="th-btn">Free C++ Sikna Suru Garnuhos%(arrow)s</a>
          <a href="/plus-two" class="th-btn style-border2">For +2 Students</a>
        </div>
        <ul class="itwd-promo__facts th_fade_anim">
          <li><strong>%(lessons)d</strong><span>Lessons</span></li>
          <li><strong>%(duration)s</strong><span>Learning time</span></li>
          <li><strong>Free</strong><span>Rs. 0 fees</span></li>
        </ul>
      </div>
    </div>
  </div>
</section>
''' % dict(points=''.join('<li><i class="fas fa-check"></i>%s</li>' % p for p in points), url=course_url(c),
           arrow=ARROW, lessons=n_lessons(c), duration=c['duration'])


def patch_cpp_section(s):
    return put(s, 'cpp-promo', cpp_section(), before('<!-- itwd:consult-promo:start -->'))


# --------------------------------------------------------------------------- home: All Things in One Place

SOON_BADGE = '<span class="itwd-soon-badge"><i class="fas fa-hourglass-half"></i>Coming Soon</span>'


def patch_all_things(s):
    st = s.index('<div class="elementor-element elementor-element-faea3de')
    en = V.block(s, st)
    sec = s[st:en].replace('>AI Project <br> Lab<', '>Find <br> Project<')

    def mark(m):
        card = m.group(0)
        if re.search(r'>\s*(Student|Monthly)\s*<br>', card) and 'itwd-soon-badge' not in card:
            card = card.replace('<div class="category-card3"', '<div class="category-card3" data-itwd-soon', 1)
            card = re.sub(r'(<div class="box-icon">.*?</div>)', lambda x: x.group(1) + SOON_BADGE, card, count=1, flags=re.S)
        if re.search(r'>\s*Monthly\s*<br>', card):
            card = re.sub(r'href="[^"]*"', 'href="%s"' % HACKATHON_URL, card)
        return card
    sec = re.sub(r'<div class="category-card3".*?</a></div>', mark, sec, flags=re.S)
    return s[:st] + sec + s[en:]


# --------------------------------------------------------------------------- home: app section (no boxed card)

def patch_app_banner(s):
    s = swap(s, '<h2 id="itwd-app-banner-title"><span>Free +2 Computer</span><br>Classes All</h2>',
             '<h2 id="itwd-app-banner-title"><span>Free +2 Computer Classes,</span><br>sabai euta App ma</h2>')
    return swap(s, '<p>Learn, Practice, and Grow — Anytime, Anywhere.</p>',
                '<p>Video classes, notes, practice ra mock tests &mdash; IT Wala Dai App ma jahile pani, jaha pani siknuhos.</p>')


# --------------------------------------------------------------------------- home: the three real courses

def _info(icon, label, value, cls=''):
    return ('<div class="course-info%s"><div class="box-icon"><i class="%s"></i></div><div class="course-info-details">'
            '<span class="course-info-title">%s</span><h6 class="course-info-text">%s</h6></div></div>' % (cls, icon, label, value))


def home_course_card(title, url, img, alt, tag, audience, desc, infos, price, cta, delay, start_attrs=''):
    return (
        '<div class="th-course-single th_fade_anim" data-delay="%(delay)s"><div class="course-card itwd-hc">'
        '<div class="box-img"><a href="%(url)s"><img decoding="async" loading="lazy" src="%(img)s" alt="%(alt)s"></a>'
        '<span class="itwd-hc__tag">%(tag)s</span></div>'
        '<h3 class="box-title"><a href="%(url)s">%(title)s</a></h3>'
        '<p class="itwd-hc__aud"><i class="fal fa-user-graduate"></i>%(audience)s</p>'
        '<p class="itwd-hc__desc">%(desc)s</p>'
        '<div class="box-content">%(infos)s</div>'
        '<div class="btn-wrap">%(price)s<a href="%(url)s" class="th-btn btn-sm style-border2"%(start)s>%(cta)s%(arrow)s</a></div>'
        '</div></div>'
        % dict(title=title, url=url, img=img, alt=escape(alt), tag=tag, audience=audience, desc=desc, infos=infos,
               price=price, cta=cta, arrow=ARROW, delay=delay, start=start_attrs))


BACHELOR_SERVICE = 'Build Bachelor Projects with AI'


def home_courses():
    cards = []
    for i, slug in enumerate(['cpp-programming', 'computer-course']):
        c = COURSE_BY_SLUG[slug]
        cards.append(home_course_card(
            c['name'], course_url(c), course_img(c, B.unsplash), c['name'] + ' course', 'Free',
            c['audience_short'] if slug == 'computer-course' else 'Class 11 ra Class 12 ka students',
            c['short'],
            _info('fal fa-file-lines', 'Lessons:', '%d Lessons' % n_lessons(c), ' escul__lesson') +
            _info('fas fa-clock', 'Duration:', c['duration'], ' escul__duration'),
            '<span class="box-price">FREE</span>', c['home_cta'], '0.%d' % (2 + 2 * i)))
    cards.append(home_course_card(
        BACHELOR_SERVICE, '#start-project', '/assets/itwd/course-bachelor-ai.jpg',
        'Duijana bachelor students laptop ma project ko barema kura gardai', 'Project Guidance', 'Bachelor students',
        'Bachelor-level project ko idea bata planning, suitable technology chhanna, AI tools lai responsibly use garna, coding '
        'concepts bujhna, debugging garna ra aafno project step-by-step develop garna guidance linuhos. IT Wala Dai le hajurlai '
        'project banauna sikna ra aafai implement garna guide garchha.',
        _info('fal fa-diagram-project', 'Type:', 'Project-based guidance') +
        _info('fal fa-comments', 'Pricing:', 'Project scope anusar'),
        '<span class="box-price itwd-hc__guidance">Project Guidance</span>', 'Project Guidance Ko Lagi Sodhnuhos', '0.6',
        ' data-kind="project" data-project="%s"' % BACHELOR_SERVICE))
    # the guidance card opens the enquiry form (itwd-start) instead of a course page
    cards[-1] = cards[-1].replace('class="th-btn btn-sm style-border2" data-kind', 'class="th-btn btn-sm style-border2 itwd-start" data-kind')
    return ''.join(cards)


def patch_featured_courses(s):
    st = s.index('<div class="th-course-row columns-3')
    en = V.block(s, st)
    s = s[:st] + '<div class="th-course-row columns-3 itwd-home-courses">' + home_courses() + '</div>' + s[en:]
    # "Explore Free Courses" button -> the real +2 courses page
    return re.sub(r'(<a class="th-btn th_btn " href=")[^"]*(">Explore Free Courses)', r'\1/plus-two\2', s, count=1)


# --------------------------------------------------------------------------- home: the two promo boxes under the courses

def patch_popular_promos(s):
    st = s.index('<section class="itwd-popular-promos">')
    en = s.index('</section>', st) + len('</section>')
    imgs = re.findall(r'<div class="box-thumb th_fade_anim"><img decoding="async" src="([^"]+)"', s[st:en])
    boxes = [
        ('bg-theme', 'subtitle-icon1-2.svg', '+2 Students', '+2 Students, Aafno IT Foundation Aaja Bata Majboot Banaunuhos',
         'Class 11 ra Class 12 ko Computer Science lai sajilo tarikale bujhna, C++ sikna ra practical computer skills develop garna free learning resources explore garnuhos.',
         '/plus-two', 'Explore +2 Courses', imgs[0] if imgs else '', '+2 student IT Wala Dai sanga sikdai'),
        ('bg-theme2', 'subtitle-icon1-3.svg', "Bachelor's Students", "Bachelor's Students, Aafno IT Future Ko Lagi Tayari Garnuhos",
         'IT colleges ra courses compare garnuhos, aafno academic interest anusar options bujhnuhos, ra AI tools ko help le aafno project aafai develop garna practical guidance linuhos.',
         V.CONSULT_URL, 'Explore Bachelor Guidance', imgs[1] if len(imgs) > 1 else '', "Bachelor's student IT Wala Dai bata guidance lindai"),
    ]
    cols = ''.join(
        '<div class="col-lg-6"><div class="cta-card2 %s" data-bg-src="/wp-content/uploads/2026/02/cta-card-bg2-1.png">'
        '<div class="title-area mb-0">'
        '<span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/%s" alt="">%s</span>'
        '<h2 class="sec-title th_fade_anim"><span class="th-text-perspective">%s</span></h2>'
        '<p class="itwd-pp__text th_fade_anim">%s</p>'
        '<div class="btn-wrap mt-30 th_fade_anim"><a href="%s" class="th-btn style5 th_btn">%s <i class="far fa-arrow-right ms-2"></i></a></div>'
        '</div><div class="box-thumb th_fade_anim"><img decoding="async" src="%s" alt="%s"></div></div></div>'
        % b for b in boxes)
    return s[:st] + ('<section class="itwd-popular-promos">\n  <div class="container">\n    <div class="row gy-4">%s</div>\n'
                     '  </div>\n</section>' % cols) + s[en:]


# --------------------------------------------------------------------------- project guidance (home "AI Project Lab" + Bachelor Project page)

GUIDANCE_FEATURES = [
    ('fab fa-github', 'GitHub &amp; Source Code Guidance',
     'GitHub repository setup, source-code structure, version control ra code bujhna ra manage garna step-by-step guidance linuhos.'),
    ('fal fa-cloud-arrow-up', 'Live Deployment Guidance',
     'Hosting options, deployment process, environment configuration ra project lai live URL ma publish garne tarika bujhnuhos. '
     'Hajurko project ko requirements-anusar deployment steps siknuhos.'),
    ('fal fa-file-lines', 'Project Report Guidance',
     'Proposal, documentation, methodology ra college ko required report structure bujhna help linuhos. Aafno project ko actual '
     'work anusar report tayar garna guidance paunuhos.'),
    ('fal fa-presentation-screen', 'PPT Slides &amp; Demo Video Guidance',
     'Project presentation ko structure, slide planning, demo recording ra presentation delivery ko lagi practical guidance linuhos.'),
    ('fal fa-chalkboard-user', 'Live Project Guidance',
     'Project idea lai smaller tasks ma divide garna, technology chhanna, AI tools use garna, errors debug garna ra step-by-step '
     'implementation sikna guidance linuhos.'),
]


def guidance_grid(extra_cls=''):
    return '<div class="itwd-pg-grid%s">%s</div>' % (extra_cls, ''.join(
        '<div class="itwd-pg-card th_fade_anim" data-delay="0.%d"><span class="itwd-pg-card__icon"><i class="%s"></i></span>'
        '<div><h3 class="itwd-pg-card__title">%s</h3><p class="itwd-pg-card__text">%s</p></div></div>'
        % (1 + i, ic, t, d) for i, (ic, t, d) in enumerate(GUIDANCE_FEATURES)))


def patch_project_lab(s):
    s = re.sub(r'( AI Project Lab </span><h2 class="sec-title th_fade_anim "><span class="th-text-perspective">).*?'
               r'(</span></h2><p class="th_fade_anim">).*?(</p>)',
               lambda m: m.group(1) + 'Aafno project aafai banaunuhos, Dai ko guidance sanga.' + m.group(2) +
               'Idea chhannu dekhi code, deployment, report ra presentation samma &mdash; har step bujhna ra aafai implement '
               'garna mentor guidance. Concept hajurle bujhnuhunchha, project hajurkai hunchha.' + m.group(3),
               s, count=1, flags=re.S)
    st = s.index('elementor-element-e21c93c')
    wc = s.index('<div class="elementor-widget-container">', st)
    en = V.block(s, wc)
    s = s[:wc] + '<div class="elementor-widget-container">' + guidance_grid() + '</div>' + s[en:]
    return s.replace('>PROJECT HERNUHOS<', '>Bachelor Project Guidance Hernuhos<')


def patch_stats(s):
    return re.sub(r'<div class="counter-card"><div class="media-body"><h2 class="box-number"><span class="counter-number">40</span>\+</h2>'
                  r'<p class="box-text">Industry Mentors</p></div></div><div class="divider"></div>', '', s)


# --------------------------------------------------------------------------- home: "+2 Students ka lagi" (hackathon = coming soon, no notes)

def patch_plus2_section(s):
    # same length as the original ring text (the theme spaces the letters evenly around the circle)
    s = re.sub(r'<span class="circle-title-anime">(Hackathon Prize Pool|Hackathon Coming Soon)[^<]*</span>',
               '<span class="circle-title-anime">Monthly Hackathon * Coming Soon * Hackathon * </span>', s)
    assert 'Monthly Hackathon * Coming Soon * Hackathon * ' in s
    s = swap(s, '<div class="year-counter"><div class="box-title"><span class="counter-number">50</span>K</div></div>',
             '<a class="year-counter itwd-soon-counter" href="%s" aria-label="Monthly Hackathon &mdash; Coming Soon">'
             '<span class="box-title"><i class="fal fa-rocket-launch"></i><span>Soon</span></span></a>' % HACKATHON_URL)
    st = s.index('+2 Students ka lagi</span>')
    en = s.index('</section>', st)
    sec = s[st:en]
    sec = re.sub(r'(For \+2 students, IT Wala Dai has more\.</span></h2><p class="th_fade_anim">).*?(</p>)',
                 lambda m: m.group(1) + 'School pachhi ke garne, kun college, kun course &mdash; confuse hunuhunchha? Dai chha ni. '
                 'Free coding, sahi college chhanna help, ra chhittai aaudai gareko monthly hackathon.' + m.group(2), sec, count=1, flags=re.S)
    items = ['Free coding for +2 &mdash; C++, C ra Complete Computer Course simple bhasha ma',
             'Monthly hackathon &mdash; <a href="%s" class="itwd-soon-link">Coming Soon</a>' % HACKATHON_URL,
             'College finder &mdash; CSIT, BIT, BCA wa foreign-affiliated &mdash; sahi choice garnuhos',
             'IT Wala Dai App &mdash; Android ra Windows ma available']
    sec = re.sub(r'(<div class="checklist th_fade_anim"><ul>).*?(</ul>)',
                 lambda m: m.group(1) + ''.join('<li>%s</li>' % i for i in items) + m.group(2), sec, count=1, flags=re.S)
    return s[:st] + sec + s[en:]


def patch_home(s, modal_html):
    for f in (patch_hero_message, patch_cpp_section, patch_all_things, patch_app_banner, patch_featured_courses,
              patch_popular_promos, patch_project_lab, patch_stats, patch_plus2_section):
        s = f(s)
    return patch_home_modal(s, modal_html)


# --------------------------------------------------------------------------- Bachelor Project page (/programs)

HOW_IT_WORKS = {
    'Idea <br> chhannuhos': '100+ real-life ideas bata chhannuhos wa aafnai idea lyaunuhos. Mentor sanga basera project ko scope fix garnuhos.',
    'AI sanga <br> build': 'Claude, Copilot, Cursor jasta AI tools responsibly use garna siknuhos. Code hajurle lekhnuhunchha ra '
                           'bujhnuhunchha &mdash; AI le help matra garchha.',
    'Weekly mentor <br> review': 'Mentor le hajurko code, security ra architecture review garera improve garne tarika dekhaunuhunchha.',
    'Deploy + viva <br> ready': 'Deployment, report, slides ra viva ko tayari kasari garne &mdash; step-by-step guidance. Kaam hajurkai, '
                                'confidence pani hajurkai.',
}

PROGRAMS_GUIDANCE = '''
<section class="itwd-pg space" id="project-guidance" aria-labelledby="itwd-pg-title">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Project Guidance</span>
      <h2 class="sec-title th_fade_anim" id="itwd-pg-title"><span class="th-text-perspective">Project hajurko, guidance Dai ko</span></h2>
      <p class="th_fade_anim itwd-sub-lead">IT Wala Dai le project banaidine hoina &mdash; hajurlai aafno project bujhna, plan garna, banauna ra present garna sikauchha. Price project ko scope ra requirements anusar WhatsApp ma clear garinchha.</p>
    </div>
    %s
    <div class="itwd-pg-cta th_fade_anim">
      <a href="#start-project" class="th-btn itwd-start" data-kind="project" data-project="%s">Project Guidance Ko Lagi Sodhnuhos%s</a>
    </div>
  </div>
</section>
'''


def patch_programs(s):
    s = s.replace('<title>Find Project &#8211; IT Wala Dai</title>', '<title>Bachelor Project Guidance &#8211; IT Wala Dai</title>')
    s = s.replace('<h1 class="breadcumb-title">Find Project</h1>', '<h1 class="breadcumb-title">Bachelor Project</h1>')
    s = s.replace('<li><a href="/">Home</a></li><li>Find Project</li>', '<li><a href="/">Home</a></li><li>Bachelor Project</li>')
    for title, text in HOW_IT_WORKS.items():
        s = re.sub(r'(<h3 class="box-title">%s</h3><p class="box-text">).*?(</p>)' % re.escape(title),
                   lambda m: m.group(1) + text + m.group(2), s, count=1, flags=re.S)
    s = s.replace('<h3 class="box-title">Deploy + viva <br> ready</h3>', '<h3 class="box-title">Deploy + viva <br> tayari</h3>')
    s = re.sub(r'(<h3 class="box-title">Deploy \+ viva <br> tayari</h3><p class="box-text">).*?(</p>)',
               lambda m: m.group(1) + HOW_IT_WORKS['Deploy + viva <br> ready'] + m.group(2), s, count=1, flags=re.S)

    def after_how(s, html):
        st = s.index('id="how-it-works"')
        st = s.rindex('<div class="elementor-element', 0, st)
        en = V.block(s, st)
        return s[:en] + html + s[en:]
    return put(s, 'project-guidance', PROGRAMS_GUIDANCE % (guidance_grid(' itwd-pg-grid--wide'), BACHELOR_SERVICE, ARROW), after_how)


# --------------------------------------------------------------------------- coming soon: countdown + /hackathon + /community banner
# The launch target lives in ONE place: LAUNCH_TARGETS in assets/itwd/itwd.js

def countdown(key):
    units = [('days', 'Din'), ('hours', 'Ghanta'), ('minutes', 'Minute'), ('seconds', 'Second')]
    return ('<div class="itwd-countdown" data-countdown="%s">%s</div>'
            '<p class="itwd-countdown__meta"><i class="fal fa-calendar"></i>Target launch: <strong data-countdown-target="%s">'
            '&mdash;</strong> <span>(approximate &mdash; development ko anuman)</span></p>'
            '<p class="itwd-countdown__done" data-countdown-done="%s" hidden>Launch ko tayari antim charan ma chha &mdash; '
            'official date chhittai yahi announce garinechha.</p>'
            % (key, ''.join('<div class="itwd-countdown__unit"><span class="itwd-countdown__num" data-unit="%s">--</span>'
                            '<span class="itwd-countdown__lbl">%s</span></div>' % u for u in units), key, key))


def soon_hero(key, label, title_html, lead, h='h1'):
    return '''
<section class="itwd-soon" aria-labelledby="itwd-soon-%(key)s">
  <span class="itwd-soon__glow itwd-soon__glow--a" aria-hidden="true"></span>
  <span class="itwd-soon__glow itwd-soon__glow--b" aria-hidden="true"></span>
  <div class="container">
    <div class="itwd-soon__inner">
      <span class="itwd-soon__label th_fade_anim"><span class="itwd-soon__dot" aria-hidden="true"></span>Coming Soon &middot; %(label)s</span>
      <%(h)s class="itwd-soon__title th_fade_anim" id="itwd-soon-%(key)s">%(title)s</%(h)s>
      <p class="itwd-soon__lead th_fade_anim">%(lead)s</p>
      <div class="th_fade_anim">%(countdown)s</div>
      <div class="itwd-btn-pair itwd-soon__btns th_fade_anim">
        <a href="/plus-two" class="th-btn">Free Courses Hernuhos%(arrow)s</a>
        <a href="/" class="th-btn style-border2">Home ma Farkinuhos</a>
      </div>
    </div>
  </div>
</section>''' % dict(key=key, label=label, title=title_html, lead=lead, countdown=countdown(key), arrow=ARROW, h=h)


def hackathon_content():
    plans = [
        ('fal fa-laptop-code', 'Monthly coding challenge', 'Har mahina euta theme ra problem &mdash; +2 ra bachelor students ka lagi.'),
        ('fal fa-users-gear', 'Solo wa team ma', 'Eklai wa saathiharu sanga milera solution banaune plan.'),
        ('fal fa-comments', 'Mentor feedback', 'Submit gareko solution ma mentor bata sikne feedback.'),
    ]
    cards = ''.join('<div class="col-md-4"><div class="itwd-soon-card th_fade_anim" data-delay="0.%d"><span class="itwd-soon-card__icon">'
                    '<i class="%s"></i></span><h3>%s</h3><p>%s</p></div></div>' % (2 + 2 * i, ic, t, d)
                    for i, (ic, t, d) in enumerate(plans))
    return soon_hero(
        'hackathon', 'Monthly Hackathon', 'IT Wala Dai <span class="itwd-hl">Monthly Hackathon</span>',
        'Students ka lagi monthly coding challenge tayar gardai chhau. Yo feature ahile development ma chha &mdash; '
        'registration ra participation launch pachhi matra suru hunchha.') + '''
<section class="itwd-soon-plan space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Ke plan chha</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Hackathon ma ke hunechha?</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Yo plan ho &mdash; rules, format ra dates launch aghi final garera yahi publish garinechha.</p>
    </div>
    <div class="row gy-4">%s</div>
    <div class="itwd-soon-plan__next th_fade_anim">
      <div><strong>Hackathon aaunu aghi tayari garnuhos</strong><span>Free C++ course bata programming logic majboot banaunuhos.</span></div>
      <a href="/plus-two/cpp-programming" class="th-btn">Free C++ Sikna Suru Garnuhos%s</a>
    </div>
  </div>
</section>''' % (cards, ARROW)


COMMUNITY_SOON = soon_hero(
    'community', 'Student Community', 'IT Wala Dai <span class="itwd-hl">Student Community</span> chhittai aaudai chha',
    'Community features ahile development ma chhan. Tala dekhaieka features launch pachhi matra active hunechhan &mdash; '
    'tyo bela samma free courses ra guidance use garnuhos.', h='h2')


def patch_community(s):
    s = put(s, 'community-soon', COMMUNITY_SOON, before('<section class="itwd-community space" id="community">'))
    s = s.replace('<span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">IT Wala Dai Community</span>',
                  '<span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Launch pachhi ke hunechha</span>')
    return s.replace('<p class="th_fade_anim itwd-sub-lead">+2 ra bachelor ka IT students ko community — prashna sodhnuhos, project share garnuhos, ra seniors bata siknuhos.</p>',
                     '<p class="th_fade_anim itwd-sub-lead">+2 ra bachelor ka IT students ko community &mdash; launch pachhi yaha prashna sodhna, project share garna ra seniors bata sikna milnechha.</p>')


# --------------------------------------------------------------------------- Free Guidance After +2: verified programmes + colleges
# Sources: each programme / college's official website (links below), checked 23 Oct 2026. Details not found on an
# official page are left out (None) instead of guessed.

CHECKED = 'Oct 2026'

PROGRAMMES = [  # foreign-affiliated first
    dict(name='BSc (Hons) Computing', kind='foreign', award='London Metropolitan University, UK', at='Islington College',
         years='3 years', elig='NEB +2 ma CGPA 2.2 (55%) wa mathi', url='https://islington.edu.np/programmes/computing'),
    dict(name='BSc (Hons) Computing with Artificial Intelligence', kind='foreign', award='London Metropolitan University, UK',
         at='Islington College', years='3 years', elig='NEB +2 ma CGPA 2.2 (55%) wa mathi',
         url='https://islington.edu.np/programmes/computing-with-Ai'),
    dict(name='BSc (Hons) Computer Networking &amp; IT Security', kind='foreign', award='London Metropolitan University, UK',
         at='Islington College', years=None, elig='NEB +2 ma CGPA 2.2 (55%) wa mathi',
         url='https://islington.edu.np/programmes/networking'),
    dict(name='BSc (Hons) Computer Science with Artificial Intelligence', kind='foreign', award='Coventry University, UK',
         at='Softwarica College of IT &amp; E-Commerce', years='3 years',
         elig='+2 ma GPA 2.4 wa A Level; English: IELTS 6.0 wa college ko GETS test',
         url='https://softwarica.edu.np/programmes/bsc-computer-science-ai'),
    dict(name='BSc (Hons) Software Engineering', kind='foreign', award='Coventry University, UK',
         at='Softwarica College of IT &amp; E-Commerce', years='3 years',
         elig='+2 ma GPA 2.4 wa A Level; English: IELTS 6.0 wa college ko GETS test',
         url='https://softwarica.edu.np/programmes/bsc-software-engineering'),
    dict(name='BSc (Hons) Ethical Hacking &amp; Cybersecurity', kind='foreign', award='Coventry University, UK',
         at='Softwarica College of IT &amp; E-Commerce', years='3 years',
         elig='+2 ma GPA 2.4 wa A Level; English: IELTS 6.0 wa college ko GETS test',
         url='https://softwarica.edu.np/programmes/bsc-cybersecurity'),
    dict(name='BSc (Hons) Computer Science with Artificial Intelligence', kind='foreign', award='Birmingham City University, UK',
         at='Sunway College Kathmandu', years='4 years (professional placement year sahit)', elig='NEB grade 12 ma CGPA 2.6 wa mathi',
         url='https://sunway.edu.np/program/artificial-intelligence/'),
    dict(name='BSc (Hons) Business Information Technology', kind='foreign', award='Birmingham City University, UK',
         at='Sunway College Kathmandu', years=None, elig='NEB grade 12 ma CGPA 2.6 wa mathi',
         url='https://sunway.edu.np/program/bschons-business-information-technology/'),
    dict(name='BSc (Hons) Computer Science', kind='foreign', award='University of Wolverhampton, UK',
         at='Herald College Kathmandu', years='3 years', elig='NEB +2 (jun-sukai stream) ma 55% (GPA 2.4) wa mathi',
         url='https://heraldcollege.edu.np/bachelors-in-computer-science'),
    dict(name='BSc (Hons) Cybersecurity', kind='foreign', award='University of Wolverhampton, UK',
         at='Herald College Kathmandu', years='3 years', elig='NEB +2 (jun-sukai stream) ma 55% (GPA 2.4) wa mathi',
         url='https://heraldcollege.edu.np/bachelors-in-cyber-security'),
    dict(name='BSc (Hons) Computing', kind='foreign', award='Leeds Beckett University, UK', at='The British College',
         years='3 years', elig='Foundation entry: +2 ma 60% (GPA 2.4); direct entry ko criteria official page ma',
         url='https://www.thebritishcollege.edu.np/programme/bsc-computing-BIT-in-kathmandu-nepal'),
    dict(name='BSc (Hons) Computer Science &ndash; Artificial Intelligence', kind='foreign',
         award='University of the West of England, UK', at='The British College', years='3 years',
         elig='+2 ma 60% (GPA 2.4) wa mathi',
         url='https://www.thebritishcollege.edu.np/programme/bsc-hons-computer-science-artificial-intelligence'),
    dict(name='BSc (Hons) Cyber Security and Digital Forensics', kind='foreign', award='University of the West of England, UK',
         at='The British College', years='3 years', elig='+2 ma 60% (GPA 2.4) wa mathi',
         url='https://www.thebritishcollege.edu.np/programme/bsc-hons-cyber-security-and-digital-forensics'),
    dict(name='Bachelor of Information Technology (Hons)', kind='foreign', award='HELP University, Malaysia',
         at='Mid-Valley International College', years='4 years (8 semesters)', elig=None,
         url='https://midvalley.edu.np/programs/bachelors-of-information-technology-hons/'),
    # Nepali universities
    dict(name='BSc CSIT', kind='nepal', award='Tribhuvan University (IOST)', at='TU ka constituent ra affiliated colleges',
         years='4 years (8 semesters)', elig='+2 Science ra IOST, TU ko entrance exam', url='https://www.tuiost.edu.np/programs'),
    dict(name='BIT', kind='nepal', award='Tribhuvan University (IOST)', at='TU ka constituent ra affiliated colleges',
         years='4 years (8 semesters)', elig='+2 (jun-sukai stream) ra TU ko entrance exam', url='https://www.tuiost.edu.np/programs'),
    dict(name='BCA', kind='nepal', award='Tribhuvan University (FOHSS)', at='Kathmandu Model College lagayat TU-affiliated colleges',
         years='4 years (8 semesters)', elig='+2 ma kam-se-kam 45% ra entrance (Kathmandu Model College ko criteria)',
         url='https://kmcen.edu.np/best-bca-college-nepal/'),
    dict(name='BIM', kind='nepal', award='Tribhuvan University (Faculty of Management)', at='TU ka constituent ra affiliated colleges',
         years='4 years (8 semesters)', elig=None, url='https://memc.tu.edu.np/pages/bachelor-of-information-management-bim-2935'),
    dict(name='BIT', kind='nepal', award='Purbanchal University', at='Himalayan WhiteHouse International College',
         years='4 years (8 semesters)', elig=None, url='https://whitehousecmt.edu.np/bit'),
    dict(name='BE Computer', kind='nepal', award='Purbanchal University', at='Himalayan WhiteHouse International College',
         years='4 years (8 semesters)', elig=None, url='https://whitehousecmt.edu.np/be-computer'),
]

# bachelor-level IT colleges only (+2-only colleges such as CCRC and Urbana are not listed here)
COLLEGES = [
    dict(name='Islington College', logo=None, univ='London Metropolitan University, UK', kind='foreign', location=None,
         progs=['BSc (Hons) Computing', 'BSc (Hons) Computing with AI', 'BSc (Hons) Computer Networking &amp; IT Security'],
         url='https://islington.edu.np/'),
    dict(name='Softwarica College of IT &amp; E-Commerce', logo='/college/softwrica.png', univ='Coventry University, UK',
         kind='foreign', location='Kathmandu',
         progs=['BSc (Hons) Computer Science with AI', 'BSc (Hons) Software Engineering', 'BSc (Hons) Ethical Hacking &amp; Cybersecurity'],
         url='https://softwarica.edu.np/courses'),
    dict(name='Sunway College Kathmandu', logo='/college/sunway.png', univ='Birmingham City University, UK', kind='foreign',
         location='Maitidevi, Kathmandu',
         progs=['BSc (Hons) Computer Science with AI', 'BSc (Hons) Business Information Technology'],
         url='https://sunway.edu.np/programs/'),
    dict(name='Herald College Kathmandu', logo=None, univ='University of Wolverhampton, UK', kind='foreign',
         location='Naxal, Kathmandu', progs=['BSc (Hons) Computer Science', 'BSc (Hons) Cybersecurity'],
         url='https://heraldcollege.edu.np/'),
    dict(name='The British College', logo=None, univ='Leeds Beckett University ra University of the West of England, UK',
         kind='foreign', location='Thapathali, Kathmandu',
         progs=['BSc (Hons) Computing', 'BSc (Hons) Computer Science &ndash; AI', 'BSc (Hons) Cyber Security &amp; Digital Forensics'],
         url='https://www.thebritishcollege.edu.np/'),
    dict(name='Mid-Valley International College', logo='/college/images.png', univ='HELP University, Malaysia', kind='foreign',
         location=None, progs=['Bachelor of Information Technology (Hons)'],
         url='https://midvalley.edu.np/programs/bachelors-of-information-technology-hons/'),
    dict(name='Kathmandu Model College', logo='/college/kmc.png', univ='Tribhuvan University', kind='nepal', location=None,
         progs=['BCA'], url='https://kmcen.edu.np/best-bca-college-nepal/'),
    dict(name='Himalayan WhiteHouse International College', logo='/college/white%20house.png', univ='Purbanchal University',
         kind='nepal', location=None, progs=['BIT', 'BE Computer'], url='https://whitehousecmt.edu.np/'),
]

KIND_LABEL = {'foreign': 'Foreign-affiliated', 'nepal': 'Nepal university'}

CHOICE_ARROW = ('<svg class="itwd-col2__arrow" viewBox="0 0 40 46" fill="none" aria-hidden="true" focusable="false">'
                '<path d="M8 3 C 30 6, 36 24, 22 40" /><path d="M14 35 L22 41 L27 32" /></svg>')


def programme_card(p):
    facts = [('Degree / University', p['award']), ('Nepal ma', p['at']), ('Duration', p['years']), ('Eligibility', p['elig'])]
    return (
        '<div class="col-xl-4 col-md-6"><article class="itwd-prog itwd-prog--%s th_fade_anim">'
        '<span class="itwd-prog__tag">%s</span><h4 class="itwd-prog__name">%s</h4><dl class="itwd-prog__facts">%s</dl>'
        '<a href="%s" target="_blank" rel="noopener" class="itwd-prog__link">Official programme page<i class="far fa-arrow-up-right"></i></a>'
        '</article></div>'
        % (p['kind'], KIND_LABEL[p['kind']], p['name'],
           ''.join('<div><dt>%s</dt><dd>%s</dd></div>' % (k, v) for k, v in facts if v), p['url']))


def courses_section():
    groups = [('foreign', 'Foreign-affiliated programmes', 'UK ra Malaysia ka university ko degree &mdash; padhai Nepal mai'),
              ('nepal', 'Nepal ka university programmes', 'TU ra Purbanchal University ka bachelor IT programmes')]
    body = ''.join(
        '<div class="itwd-prog-group th_fade_anim"><h3>%s</h3><span>%s</span></div><div class="row gy-4 mb-50">%s</div>'
        % (t, sub, ''.join(programme_card(p) for p in PROGRAMMES if p['kind'] == k)) for k, t, sub in groups)
    return '''<section class="itwd-fc-sec space" id="courses">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">IT courses bujhnuhos</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Nepal ma padhna milne bachelor IT programmes</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Foreign-affiliated programmes pahila, ani Nepal ka university programmes. Duration ra eligibility college / university ko official page bata liyeko ho (checked: %s) &mdash; admission aghi official source mai feri verify garnuhos.</p>
    </div>
    %s
  </div>
</section>''' % (CHECKED, body)


def initials(name):
    words = [w for w in re.sub(r'&\w+;', ' ', name).split() if w[0].isupper()]
    return ''.join(w[0] for w in words[:2])


def college_card(c):
    logo = ('<img src="%s" alt="%s logo" loading="lazy">' % (c['logo'], c['name']) if c['logo'] else
            '<span class="itwd-col2__initials" aria-hidden="true">%s</span>' % initials(c['name']))
    loc = '<p class="itwd-col2__loc"><i class="fal fa-location-dot"></i>%s</p>' % c['location'] if c['location'] else ''
    plain = re.sub(r'&amp;', '&', c['name'])
    return (
        '<div class="col-xl-4 col-md-6 itwd-fc-college-col" data-name="%(lname)s"><article class="itwd-col2">'
        '<div class="itwd-col2__head"><div class="itwd-col2__logo">%(logo)s</div>'
        '<div><span class="itwd-col2__type itwd-col2__type--%(kind)s">%(kindl)s</span><h3>%(name)s</h3></div></div>'
        '<p class="itwd-col2__uni"><i class="fal fa-university"></i>%(univ)s</p>%(loc)s'
        '<ul class="itwd-col2__progs">%(progs)s</ul>'
        '<div class="itwd-col2__actions">'
        '<a class="itwd-col2__btn" href="%(url)s" target="_blank" rel="noopener"><i class="far fa-arrow-up-right-from-square"></i>Official Info Hernuhos</a>'
        '<p class="itwd-col2__note">%(arrow)s<span>College ko kura matra hoina, aafno lagi sahi choice pani bujhnuhos.</span></p>'
        '<a class="itwd-col2__btn itwd-col2__btn--dai" href="%(wa)s" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i>Dai Lai Sodhnuhos</a>'
        '</div><p class="itwd-col2__checked">Info checked: %(checked)s &middot; official website</p>'
        '</article></div>'
        % dict(lname=escape(plain.lower()), logo=logo, kind=c['kind'], kindl=KIND_LABEL[c['kind']], name=c['name'],
               univ=c['univ'], loc=loc, progs=''.join('<li>%s</li>' % p for p in c['progs']), url=c['url'],
               arrow=CHOICE_ARROW, checked=CHECKED,
               wa=V.wa_link('Namaste Dai! Malai %s ko IT courses ra admission ko barema guidance chahiyo.' % plain)))


def colleges_section():
    return '''<section class="itwd-fc-sec itwd-fc-sec--tint space" id="colleges">
  <div class="container">
    <div class="title-area text-center mb-30">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Explore colleges</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Bachelor-level IT colleges explore garnuhos</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Yo list ma bachelor-level IT / computing programmes chalaune colleges matra chhan (+2 matra padhaune colleges yaha chhainan). List sampurna chhaina &mdash; aru college ko barema pani Dai lai sodhna saknuhunchha.</p>
    </div>
    <div class="itwd-fc-callout th_fade_anim">
      <span class="itwd-fc-callout__icon"><i class="fal fa-scale-balanced"></i></span>
      <div><strong>College ko kura matra hoina, aafno lagi sahi choice pani bujhnuhos.</strong>
      <p>College harule aafno college ra course ramro chha bhanera prachar garnu swabhavik ho. Official details college bata verify garnuhos. Ani hajurko interest, eligibility, budget ra goals anusar options compare garna IT Wala Dai sanga free guidance linuhos.</p></div>
    </div>
    <div class="itwd-fc-search th_fade_anim"><i class="far fa-magnifying-glass"></i>
      <input type="search" id="itwd-college-search" placeholder="College ko naam khojnuhos..." aria-label="College khojnuhos"></div>
    <div class="row gy-4" id="itwd-college-list">%s</div>
    <p class="itwd-fc-empty" hidden>Yo naam ko college list ma bhetiyena. <a href="%s" target="_blank" rel="noopener">Dai lai sodhnuhos</a> &mdash; hami information khojna help garchhau.</p>
    <div class="text-center mt-40 th_fade_anim"><a href="#consult-form" class="th-btn">Sabai IT Colleges ko barema Sodhnuhos%s</a></div>
  </div>
</section>''' % (''.join(college_card(c) for c in COLLEGES),
                 V.wa_link('Namaste Dai! Malai euta IT college ko barema jaankari chahiyo.'), ARROW)


def _replace_section(s, opening, html):
    st = s.index(opening)
    en = s.index('</section>', st) + len('</section>')
    return s[:st] + html + s[en:]


def patch_consult(s):
    s = _replace_section(s, '<section class="itwd-fc-sec space" id="courses">', courses_section())
    s = _replace_section(s, '<section class="itwd-fc-sec itwd-fc-sec--tint space" id="colleges">', colleges_section())
    if '<option>Foreign-affiliated BSc (Hons)</option>' not in s:
        s = s.replace('<option>BE Computer</option>', '<option>BE Computer</option><option>Foreign-affiliated BSc (Hons)</option>', 1)
    return s.replace('BSc CSIT, BIT, BCA, BIM, BE Computer jasta programs explore garna milchha.',
                     'BSc CSIT, BIT, BCA, BIM, BE Computer ra foreign-affiliated BSc (Hons) programs explore garna milchha.')


# --------------------------------------------------------------------------- contact page

def patch_contact(s):
    return re.sub(r'<a class="box-link" href="https://www\.google\.com/maps/[^"]*" target="_blank" rel="noopener">[^<]*</a>',
                  '<a class="box-link" href="https://www.google.com/maps/search/?api=1&amp;query=Maitidevi%2C+Kathmandu%2C+Nepal" '
                  'target="_blank" rel="noopener">Maitidevi, Kathmandu, Nepal</a>', s, count=1)


# --------------------------------------------------------------------------- per page

def patch_page(s, active, home):
    s = patch_header(s, home)
    s = patch_modal_copy(s)
    s = patch_footer_links(s)
    if active == '/programs':
        s = patch_programs(s)
    elif active == '/community':
        s = patch_community(s)
    elif active == '/free-it-consultation':
        s = patch_consult(s)
    elif active == '/contact':
        s = patch_contact(s)
    return s
