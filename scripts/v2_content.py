"""
IT Wala Dai v2 content: mission sections, free IT consultation page, shared WhatsApp CTA,
testimonials data, community page. All public copy is Roman Nepali.

Used by scripts/patch_site.py — edit the data here, then run:  python scripts/patch_site.py
"""
import re
from html import escape
from urllib.parse import quote

import build_site as B

# --------------------------------------------------------------------------- one place for links

WA_NUMBER = '9779823415625'
CONSULT_URL = '/free-it-consultation'
COLLEGES_URL = '/free-it-consultation#colleges'
LEARN_URL = '/plus-two'


def wa_link(msg):
    return 'https://wa.me/%s?text=%s' % (WA_NUMBER, quote(msg))


# Shared consultation CTA (bottom of every page, inside the footer's subscribe box)
CTA = dict(
    heading='Dai sanga direct kura garnuhos',
    text=('IT course, college selection, coding, project wa IT career ko barema confusion chha? '
          'IT Wala Dai sanga WhatsApp ma sodhnuhos. Hami hajurlai free guidance dina prayas garchhau.'),
    small='WhatsApp ma',
    big='Dai sanga kura garnuhos',
    msg='Namaste Dai! Malai IT course, college, project wa IT career ko barema help chahiyo.',
)

ARROW = B.ARROW_SVG


def block(s, start):
    return B.block(s, start)


# --------------------------------------------------------------------------- shared footer CTA + app buttons

def footer_cta_container():
    return (
        '<div class="container"><div class="row justify-content-between align-items-center">'
        '<div class="col-xxl-5 col-xl-6"><h4 class="subscribe-box_title th_fade_anim th-text-perspective">%s</h4>'
        '<p class="subscribe-box_text text-white th_fade_anim">%s</p></div>'
        '<div class="col-xl-6"><div class="itwd-whatsapp-wrap th_fade_anim" data-delay=".3">'
        '<a class="itwd-whatsapp-cta" href="%s" target="_blank" rel="noopener" aria-label="%s %s">'
        '<i class="fab fa-whatsapp"></i><span><small>%s</small>%s</span><i class="far fa-arrow-right"></i></a>'
        '</div></div></div></div>'
        % (CTA['heading'], CTA['text'], wa_link(CTA['msg']), CTA['small'], CTA['big'], CTA['small'], CTA['big']))


def patch_footer_cta(s):
    """Replace the newsletter box (or an older WhatsApp box) with the one shared consultation CTA."""
    st = s.index('<div class="subscribe-box bg-theme" id="contact-sec">')
    box_end = block(s, st)
    c = s.index('<div class="container">', st)
    if c > box_end:
        return s
    ce = block(s, c)
    return s[:c] + footer_cta_container() + s[ce:]


APP_BUTTONS_FOOTER = (
    '<h4 class="box-title">IT Wala Dai App download garnuhos</h4><div class="btn-wrap mt-20">'
    '<a href="#" data-app-link="windows" class="th-btn style2 btn-sm"><i class="fab fa-windows"></i>'
    '<span class="details"><span class="small-text">Download for</span><span class="big-text">Windows</span></span></a>'
    '<a href="#" data-app-link="android" class="th-btn style8 btn-sm text-white "><i class="fas fa-play"></i>'
    '<span class="details"><span class="small-text">Get it on</span><span class="big-text">Google Play</span></span></a></div>')


def patch_app_buttons(s):
    """The app has launched: no more 'coming soon' — buttons get their link from APP_LINKS in itwd.js."""
    s = re.sub(r'<h4 class="box-title">[^<]*</h4><div class="btn-wrap mt-20">(?:.*?</a>){2}</div>',
               lambda m: APP_BUTTONS_FOOTER, s, count=1, flags=re.S)
    s = s.replace('<a href="#" onclick="return false" aria-label="Google Play coming soon">',
                  '<a href="#" data-app-link="android" aria-label="Get IT Wala Dai on Google Play">')
    s = s.replace('<a href="#" onclick="return false" class="is-light" aria-label="Windows app coming soon">',
                  '<a href="#" data-app-link="windows" class="is-light" aria-label="Download IT Wala Dai for Windows">')
    s = re.sub(r'<a href="#" onclick="return false" class="category-btn th-btn style2"><i class="fab fa-google-play me-2"></i>[^<]*</a>',
               '<a href="#" data-app-link="android" class="category-btn th-btn style2"><i class="fab fa-google-play me-2"></i>Google Play ma download</a>', s)
    s = re.sub(r'<a href="#" onclick="return false" class="category-btn th-btn"><i class="fab fa-windows me-2"></i>[^<]*</a>',
               '<a href="#" data-app-link="windows" class="category-btn th-btn"><i class="fab fa-windows me-2"></i>Windows ma download</a>', s)
    s = re.sub(r'<div class="col-12 text-center th_fade_anim"><p class="itwd-note">App launching soon[^<]*</p></div>', '', s)
    return s


# --------------------------------------------------------------------------- home: free consultation promo card

PROMO_IMG = '/assets/itwd/consult-thinking.png'


def consult_promo():
    return '''<!-- itwd:consult-promo:start -->
<section class="itwd-promo" aria-labelledby="itwd-promo-title">
  <span class="itwd-promo__blob itwd-promo__blob--a" aria-hidden="true"></span>
  <span class="itwd-promo__blob itwd-promo__blob--b" aria-hidden="true"></span>
  <div class="container">
    <div class="itwd-promo__grid">
      <div class="itwd-promo__content">
        <span class="itwd-promo__label th_fade_anim"><i class="fal fa-compass"></i>Free IT Guidance for Nepal Students</span>
        <h2 class="itwd-promo__title th_fade_anim" id="itwd-promo-title">+2 pachhi kun <span class="itwd-hl">IT college</span> ra course rojne?</h2>
        <p class="itwd-promo__text th_fade_anim">TU, PU wa foreign-affiliated college? BSc CSIT, BIT, BCA wa aru IT course? Options dherai huda confusion hunu swabhavik ho. IT Wala Dai le hajurlai courses bujhna, colleges explore garna, ra aafno interest anusar options compare garna free guidance dinchha.</p>
        <ul class="itwd-promo__chips th_fade_anim"><li>TU</li><li>PU</li><li>KU</li><li>Foreign-affiliated</li><li>BSc CSIT</li><li>BIT</li><li>BCA</li></ul>
        <div class="itwd-btn-pair th_fade_anim">
          <a href="%(consult)s" class="th-btn">Free IT Consultation Book Garnuhos%(arrow)s</a>
          <a href="%(colleges)s" class="th-btn style-border2">IT Colleges Explore Garnuhos</a>
        </div>
        <ul class="itwd-promo__facts th_fade_anim">
          <li><strong>100%%</strong><span>Free guidance</span></li>
          <li><strong>5+</strong><span>IT courses explain</span></li>
          <li><strong>+2 &amp; Bachelor</strong><span>students ka lagi</span></li>
        </ul>
      </div>
      <div class="itwd-promo__visual th_fade_anim">
        <span class="itwd-promo__ring" aria-hidden="true"></span>
        <img src="%(img)s" alt="+2 sakepachhi kun IT college ramro hola bhanera sochdai gareki student" decoding="async" width="543" height="900">
        <span class="itwd-promo__badge itwd-promo__badge--a"><i class="fas fa-check-circle"></i>Free consultation</span>
        <span class="itwd-promo__badge itwd-promo__badge--b"><i class="fas fa-graduation-cap"></i>TU · PU · KU</span>
      </div>
    </div>
  </div>
</section>
<!-- itwd:consult-promo:end -->''' % dict(consult=CONSULT_URL, colleges=COLLEGES_URL, arrow=ARROW, img=PROMO_IMG)


def patch_home_promo(s):
    if '<!-- itwd:consult-promo:start -->' in s:
        st = s.index('<!-- itwd:consult-promo:start -->')
        en = s.index('<!-- itwd:consult-promo:end -->') + len('<!-- itwd:consult-promo:end -->')
        return s[:st] + consult_promo() + s[en:]
    st = s.index('<section class="itwd-marquee-section"')
    en = s.index('</section>', st) + len('</section>')
    return s[:en] + '\n' + consult_promo() + '\n' + s[en:]


# --------------------------------------------------------------------------- home: "All Things in One Place" (one brand colour, no coming-soon)

ALL_THINGS_LINKS = {'AI Project': '/programs', 'Free +2': LEARN_URL, 'Student': '/community',
                    'College': COLLEGES_URL, 'Monthly': '/#more-for-plus-two'}


def patch_all_things(s):
    st = s.index('<div class="elementor-element elementor-element-faea3de')
    en = block(s, st)
    sec = s[st:en]
    sec = sec.replace('category-card3 is-coming-soon"', 'category-card3"')
    sec = re.sub(r'data-theme-color="[^"]*" data-border="[^"]*"', 'data-theme-color="#1CB098" data-border="#3cc7af"', sec)

    def relink(m):
        card = m.group(0)
        for key, url in ALL_THINGS_LINKS.items():
            if re.search(r'>\s*%s\s*<br>' % re.escape(key), card):
                card = re.sub(r'href="[^"]*"', 'href="%s"' % url, card)
        return card
    sec = re.sub(r'<div class="category-card3".*?</a></div>', relink, sec, flags=re.S)
    return s[:st] + sec + s[en:]


# --------------------------------------------------------------------------- home + programs: mission CTA (replaces the deadline / seats promo)

MISSION = dict(
    label='IT Wala Dai ko mission',
    heading='+2 pachhi IT padhna kun course ra kun college rojne? Aba confuse nahunuhos.',
    text=('IT Wala Dai le +2 ra bachelor ka students lai free coding classes, computer learning resources, ra IT course '
          'ra college chhanna free guidance dinchha. Aafno interest bujhnuhos, options compare garnuhos, ra aafno IT '
          'journey confidence ka saath suru garnuhos.'),
)


def patch_mission_cta(s):
    m = re.search(r'<div class="elementor-element elementor-element-c81e9b2 ', s)
    if not m:
        return s
    st = m.start()
    en = block(s, st)
    sec = s[st:en]
    a = sec.index('<div class="title-area text-xl-start text-center mb-0">')
    b = block(sec, a)
    new_title = (
        '<div class="title-area text-xl-start text-center mb-0">'
        '<span class="sub-title text-theme th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">%s</span>'
        '<h2 class="sec-title text-white th-text-perspective">%s</h2>'
        '<div class="btn-wrap th_fade_anim mt-30"><p class="text-white mb-0 itwd-cta-text">%s</p></div>'
        '<div class="btn-wrap mt-40 th_fade_anim justify-content-xl-start justify-content-center itwd-mission-btns itwd-btn-pair">'
        '<a href="%s" class="th-btn style2">Free IT Consultation Book Garnuhos%s</a>'
        '<a href="%s" class="th-btn style-border3">IT Colleges Explore Garnuhos</a></div></div>'
        % (MISSION['label'], MISSION['heading'], MISSION['text'], CONSULT_URL, ARROW, COLLEGES_URL))
    sec = sec[:a] + new_title + sec[b:]
    sec = sec.replace('alt="cta-img"', 'alt="IT Wala Dai students"')
    return s[:st] + sec + s[en:]


# --------------------------------------------------------------------------- home: discount block -> free learning block

def patch_free_learning(s):
    st = s.find('<section class="itwd-discount-cta">')
    if st == -1:
        return s
    en = block(s, st)
    sec = s[st:en]
    a = sec.index('<div class="cta-card">')
    b = block(sec, a)
    card = (
        '<div class="cta-card">'
        '<div class="title-area mb-20"><h2 class="sec-title text-white th_fade_anim"><span class="th-text-perspective">'
        'Free ma Coding Siknuhos, Aafno IT Future ko Lagi Tayari Garnuhos</span></h2></div>'
        '<p class="box-text th_fade_anim">+2 wa bachelor ma padhdai hunuhunchha? IT Wala Dai bata programming ra computer-related '
        'learning resources explore garnuhos. Project ideas khojnuhos, IT courses ra colleges bujhnuhos, ra aafno next step '
        'ko lagi free guidance linuhos.</p>'
        '<div class="btn-wrap mt-50 justify-content-center th_fade_anim itwd-btn-pair">'
        '<a href="%s" class="th-btn style2">Free ma Sikna Suru Garnuhos <i class="far fa-arrow-right ms-2"></i></a>'
        '<a href="%s" class="th-btn style-border3">Free IT Guidance Linuhos <i class="far fa-arrow-right ms-2"></i></a>'
        '</div></div>' % (LEARN_URL, CONSULT_URL))
    sec = sec[:a] + card + sec[b:]
    sec = sec.replace('class="itwd-discount-cta"', 'class="itwd-discount-cta itwd-free-learning"')
    sec = sec.replace('alt="Students and mentors"', 'alt="IT Wala Dai ma free ma siknuhos"')
    return s[:st] + sec + s[en:]


# --------------------------------------------------------------------------- home: FAQ

HOME_FAQ = [
    ('IT Wala Dai ke ho?',
     'IT Wala Dai Nepal ka +2 ra bachelor students lai coding sikna, project ideas explore garna, ra IT course ra college '
     'chhanna help garne educational platform ho.'),
    ('IT Wala Dai bata free ma coding sikna milchha?',
     'IT Wala Dai le free coding education ra computer-related learning resources ma focus garchha. Available courses ra '
     'resources website ma explore garnuhos.'),
    ('+2 pachhi IT padhna kun course rojne?',
     'Yo hajurko interest, eligibility, academic background, budget, ra future goals ma bhar parchha. BSc CSIT, BIT, BCA, '
     'BIM wa aru relevant programs ko requirements bujhera compare garnuhos.'),
    ('IT college chhanna IT Wala Dai le help garchha?',
     'Ho, IT Wala Dai ko goal hajurlai available IT courses ra colleges bujhna, information compare garna, ra informed '
     'decision lina free guidance dinu ho.'),
    ('Programming suru garna pahile coding aaunu parchha?',
     'Pardaina. Beginner-friendly resources bata basics sikdai practice garna suru garna saknuhunchha.'),
    ('Project idea ra viva preparation ma help painchha?',
     'Website ma available project categories, project ideas, ra project workflow explore garnuhos. Available resources '
     'anusar project develop garna ra presentation ko tayari garna madat milna sakchha.'),
    ('College ra course compare kasari garne?',
     'Available college ra course details herera university affiliation, eligibility, curriculum, fees, location, ra '
     'admission requirements jasta factors compare garnuhos. Official college sources bata important details verify garnuhos.'),
    ('IT Wala Dai sanga direct contact kasari garne?',
     'WhatsApp consultation button use garera wa website ko Contact page bata available contact options follow garera '
     'kura garnuhos.'),
]


def faq_accordion(items, acc_id='faqAccordion1', prefix='itwd-faq'):
    out = []
    for i, (q, a) in enumerate(items):
        n = i + 1
        first = i == 0
        out.append(
            '<div class="accordion-card %(active)s"><div class="accordion-header" id="collapse-item-%(p)s-%(n)d">'
            '<button class="accordion-button %(col)s" type="button" data-bs-toggle="collapse" data-bs-target="#collapse-%(p)s-%(n)d" '
            'aria-expanded="%(exp)s" aria-controls="collapse-%(p)s-%(n)d">%(q)s</button></div>'
            '<div id="collapse-%(p)s-%(n)d" class="accordion-collapse collapse %(show)s" aria-labelledby="collapse-item-%(p)s-%(n)d" '
            'data-bs-parent="#%(acc)s"><div class="accordion-body"><p class="faq-text">%(a)s</p></div></div></div>'
            % dict(active='active' if first else '', p=prefix, n=n, col='' if first else 'collapsed',
                   exp='true' if first else 'false', show='show' if first else '', q=q, a=a, acc=acc_id))
    return '<div class="accordion" id="%s">%s</div>' % (acc_id, ''.join(out))


def patch_home_faq(s):
    st = s.index('<div class="accordion" id="faqAccordion1">')
    en = block(s, st)
    s = s[:st] + faq_accordion(HOME_FAQ) + s[en:]
    s = s.replace('Have questions? Here are answers.</span></h2>', 'Prashna chha? Yaha uttar chha.</span></h2>', 1)
    s = re.sub(r'<p class="th_fade_anim">If you want to ask something else, just <a href="/contact" class="text-theme">message us</a> — reply within 24 hours\.</p>',
               '<p class="th_fade_anim">Aru kehi sodhnu chha bhane <a href="/contact" class="text-theme">message garnuhos</a> — 24 ghanta bhitra reply garchhau.</p>', s)
    return s


# --------------------------------------------------------------------------- testimonials (one data source for home preview + page)

# status: 'published' = real feedback supplied by IT Wala Dai; 'sample' = layout sample, shown with a "Sample" tag
#   until real feedback replaces it. image: optional path (e.g. '/testimonials-img/aakash.jpg'); initials are used when empty.
TESTIMONIALS = [
    dict(name='Bibek K.', image='', context='BSc CSIT · TU', category='project', status='published',
         text='Mero AI attendance project aba college mai use bhairaheko chha. External le ‘production-ready’ bhannu bhayo!'),
    dict(name='Kritika B.', image='', context='BCA · Pokhara Univ.', category='project', status='published',
         text='Documentation ra viva prep sabai bhanda helpful thiyo. Pahilo choti viva ma confident bhaye.'),
    dict(name='Rohan M.', image='', context='BIT · Purbanchal', category='project', status='published',
         text='Mentor review le mero naramro coding habits samatyo. Yahi project le malai internship dilayo.'),
    dict(name='Aakash', image='', context='+2 Student', category='college', status='sample',
         text='+2 sakepachhi CSIT ki BIT bhanne confusion thiyo. Dai sanga kura garepachhi dubai course ko farak clear bhayo.'),
    dict(name='Anil', image='', context='+2 Student', category='coding', status='sample',
         text='C programming pahile garo lagthyo. Simple examples ra practice le loops ra functions bujhna sajilo bhayo.'),
    dict(name='Irfan', image='', context='Bachelor Student', category='project', status='sample',
         text='Final year project ko scope fix garna help paye. Weekly review le kaam samaya mai sakiyo.'),
    dict(name='Kashish', image='', context='+2 Student', category='college', status='sample',
         text='College compare garda ke-ke hernu parchha bhanne kura pahilo choti bujhe — affiliation, curriculum, location sabai.'),
    dict(name='Saurav', image='', context='Bachelor Student', category='coding', status='sample',
         text='Python ko basics bata suru gare. Aba sano project aafai banauna sakchhu.'),
    dict(name='Manish', image='', context='+2 Student', category='coding', status='sample',
         text='Free classes ra notes le +2 ko computer science ko tayari ma dherai madat garyo.'),
    dict(name='Sushma', image='', context='Bachelor Student', category='project', status='sample',
         text='Viva ko lagi mock questions practice garda confidence dherai badhyo.'),
    dict(name='Prakriti', image='', context='+2 Student', category='college', status='sample',
         text='TU ra foreign-affiliated college ko barema clear information paye. Decision lina sajilo bhayo.'),
    dict(name='Nabin', image='', context='Bachelor Student', category='coding', status='sample',
         text='GitHub ma project rakhna ra deploy garna sikiye. Portfolio banauna yo dherai kaam lagyo.'),
]
T_CATEGORY = {'coding': 'Coding', 'college': 'College Guidance', 'project': 'Project Guidance'}


def initials(name):
    return ''.join(w[0] for w in name.replace('.', ' ').split()[:2]).upper()


def t_avatar(t, cls='itwd-tc__avatar'):
    if t['image']:
        return '<span class="%s"><img src="%s" alt="%s" loading="lazy"></span>' % (cls, t['image'], t['name'])
    return '<span class="%s" aria-hidden="true">%s</span>' % (cls, initials(t['name']))


def testimonial_card(t, i):
    sample = t['status'] != 'published'
    return (
        '<article class="itwd-tc%s" data-cat="%s" style="--i:%d">'
        '<div class="itwd-tc__top"><span class="itwd-tc__cat">%s</span>%s</div>'
        '<p class="itwd-tc__quote">%s</p>'
        '<div class="itwd-tc__who">%s<div><h4>%s</h4><p>%s</p></div></div>'
        '</article>'
        % (' is-sample' if sample else '', t['category'], i % 6, T_CATEGORY[t['category']],
           '<span class="itwd-tc__sample" title="Sample — real feedback aaepachhi replace hunchha">Sample</span>' if sample else
           '<i class="fas fa-quote-right" aria-hidden="true"></i>',
           t['text'], t_avatar(t), t['name'], t['context']))


def testimonials_content():
    chips = ''.join('<button type="button" class="itwd-tfilter%s" data-tfilter="%s">%s</button>'
                    % (' is-active' if k == 'all' else '', k, v)
                    for k, v in [('all', 'Sabai')] + list(T_CATEGORY.items()))
    cards = ''.join(testimonial_card(t, i) for i, t in enumerate(TESTIMONIALS))
    return '''
<section class="itwd-testi2 space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Testimonials</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Students ka anubhav, unkai shabdama</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Coding, project ra college guidance — IT Wala Dai sanga sikeka students ko kura.</p>
    </div>
    <div class="itwd-tfilters th_fade_anim" role="group" aria-label="Testimonials filter">%s</div>
    <div class="itwd-tgrid">%s</div>
    <div class="itwd-tshare th_fade_anim">
      <div><strong>IT Wala Dai sanga siknu bhayo?</strong><span>Aafno anubhav share garnuhos — hajurko story yaha aauna sakchha.</span></div>
      <a href="%s" target="_blank" rel="noopener" class="th-btn">Aafno story pathaunuhos%s</a>
    </div>
  </div>
</section>
''' % (chips, cards, wa_link('Namaste Dai! Ma IT Wala Dai bare aafno anubhav (testimonial) share garna chahanchhu.'), ARROW)


def patch_home_testimonials(s):
    """Home preview slider: real (published) testimonials only, from the same TESTIMONIALS data."""
    st = s.find('<div class="swiper th-slider" id="testiSlide1"')
    if st == -1:
        return s
    w = s.index('<div class="swiper-wrapper">', st)
    we = block(s, w)
    slides = []
    for t in [x for x in TESTIMONIALS if x['status'] == 'published']:
        slides.append(
            '<div class="swiper-slide"><div class="testi-card"><div class="testi-meta-wrap"><div class="quote-icon">'
            '<img decoding="async" src="/wp-content/uploads/2026/02/quote.svg" alt="" /></div><div class="testi-review-wrap">'
            '<span class="itwd-tc__cat">%s</span></div></div><p class="box-text text">“%s”</p>'
            '<div class="testi-card-profile"><div class="box-thumb">%s</div><div class="media-left">'
            '<h3 class="testi-card_name name">%s</h3><span class="testi-card_desig desig">%s</span></div></div></div></div>'
            % (T_CATEGORY[t['category']], t['text'], t_avatar(t, 'itwd-tavatar'), t['name'], t['context']))
    s = s[:w] + '<div class="swiper-wrapper">' + ''.join(slides) + '</div>' + s[we:]
    s = s.replace('/>TESTIMONIALS</span><h2 class="sec-title th_fade_anim "><span class="th-text-perspective">People Who Already Love Us</span>',
                  '/>TESTIMONIALS</span><h2 class="sec-title th_fade_anim "><span class="th-text-perspective">Students ka anubhav</span>')
    return s


# --------------------------------------------------------------------------- community page (no countdown)

def community_content():
    feats = [
        ('fal fa-comments', 'Discussion', 'CSIT, BIT, BCA — har topic ma seniors ra saathiharu sanga kura.'),
        ('fal fa-circle-question', 'Q&amp;A', 'Doubt sodhnuhos, uttar paunuhos — kunai prashna sano hudaina.'),
        ('fal fa-diagram-project', 'Project Feedback', 'Aafno project dekhaunuhos, feedback linuhos, team khojnuhos.'),
        ('fal fa-users', 'Study Groups', '+2 ra bachelor students ka lagi batch-wise groups.'),
    ]
    cards = ''.join(
        '<div class="col-xl-3 col-md-6"><div class="itwd-cs-card th_fade_anim"><div class="itwd-cs-card__icon"><i class="%s"></i></div>'
        '<h3 class="itwd-cs-card__title">%s</h3><p class="itwd-cs-card__text">%s</p></div></div>' % f for f in feats)
    return '''
<section class="itwd-community space" id="community">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">IT Wala Dai Community</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Sanga siknuhos, sanga badhnuhos</span></h2>
      <p class="th_fade_anim itwd-sub-lead">+2 ra bachelor ka IT students ko community — prashna sodhnuhos, project share garnuhos, ra seniors bata siknuhos.</p>
    </div>
    <div class="row gy-4">%s</div>
    <div class="itwd-community__cta itwd-btn-pair th_fade_anim">
      <a href="#" data-app-link="android" class="th-btn"><i class="fab fa-google-play me-2"></i>IT Wala Dai App download garnuhos</a>
      <a href="%s" target="_blank" rel="noopener" class="th-btn style-border2"><i class="fab fa-whatsapp me-2"></i>WhatsApp ma jodinuhos</a>
    </div>
  </div>
</section>
''' % (cards, wa_link('Namaste Dai! Ma IT Wala Dai community ma jodina chahanchhu.'))


# --------------------------------------------------------------------------- free IT consultation page

COLLEGES = [  # names + logos only (supplied in /college); details must be checked with official sources
    ('Capital College and Research Center (CCRC)', '/college/ccrc.png'),
    ('Mid-Valley International College', '/college/images.png'),
    ('Kathmandu Model College', '/college/kmc.png'),
    ('Softwarica College of IT & E-Commerce', '/college/softwrica.png'),
    ('Sunway College Kathmandu', '/college/sunway.png'),
    ('Urbana School of Science', '/college/urbana%20school%20ofscience.png'),
    ('Himalayan White House International College', '/college/white%20house.png'),
]

IT_COURSES = [  # widely known Nepal IT bachelor programs; all are 4-year (8-semester) programs
    ('BSc CSIT', 'Computer Science &amp; IT', 'TU', 'Programming, algorithms, AI, networking — science-heavy computing.'),
    ('BIT', 'Bachelor of Information Technology', 'TU, Purbanchal', 'Software, web, networking ra IT systems ma focus.'),
    ('BCA', 'Bachelor of Computer Application', 'TU, Purbanchal', 'Programming ra computer applications — practical development.'),
    ('BIM', 'Bachelor of Information Management', 'TU', 'IT ra management dubai — business sanga technology.'),
    ('BE Computer', 'Computer Engineering', 'TU (IOE), KU, PU, Purbanchal', 'Hardware ra software dubai — engineering approach.'),
]

CONSULT_FAQ = [
    ('IT Wala Dai ko consultation free ho?',
     'Ho, IT Wala Dai ko IT course ra college guidance free ho. Kunai consultation fee lagdaina.'),
    ('+2 pachhi kun IT course explore garna milchha?',
     'BSc CSIT, BIT, BCA, BIM, BE Computer jasta programs explore garna milchha. Kun course mildo chha bhanne kura hajurko '
     'interest, +2 ko stream ra eligibility ma bhar parchha.'),
    ('College compare garda ke-ke hernu parchha?',
     'University affiliation, curriculum, faculty, lab ra practical facilities, location, fee structure ra admission '
     'requirements herna sakinchha. Important details sadhai official college source bata verify garnuhos.'),
    ('Foreign-affiliated college chhanna ke bujhnu parchha?',
     'Kun foreign university sanga affiliation chha, degree ko recognition, total cost, ra Nepal ma tyo degree ko '
     'equivalence jasta kura bujhnu parchha. Official sources bata confirm garnuhos.'),
    ('Coding suru garna pahile experience chahinchha?',
     'Chahidaina. Beginner-friendly free courses bata basics sikna suru garna saknuhunchha.'),
    ('Consultation ko lagi kasari contact garne?',
     'Yo page ko form bharnuhos wa WhatsApp button thichnuhos. Hajurko message WhatsApp ma IT Wala Dai lai pugchha.'),
]


def consult_content():
    helps = [
        ('fal fa-graduation-cap', 'IT Course Guidance',
         'BSc CSIT, BIT, BCA, BIM wa aru IT-related programs ko barema bujhna ra aafno interest anusar options explore garna help.'),
        ('fal fa-university', 'College Exploration',
         'Available colleges, university affiliations, admission requirements, course structures, ra location ko barema information compare garna help.'),
        ('fal fa-laptop-code', 'Free Learning ra Coding',
         'Programming suru garna, computer fundamentals bujhna, ra beginner-friendly learning resources khojna help.'),
        ('fal fa-diagram-project', 'Project Guidance',
         'Project ideas discover garna, project ko steps bujhna, ra presentation wa viva ko tayari garna help.'),
    ]
    help_html = ''.join(
        '<div class="col-xl-3 col-md-6"><div class="itwd-fc-help th_fade_anim" data-delay="0.%d"><span class="itwd-fc-help__icon"><i class="%s"></i></span>'
        '<h3>%s</h3><p>%s</p></div></div>' % (1 + i, ic, t, d) for i, (ic, t, d) in enumerate(helps))
    steps = [
        ('Aafno interest share garnuhos', 'Kun IT field wa subject ma interest chha, Dai lai bataunuhos.'),
        ('Aafno options bujhna thalnuhos', 'Relevant courses ra colleges explore garnuhos.'),
        ('Options compare garnuhos', 'Available information, admission requirements ra aru factors herera compare garnuhos.'),
        ('Informed decision linuhos', 'Interest, eligibility, budget ra goals anusar aafno next step chhannuhos.'),
    ]
    step_html = ''.join(
        '<div class="col-lg-3 col-md-6"><div class="itwd-fc-step th_fade_anim" data-delay="0.%d"><span class="itwd-fc-step__num">%02d</span>'
        '<h3>%s</h3><p>%s</p></div></div>' % (1 + i, i + 1, t, d) for i, (t, d) in enumerate(steps))
    course_html = ''.join(
        '<div class="col-lg-4 col-md-6"><div class="itwd-fc-course th_fade_anim"><div class="itwd-fc-course__head"><strong>%s</strong><span>4 years</span></div>'
        '<p class="itwd-fc-course__full">%s</p><p class="itwd-fc-course__uni"><i class="fal fa-university"></i>%s</p>'
        '<p class="itwd-fc-course__focus">%s</p></div></div>' % c for c in IT_COURSES)
    college_html = ''.join(
        '<div class="col-xl-3 col-lg-4 col-sm-6 itwd-fc-college-col" data-name="%(lname)s"><article class="itwd-fc-college">'
        '<div class="itwd-fc-college__logo"><img src="%(logo)s" alt="%(name)s logo" loading="lazy"></div>'
        '<h3>%(name)s</h3>'
        '<div class="itwd-fc-college__links">'
        '<a href="https://www.google.com/search?q=%(q)s" target="_blank" rel="noopener"><i class="far fa-arrow-up-right-from-square"></i>Official info</a>'
        '<a href="%(wa)s" target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i>Dai lai sodhnuhos</a></div>'
        '</article></div>'
        % dict(name=escape(n), lname=escape(n.lower()), logo=logo, q=quote(n + ' official website'),
               wa=wa_link('Namaste Dai! Malai %s ko IT courses ra admission ko barema jaankari chahiyo.' % n))
        for n, logo in COLLEGES)
    faq = ''.join(
        '<div class="itwd-acc%s"><button type="button" class="itwd-acc__head" aria-expanded="%s">'
        '<span class="itwd-acc__q">Q%d.</span><span class="itwd-acc__title">%s</span><i class="far fa-chevron-down itwd-acc__chev"></i></button>'
        '<div class="itwd-acc__body"><div><p class="itwd-acc__answer">%s</p></div></div></div>'
        % (' is-open' if i == 0 else '', 'true' if i == 0 else 'false', i + 1, q, a) for i, (q, a) in enumerate(CONSULT_FAQ))
    course_opts = ''.join('<option>%s</option>' % c for c in ['BSc CSIT', 'BIT', 'BCA', 'BIM', 'BE Computer',
                                                                'Aru IT course', 'Ahile thaha chhaina'])
    return '''
<section class="itwd-fc-hero">
  <div class="container">
    <div class="row align-items-center gy-5">
      <div class="col-lg-7">
        <span class="itwd-fc-label th_fade_anim"><i class="fal fa-compass"></i>IT Wala Dai Free Guidance</span>
        <h1 class="itwd-fc-title th_fade_anim">Aafno lagi sahi IT course ra college chhanna hajurlai help chahinchha?</h1>
        <p class="itwd-fc-lead th_fade_anim">+2 pachhi IT padhne sochma hunuhunchha tara kun course wa college rojne bhanera confused hunuhunchha? IT Wala Dai ko free guidance le options bujhna ra informed decision lina madat garchha.</p>
        <div class="itwd-fc-btns itwd-btn-pair th_fade_anim">
          <a href="#courses" class="th-btn">Aafno Options Explore Garnuhos%(arrow)s</a>
          <a href="%(wa)s" target="_blank" rel="noopener" class="th-btn style-border2"><i class="fab fa-whatsapp me-2"></i>WhatsApp ma Sodhnuhos</a>
        </div>
        <ul class="itwd-fc-trust th_fade_anim"><li><i class="fas fa-check"></i>100%% free</li><li><i class="fas fa-check"></i>+2 ra bachelor students</li><li><i class="fas fa-check"></i>Nepal ka IT courses ra colleges</li></ul>
      </div>
      <div class="col-lg-5">
        <div class="itwd-fc-hero__visual th_fade_anim"><span class="itwd-promo__ring" aria-hidden="true"></span>
          <img src="%(img)s" alt="+2 pachhi kun IT college bhanera sochdai gareki student" width="543" height="900"></div>
      </div>
    </div>
  </div>
</section>

<section class="itwd-fc-sec space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Hami ke ma help garchhau</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Course dekhi college samma, euta thau ma guidance</span></h2>
    </div>
    <div class="row gy-4">%(helps)s</div>
  </div>
</section>

<section class="itwd-fc-sec itwd-fc-sec--tint space">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Consultation kasari hunchha</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">4 simple steps</span></h2>
    </div>
    <div class="row gy-4 itwd-fc-steps">%(steps)s</div>
  </div>
</section>

<section class="itwd-fc-sec space" id="courses">
  <div class="container">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">IT courses bujhnuhos</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Nepal ma padhaune popular IT courses</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Sabai 4 barsa (8 semester) ka bachelor programs hun. University, eligibility ra curriculum ko detail official source bata verify garnuhos.</p>
    </div>
    <div class="row gy-4">%(courses)s</div>
  </div>
</section>

<section class="itwd-fc-sec itwd-fc-sec--tint space" id="colleges">
  <div class="container">
    <div class="title-area text-center mb-30">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Explore colleges</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">IT colleges explore garnuhos</span></h2>
      <p class="th_fade_anim itwd-sub-lead">Yo list sampurna chhaina. Course, fee ra admission ko detail sadhai college ko official source bata verify garnuhos — aru college ko barema pani Dai lai sodhna saknuhunchha.</p>
    </div>
    <div class="itwd-fc-search th_fade_anim"><i class="far fa-magnifying-glass"></i>
      <input type="search" id="itwd-college-search" placeholder="College ko naam khojnuhos..." aria-label="College khojnuhos"></div>
    <div class="row gy-4" id="itwd-college-list">%(colleges)s</div>
    <p class="itwd-fc-empty" hidden>Yo naam ko college list ma bhetiyena. <a href="%(wa_college)s" target="_blank" rel="noopener">Dai lai sodhnuhos</a> — hami information khojna help garchhau.</p>
    <div class="text-center mt-40 th_fade_anim"><a href="#consult-form" class="th-btn">Sabai IT Colleges ko barema Sodhnuhos%(arrow)s</a></div>
  </div>
</section>

<section class="itwd-fc-sec space" id="consult-form">
  <div class="container">
    <div class="row gy-5 align-items-start">
      <div class="col-lg-5">
        <div class="title-area mb-30">
          <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">Free consultation request</span>
          <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Aafno prashna Dai lai pathaunuhos</span></h2>
          <p class="th_fade_anim">Form bharnuhos — submit garda WhatsApp khulchha ra hajurko details sahit message tayar hunchha. Pathauna WhatsApp ma <strong>Send</strong> thichnuhos.</p>
        </div>
        <ul class="itwd-fc-points th_fade_anim">
          <li><i class="fas fa-lock"></i>Hajurko details kahi pani public gardainau.</li>
          <li><i class="fas fa-clock"></i>Hami chhitto bhanda chhitto reply garchhau.</li>
          <li><i class="fas fa-hand-holding-heart"></i>Guidance free ho — admission wa job ko guarantee bhane hoina.</li>
        </ul>
      </div>
      <div class="col-lg-7">
        <form class="itwd-fc-form th_fade_anim" data-whatsapp="%(wa_number)s" novalidate>
          <div class="row g-3">
            <div class="col-md-6"><label for="fc-name">Naam *</label><input class="form-control" id="fc-name" name="name" type="text" autocomplete="name" required></div>
            <div class="col-md-6"><label for="fc-phone">Phone / WhatsApp number *</label><input class="form-control" id="fc-phone" name="phone" type="tel" autocomplete="tel" required></div>
            <div class="col-md-6"><label for="fc-level">Ahile ko padhai *</label>
              <select class="form-select" id="fc-level" name="level" required><option value="">Chhannuhos</option><option>+2 padhdai</option><option>+2 sakiyo</option><option>Bachelor padhdai</option><option>Aru</option></select></div>
            <div class="col-md-6"><label for="fc-course">Interest bhayeko course / IT field *</label>
              <select class="form-select" id="fc-course" name="course" required><option value="">Chhannuhos</option>%(course_opts)s</select></div>
            <div class="col-12"><label for="fc-colleges">Man pareko college wa university <span>(optional)</span></label><input class="form-control" id="fc-colleges" name="colleges" type="text" placeholder="Jastai: TU affiliated, Softwarica, Sunway..."></div>
            <div class="col-12"><label for="fc-question">Mukhya prashna wa confusion *</label><textarea class="form-control" id="fc-question" name="question" rows="4" required placeholder="Jastai: CSIT ra BIT ma kun mero lagi ramro hola?"></textarea></div>
            <div class="col-12"><span class="itwd-fc-form__label">Kasari contact garne? *</span>
              <div class="itwd-fc-radio"><label><input type="radio" name="contact" value="WhatsApp" checked> WhatsApp</label><label><input type="radio" name="contact" value="Phone call"> Phone call</label></div></div>
          </div>
          <p class="itwd-form-status" role="status" aria-live="polite"></p>
          <button type="submit" class="th-btn w-100"><i class="fab fa-whatsapp me-2"></i>WhatsApp ma Request Pathaunuhos</button>
        </form>
      </div>
    </div>
  </div>
</section>

<section class="itwd-fc-sec itwd-fc-sec--tint space">
  <div class="container itwd-fc-narrow">
    <div class="title-area text-center mb-40">
      <span class="sub-title th_fade_anim"><img decoding="async" src="/wp-content/uploads/2026/02/subtitle-icon1-4.svg" alt="">FAQ</span>
      <h2 class="sec-title th_fade_anim"><span class="th-text-perspective">Consultation ko barema prashna</span></h2>
    </div>
    <div class="itwd-acc-group">%(faq)s</div>
  </div>
</section>

<section class="itwd-fc-final space">
  <div class="container">
    <div class="itwd-fc-final__card th_fade_anim">
      <h2>Aafno IT journey ko next step aaja bata suru garnuhos.</h2>
      <p>Course, college, coding wa project ko barema confusion chha? IT Wala Dai sanga kura garnuhos.</p>
      <div class="itwd-fc-btns itwd-btn-pair justify-content-center">
        <a href="#consult-form" class="th-btn style2">Consultation Form Bharnuhos%(arrow)s</a>
        <a href="#colleges" class="th-btn style-border3">IT Colleges Explore Garnuhos</a>
      </div>
    </div>
  </div>
</section>
''' % dict(arrow=ARROW, wa=wa_link('Namaste Dai! Malai IT course ra college chhanna help chahiyo.'), img=PROMO_IMG,
           helps=help_html, steps=step_html, courses=course_html, colleges=college_html, faq=faq,
           wa_college=wa_link('Namaste Dai! Malai euta IT college ko barema jaankari chahiyo.'), wa_number=WA_NUMBER,
           course_opts=course_opts)


# --------------------------------------------------------------------------- "Powered by Pranam Software" side tab (every page)

PRANAM_TAB = (
    '<!-- itwd:pranam-tab:start -->'
    '<a class="itwd-pranam-tab" href="https://www.pranamsoftware.com.np/" target="_blank" rel="noopener" '
    'aria-label="Powered by Pranam Software — website kholnuhos">'
    '<span class="itwd-pranam-tab__icon" aria-hidden="true"><i class="fas fa-code"></i></span>'
    '<span class="itwd-pranam-tab__vertical" aria-hidden="true">Powered by <b>Pranam Software</b></span>'
    '<span class="itwd-pranam-tab__panel"><small>Powered by</small><strong>Pranam Software</strong>'
    '<em>Website, App &amp; Software Development</em></span>'
    '</a>'
    '<!-- itwd:pranam-tab:end -->')


def patch_pranam_tab(s):
    """Fixed side tab, placed right before </body> (outside the smooth-scroll wrapper so position:fixed works)."""
    if '<!-- itwd:pranam-tab:start -->' in s:
        st = s.index('<!-- itwd:pranam-tab:start -->')
        en = s.index('<!-- itwd:pranam-tab:end -->') + len('<!-- itwd:pranam-tab:end -->')
        return s[:st] + PRANAM_TAB + s[en:]
    i = s.rindex('</body>')
    return s[:i] + PRANAM_TAB + '\n' + s[i:]


# --------------------------------------------------------------------------- page hero images (breadcrumb banner)
# one illustration per page; pages not listed keep the theme image
PAGE_HERO = {
    '/plus-two': ('/assets/itwd/hero-plus-two.webp', 'Free C ra C++ +2 students ka lagi'),
    '/about': ('/assets/itwd/hero-about.webp', 'IT Wala Dai: learning, guidance, community ra success'),
    '/contact': ('/assets/itwd/hero-contact.webp', 'IT Wala Dai lai WhatsApp, email wa phone bata samparka garnuhos'),
    '/testimonials': ('/assets/itwd/hero-testimonials.webp', 'IT Wala Dai ka students ka anubhav'),
    '/community': ('/assets/itwd/hero-community.webp', 'IT Wala Dai community: sodhnuhos, share garnuhos, sangai siknuhos'),
}
HERO_THUMB_RE = re.compile(r'<div class="breadcumb-thumb[^"]*"><img [^>]*></div>')


def patch_page_hero(s, active):
    """Swap the breadcrumb illustration for the page's own image (idempotent)."""
    if active not in PAGE_HERO or not HERO_THUMB_RE.search(s):
        return s
    src, alt = PAGE_HERO[active]
    new = ('<div class="breadcumb-thumb itwd-hero-thumb"><img src="%s" alt="%s" width="900" '
           'fetchpriority="high" decoding="async"></div>' % (src, escape(alt)))
    return HERO_THUMB_RE.sub(lambda m: new, s, count=1)
