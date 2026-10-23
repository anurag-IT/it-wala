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
import cms_data as C
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
    """Only inside the start-project / course enquiry modal (other modals have their own copy)."""
    if '<div class="itwd-modal" id="start-project"' not in s:
        return s
    st = s.index('<div class="itwd-modal" id="start-project"')
    en = V.block(s, st)
    m = s[st:en]
    if '<div class="itwd-modal__intro">' in m:
        m = re.sub(r'<div class="itwd-modal__intro">.*?</p></div>', lambda x: MODAL_INTRO, m, count=1, flags=re.S)
    else:
        m = re.sub(r'<p class="itwd-modal__text">.*?</p>', lambda x: MODAL_INTRO, m, count=1, flags=re.S)
    return s[:st] + m + s[en:]


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

GUIDANCE_FEATURES = [  # guidance only: nothing here is built or delivered for the student
    ('fab fa-github', 'GitHub &amp; Source Code Guidance',
     'Git ra GitHub ko basics bujhna, code organize garna, version control sikna ra aafno source code manage garna guidance paunuhos.'),
    ('fal fa-cloud-arrow-up', 'Live Deployment Guidance',
     'Aafno project lai suitable hosting platform ma deploy garna, environment variables bujhna ra deployment errors solve garna '
     'step-by-step guidance linuhos.'),
    ('fal fa-file-lines', 'Project Report &amp; Documentation Guidance',
     'Proposal, system design, diagrams, implementation details ra final report aafai prepare garna structured guidance paunuhos.'),
    ('fal fa-presentation-screen', 'PPT Slides &amp; Demo Video Guidance',
     'Aafno project ko main features explain garne presentation ra demo video prepare garna siknuhos.'),
    ('fal fa-comments-question', 'Viva Preparation Guidance',
     'Mentor sanga common viva questions practice garera aafno project ra technical decisions confidently explain garna siknuhos.'),
    ('fal fa-chalkboard-user', 'Live Project Guidance',
     'Project planning dekhi implementation, testing ra final presentation samma aafno pace ma agadi badhna technical guidance paunuhos.'),
]


def guidance_grid(extra_cls=''):
    return '<div class="itwd-pg-grid%s">%s</div>' % (extra_cls, ''.join(
        '<div class="itwd-pg-card th_fade_anim" data-delay="0.%d"><span class="itwd-pg-card__icon"><i class="%s"></i></span>'
        '<div><h3 class="itwd-pg-card__title">%s</h3><p class="itwd-pg-card__text">%s</p></div></div>'
        % (1 + i, ic, t, d) for i, (ic, t, d) in enumerate(GUIDANCE_FEATURES)))


def guidance_accordion():
    """Compact accordion for the home "AI Project Lab": headings first, one description open at a time."""
    items = []
    for i, (ic, t, d) in enumerate(GUIDANCE_FEATURES):
        items.append(
            '<div class="itwd-gacc__item"><h3 class="itwd-gacc__h">'
            '<button type="button" class="itwd-gacc__btn" id="itwd-gacc-btn-%(i)d" aria-expanded="false" aria-controls="itwd-gacc-panel-%(i)d">'
            '<span class="itwd-gacc__icon" aria-hidden="true"><i class="%(ic)s"></i></span><span class="itwd-gacc__title">%(t)s</span>'
            '<i class="far fa-chevron-down itwd-gacc__chev" aria-hidden="true"></i></button></h3>'
            '<div class="itwd-gacc__panel" id="itwd-gacc-panel-%(i)d" role="region" aria-labelledby="itwd-gacc-btn-%(i)d">'
            '<div class="itwd-gacc__inner"><p>%(d)s</p></div></div></div>' % dict(i=i, ic=ic, t=t, d=d))
    return '<div class="itwd-gacc th_fade_anim" data-itwd-accordion>%s</div>' % ''.join(items)


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
    s = s[:wc] + '<div class="elementor-widget-container">' + guidance_accordion() + '</div>' + s[en:]
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
    for f in (patch_hero_message, patch_cpp_section, patch_bachelor_section, patch_all_things, patch_app_banner, patch_featured_courses,
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

PROGRAMMES = C.load('programmes')  # foreign-affiliated first; edited in the admin CMS

# bachelor-level IT colleges only (+2-only colleges such as CCRC and Urbana are not listed here)
COLLEGES = C.load('colleges')

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
    s = patch_join(s)
    s = patch_modal_copy(s)
    s = patch_footer_links(s)
    s = patch_mission_layout(s)
    if active == '/about':
        s = patch_stats(s)
    if active == '/programs':
        s = patch_programs(s)
    elif active == '/community':
        s = patch_community(s)
    elif active == '/free-it-consultation':
        s = patch_consult(s)
        s = patch_consult_form(s)
    elif active == '/contact':
        s = patch_contact(s)
    # last, so page-specific sections rebuilt above get the same treatment
    s = fix_placeholders(s)
    s = patch_a11y(s)
    return patch_performance(s)


# =========================================================================== fix pass (Oct 2026)

# --------------------------------------------------------------------------- home: third student section (bachelor's project guidance)

BACHELOR_GUIDANCE_SERVICE = "Bachelor's Project Guidance"


def bachelor_section():
    points = ['Project idea ra technology selection', 'Coding, database ra debugging guidance',
              'Project report ra documentation guidance', 'PPT, demo ra viva preparation guidance']
    return '''
<section class="itwd-cpp itwd-cpp--bachelor" aria-labelledby="itwd-bp-title">
  <span class="itwd-promo__blob itwd-cpp__blob" aria-hidden="true"></span>
  <div class="container">
    <div class="itwd-cpp__grid">
      <div class="itwd-cpp__visual th_fade_anim">
        <span class="itwd-cpp__ring" aria-hidden="true"></span>
        <img src="/assets/itwd/bachelor-project-boy.webp" alt="Bachelor ma kun project banaune bhanera sochdai gareko student" width="640" height="960" decoding="async">
        <span class="itwd-promo__badge itwd-cpp__badge--a"><i class="fas fa-lightbulb"></i>Idea dekhi viva samma</span>
        <span class="itwd-promo__badge itwd-cpp__badge--b"><i class="fas fa-user-graduate"></i>Aafai banaunuhos</span>
      </div>
      <div class="itwd-cpp__content">
        <span class="itwd-promo__label itwd-cpp__label th_fade_anim"><i class="fal fa-diagram-project"></i>Bachelor's Project Guidance</span>
        <h2 class="itwd-promo__title th_fade_anim" id="itwd-bp-title">Project banaunu chha, tara <span class="itwd-hl">suru kata bata</span> garne?</h2>
        <p class="itwd-promo__text th_fade_anim">Bachelor's project suru garda idea chhanna, technology select garna, coding bujhna, database design garna, errors solve garna, report lekhna ra presentation dina garo huna sakchha. IT Wala Dai le hajurlai step-by-step guide garchha, jasle garda hajur aafai project develop garna, technical concepts bujhna ra confidently present garna saknuhunchha.</p>
        <ul class="itwd-cpp__points th_fade_anim">%(points)s</ul>
        <div class="itwd-btn-pair th_fade_anim">
          <a href="/programs" class="th-btn">Bachelor Project Explore Garnuhos%(arrow)s</a>
          <a href="#start-project" class="th-btn style-border2 itwd-start" data-kind="project" data-project="%(service)s">Project Guidance Sodhnuhos</a>
        </div>
      </div>
    </div>
  </div>
</section>
''' % dict(points=''.join('<li><i class="fas fa-check"></i>%s</li>' % p for p in points), arrow=ARROW,
           service=BACHELOR_GUIDANCE_SERVICE)


def patch_bachelor_section(s):
    def after_promo(s, html):
        i = s.index('<!-- itwd:consult-promo:end -->') + len('<!-- itwd:consult-promo:end -->')
        return s[:i] + '\n' + html + s[i:]
    return put(s, 'bachelor-promo', bachelor_section(), after_promo)


# --------------------------------------------------------------------------- mission section: image is a grid column (no absolute positioning)

def patch_mission_layout(s):
    if 'class="cta-img4-1' not in s or 'itwd-mission__visual' in s:
        return s
    m = re.search(r'<section class="overflow-hidden"><div class="cta-wrap4 space"', s)
    if not m:
        return s
    st = m.start()
    en = s.index('</section>', st)
    sec = s[st:en]
    img_st = sec.index('<div class="cta-img4-1')
    img = sec[img_st:V.block(sec, img_st)]
    sec = sec[:img_st] + sec[img_st + len(img):]
    # the content column ends right before the container/row close: <div class="col-xxl-7 col-xl-6">...</div></div></div>
    col_st = sec.index('<div class="col-xxl-7 col-xl-6">')
    col_en = V.block(sec, col_st)
    sec = (sec[:col_en] + '<div class="col-xxl-5 col-xl-6 itwd-mission__visual">' + img + '</div>' + sec[col_en:])
    sec = sec.replace('<section class="overflow-hidden"><div class="cta-wrap4 space"',
                      '<section class="overflow-hidden itwd-mission"><div class="cta-wrap4 space"', 1)
    sec = sec.replace('<div class="row">', '<div class="row align-items-center gy-4">', 1)
    return s[:st] + sec + s[en:]


# --------------------------------------------------------------------------- "Join Now" (header) -> join form -> WhatsApp

JOIN_LEVELS = ['Class 11', 'Class 12', 'Completed +2', "Bachelor's", 'Other']
JOIN_INTERESTS = ['Free C++ course', 'Complete computer course', 'IT course and college guidance',
                  "Bachelor's project guidance", 'Student community', 'Other']


def _options(items):
    return ('<option value="" disabled selected>Chhannuhos</option>' +
            ''.join('<option value="%s">%s</option>' % (escape(i), escape(i)) for i in items))


JOIN_MODAL = '''<div class="itwd-modal itwd-join" id="itwd-join" role="dialog" aria-modal="true" aria-labelledby="itwd-join-title" hidden>
  <div class="itwd-modal__backdrop" data-itwd-join-close></div>
  <div class="itwd-modal__box">
    <button type="button" class="itwd-modal__close" data-itwd-join-close aria-label="Close"><i class="far fa-times"></i></button>
    <span class="itwd-modal__eyebrow">Join IT Wala Dai</span>
    <h3 class="itwd-modal__title" id="itwd-join-title">IT Wala Dai sanga jodinuhos</h3>
    <div class="itwd-modal__intro"><p class="itwd-modal__lead">Form bharnuhos, ani WhatsApp ma Dai sanga direct kura garnuhos.</p>
      <p class="itwd-modal__text">Yo form le hajurko details WhatsApp message ma rakhchha &mdash; WhatsApp ma <strong>Send</strong> thichepachhi matra message Dai lai pugchha. Website le kunai details save gardaina.</p></div>
    <form class="itwd-join-form" novalidate>
      <div class="row g-3">
        <div class="col-12"><label class="itwd-flabel" for="join-name">Pura naam *</label>
          <input class="form-control" id="join-name" name="name" type="text" autocomplete="name" required></div>
        <div class="col-md-6"><label class="itwd-flabel" for="join-level">Ahile ko padhai *</label>
          <select class="form-select" id="join-level" name="level" required>%(levels)s</select></div>
        <div class="col-md-6"><label class="itwd-flabel" for="join-interest">Mukhya interest *</label>
          <select class="form-select" id="join-interest" name="interest" required>%(interests)s</select></div>
        <div class="col-12"><label class="itwd-flabel" for="join-phone">WhatsApp number *</label>
          <input class="form-control" id="join-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="98XXXXXXXX" required></div>
        <div class="col-12"><label class="itwd-flabel" for="join-msg">Sano prashna wa message <span>(optional)</span></label>
          <textarea class="form-control" id="join-msg" name="message" rows="3"></textarea></div>
      </div>
      <p class="itwd-form-status" role="status" aria-live="polite"></p>
      <button type="submit" class="th-btn w-100"><i class="fab fa-whatsapp me-2"></i>WhatsApp ma pathaunuhos</button>
    </form>
  </div>
</div>''' % dict(levels=_options(JOIN_LEVELS), interests=_options(JOIN_INTERESTS))


def patch_join(s):
    """Header "Join Now" is a real button that opens the join form (the modal lives outside #smooth-content)."""
    s = re.sub(r'<a href="[^"]*" class="itwd-join-cta">(.*?)</a>',
               r'<button type="button" class="itwd-join-cta" data-itwd-join aria-haspopup="dialog" aria-controls="itwd-join">\1</button>',
               s, flags=re.S)

    # the modal must come BEFORE itwd.js (the script binds the form when it runs), so it is re-placed on every run
    ma, mb = '<!-- itwd:join-modal:start -->', '<!-- itwd:join-modal:end -->'
    if ma in s:
        s = s[:s.index(ma)] + s[s.index(mb) + len(mb):].lstrip('\n')
    i = s.index('<script src="/assets/itwd/itwd.js"></script>')
    s = s[:i] + ma + JOIN_MODAL + mb + '\n' + s[i:]
    # the mobile menu gets the same Join Now action (the header buttons are hidden below 1200px)
    mobile = ('<!-- itwd:mobile-join:start --><div class="itwd-mobile-join"><button type="button" class="th-btn w-100" data-itwd-join '
              'aria-haspopup="dialog" aria-controls="itwd-join"><i class="fas fa-graduation-cap me-2"></i>Join Now</button>'
              '<a class="itwd-mobile-join__call" href="tel:+9779823415625"><i class="far fa-phone-alt"></i>+977-9823415625</a></div>'
              '<!-- itwd:mobile-join:end -->')
    if '<!-- itwd:mobile-join:start -->' in s:
        s = s[:s.index('<!-- itwd:mobile-join:start -->')] + mobile + s[s.index('<!-- itwd:mobile-join:end -->') + len('<!-- itwd:mobile-join:end -->'):]
    else:
        st = s.index('<div class="th-mobile-menu">')
        en = V.block(s, st)
        s = s[:en] + mobile + s[en:]
    return s


# --------------------------------------------------------------------------- free consultation form: usable contact method + real placeholders

CONTACT_FIELD = ('<fieldset class="itwd-choice" aria-required="true"><legend class="itwd-fc-form__label">Kasari contact garne? *</legend>'
                 '<div class="itwd-choice__opts">'
                 '<input class="itwd-choice__input" type="radio" name="contact" id="fc-contact-wa" value="WhatsApp" required checked>'
                 '<label class="itwd-choice__opt" for="fc-contact-wa"><i class="fab fa-whatsapp"></i>WhatsApp</label>'
                 '<input class="itwd-choice__input" type="radio" name="contact" id="fc-contact-call" value="Phone call" required>'
                 '<label class="itwd-choice__opt" for="fc-contact-call"><i class="far fa-phone-alt"></i>Phone call</label>'
                 '</div></fieldset>')


def patch_consult_form(s):
    s = re.sub(r'<span class="itwd-fc-form__label">Kasari contact garne\? \*</span>\s*<div class="itwd-fc-radio">.*?</div>',
               lambda m: CONTACT_FIELD, s, count=1, flags=re.S)
    return fix_placeholders(s)


def fix_placeholders(s):
    """"Chhannuhos" is a disabled placeholder, never a real choice."""
    return s.replace('<option value="">Chhannuhos</option>', '<option value="" disabled selected>Chhannuhos</option>')


# --------------------------------------------------------------------------- page weight + third-party requests

def patch_performance(s):
    # WordPress emoji loader: fetched a script from the old demo server (wordpress.themehour.net) on every page
    s = re.sub(r'<script id="wp-emoji-settings" type="application/json">.*?</script>\s*<script type="module">\s*/\*! This file is auto-generated \*/.*?</script>\s*',
               '', s, flags=re.S)
    # WooCommerce "smart wishlist" (not used on this static site) POSTed to /escul/?wc-ajax=woosw_get_data -> 404 on every page
    s = re.sub(r'<script id="woosw-frontend-js" src="[^"]*"></script>\s*', '', s)
    # Elementor lazy-loads its "text-editor" handler chunks from the demo server; the widget is plain text here
    s = s.replace('data-widget_type="text-editor.default"', 'data-widget_type="itwd-static-text.default"')
    # 600-700 KB logo PNGs shown at ~120-190px -> resized WebP copies (originals stay in assets/itwd)
    s = s.replace('src="/assets/itwd/logo-horizontal.png"', 'src="/assets/itwd/logo-horizontal.webp" width="600" height="197"')
    s = s.replace('src="/assets/itwd/logo.png"', 'src="/assets/itwd/logo-mark.webp" width="360" height="324"')
    # 0.8-2.4 MB PNG photos -> WebP at ~2x their displayed size (11.7 MB of images on the home page before)
    for old, new in HEAVY_IMAGES:
        s = s.replace('src="%s"' % old, 'src="%s"' % new)
    return s


HEAVY_IMAGES = [
    ('/assets/itwd/hero-main.png', '/assets/itwd/hero-main.webp'),
    ('/assets/itwd/popular course 2.png', '/assets/itwd/popular-course-2.webp'),
    ('/assets/itwd/popular course1.png', '/assets/itwd/popular-course-1.webp'),
    ('/app section/hi.png', '/assets/itwd/app-section.webp'),
    ('/app%20section/hi.png', '/assets/itwd/app-section.webp'),
    ('/assets/itwd/group-image.png', '/assets/itwd/group-image.webp'),
    ('/assets/itwd/consult-thinking.png', '/assets/itwd/consult-thinking.webp'),
    ('/college/softwrica.png', '/assets/itwd/college-softwarica.webp'),
    ('/mentor/sachin%20kushwaha%20mentor%201.png', '/assets/itwd/mentor-sachin-kushwaha-mentor-1.webp'),
    ('/mentor/Anurag%20Thakur.jpg', '/assets/itwd/mentor-anurag-thakur.webp'),
    ('/assets/itwd/logo-trimmed.png', '/assets/itwd/logo-mark.webp'),
]


# --------------------------------------------------------------------------- links/buttons audit fixes (every page)

SOCIAL_NAMES = {'facebook.com': 'Facebook', 'instagram.com': 'Instagram', 'youtube.com': 'YouTube', 'github.com': 'GitHub',
                'linkedin.com': 'LinkedIn', 'twitter.com': 'Twitter'}


def patch_a11y(s):
    # logo links that still pointed to "#"
    s = re.sub(r'<a href="#">(\s*<img[^>]*alt="IT Wala Dai")', r'<a href="/">\1', s)
    # footer "Terms / Privacy / Cookies" pointed to "#" and no such pages exist -> removed instead of dead links
    s = re.sub(r'<div class="footer-links"><ul><li><a href="#">Terms of service</a></li><li><a href="#">Privacy policy</a></li>'
               r'<li><a href="#">Cookies</a></li></ul></div>', '', s)
    # icon-only controls get accessible names
    s = s.replace('<button type="button" class="th-menu-toggle d-block d-lg-none">',
                  '<button type="button" class="th-menu-toggle d-block d-lg-none" aria-label="Menu kholnuhos">')
    s = s.replace('<button class="th-menu-toggle">', '<button type="button" class="th-menu-toggle" aria-label="Menu band garnuhos">')
    s = s.replace('<button type="button" class="icon-btn style-border sideMenuInfo">',
                  '<button type="button" class="icon-btn style-border sideMenuInfo" aria-label="Info panel">')
    s = re.sub(r'<button (data-slider-prev="[^"]*" class="[^"]*slider-prev")>', r'<button type="button" \1 aria-label="Pahilako">', s)
    s = re.sub(r'<button (data-slider-next="[^"]*" class="[^"]*slider-next")>', r'<button type="button" \1 aria-label="Arko">', s)

    def social(m):
        tag = m.group(0)
        if 'aria-label' in tag:
            return tag
        name = next((v for k, v in SOCIAL_NAMES.items() if k in m.group(1)), None)
        return tag[:-1] + ' aria-label="IT Wala Dai on %s">' % name if name else tag
    s = re.sub(r'<a href="(https://(?:www\.)?(?:facebook|instagram|youtube|github|linkedin|twitter)\.com/@?itwaladai[^"]*)"[^>]*>', social, s)

    # card arrow links: name them after the card title
    def card_arrow(m):
        card = m.group(0)
        title = re.search(r'<h3 class="box-title"><a[^>]*>(.*?)</a>', card, re.S)
        if not title:
            return card
        label = re.sub(r'<[^>]+>', ' ', title.group(1))
        label = ' '.join(re.sub(r'<span class="itwd-cat-count">.*', '', title.group(1)).replace('<br>', ' ').split())
        label = re.sub(r'<[^>]+>', '', label)
        return re.sub(r'<a class="icon-btn (style8|style-border2)"(?! aria-label)', r'<a class="icon-btn \1" aria-label="%s"' % label, card, count=1)
    s = re.sub(r'<div class="category-card[23]?".*?</a></div>', card_arrow, s, flags=re.S)
    return s
