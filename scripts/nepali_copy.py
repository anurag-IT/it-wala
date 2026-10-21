"""
Roman Nepali copy for the hand-edited live pages (home, Find Project, About, Contact, shared header/footer).
Applied by scripts/patch_site.py to every page. Each pair is (old, new); pairs not present on a page are skipped,
so this is safe to run repeatedly.
"""

COPY = [
    # ---------------------------------------------------------------- shared header / side menu / footer
    ('IT Wala Dai — Nepal ka IT big brother. +2 aur Bachelor IT students ke liye free courses, project guidance, college info aur community.',
     'IT Wala Dai — Nepal ko IT dai. +2 ra Bachelor IT students ka lagi free courses, project guidance, college information ra community.'),
    ('class="th-btn btn-sm">Project shuru karo', 'class="th-btn btn-sm">Project suru garnuhos'),
    ('<h3 class="widget_title">Updates pao</h3>', '<h3 class="widget_title">Updates paunuhos</h3>'),
    ('AI se apna college project banao. Built in Nepal, for Nepali students.',
     'Free coding ra IT guidance — Built in Nepal, for Nepali students.'),
    ('Email (reply 24 ghante mein)', 'Email (24 ghanta bhitra reply)'),
    ('<a href="/community">Community (coming soon)</a>', '<a href="/community">Community</a>'),
    ('<a href="/contact" class="th-btn">FREE CONSULT', '<a href="/free-it-consultation" class="th-btn">FREE CONSULT'),
    # modal (Find Project + course pages)
    ('Details bharo &mdash; submit karte hi WhatsApp khulega aur message seedha IT Wala Dai ko jayega.',
     'Details bharnuhos &mdash; submit garne bittikai WhatsApp khulchha ra message sidhai IT Wala Dai lai pugchha.'),
    ('Details bharo — submit karte hi WhatsApp khulega aur message seedha IT Wala Dai ko jayega.',
     'Details bharnuhos — submit garne bittikai WhatsApp khulchha ra message sidhai IT Wala Dai lai pugchha.'),
    ('placeholder="Your Name *"', 'placeholder="Hajurko naam *"'),
    ('placeholder="Project ke baare mein batao &mdash; college, semester, deadline, apna idea..."',
     'placeholder="Project ko barema bataunuhos &mdash; college, semester, deadline, aafno idea..."'),
    ('placeholder="Project ke baare mein batao — college, semester, deadline, apna idea..."',
     'placeholder="Project ko barema bataunuhos — college, semester, deadline, aafno idea..."'),
    ('</i>WhatsApp pe bhejo</button>', '</i>WhatsApp ma pathaunuhos</button>'),

    # ---------------------------------------------------------------- home
    ('<title>IT Wala Dai &#8211; AI se apna college project banao</title>',
     '<title>IT Wala Dai &#8211; Free coding ra IT guidance, Nepal ka students ka lagi</title>'),
    ('Bachelor and +2 ke liye', 'Bachelor ra +2 ka lagi'),
    ('Real projects, mentor support aur viva prep — sirf 6 hafton mein.',
     'Real projects, mentor support ra viva prep — jamma 6 hapta ma.'),
    ('>Project shuru karo', '>Project suru garnuhos'),
    ('Kaise kaam karta hai?', 'Kasari kaam garchha?'),
    ('92% students ko A / A+ grade.', '92% students le A / A+ grade paaye.'),
    ('Complete, clean source code — tumhare GitHub pe.', 'Complete, clean source code — hajurkai GitHub ma.'),
    ('Real URL pe live project — external ko demo do.', 'Real URL ma live project — external lai demo dekhaunuhos.'),
    ('College format mein — proposal, mid-defense, final.', 'College format anusar — proposal, mid-defense, final.'),
    ('Presentation aur demo video, dono ready.', 'Presentation ra demo video, dubai ready.'),
    ('30 common questions ki practice mentor ke saath.', 'Mentor sanga 30 common questions ko practice.'),
    ('Concept tumhara — har feature tum samjhoge.', 'Concept hajurkai — har feature hajurle bujhnuhunchha.'),
    ('PROJECT DEKHO', 'PROJECT HERNUHOS'),
    ('+2 Students ke liye</span>', '+2 Students ka lagi</span>'),
    ('School ke baad kya karein, kaunsa college, kaunsa course — confused ho? Dai hai na. Free coding, monthly hackathon aur sahi college choose karne mein help.',
     'School pachhi ke garne, kun college, kun course — confuse hunuhunchha? Dai chha ni. Free coding, monthly hackathon ra sahi college chhanna help.'),
    ('College finder — CSIT, BIT, BCA — sahi choice</li>', 'College finder — CSIT, BIT, BCA — sahi choice garnuhos</li>'),
    ('IT Wala Dai App — Android &amp; Windows, coming soon', 'IT Wala Dai App — Android ra Windows ma available'),
    ('IT Wala Dai App — Android & Windows, coming soon', 'IT Wala Dai App — Android ra Windows ma available'),

    # ---------------------------------------------------------------- Find Project
    ('Idea choose <br> karo', 'Idea <br> chhannuhos'),
    ('100+ vetted real-life ideas, ya apna idea lao. Mentor scope fix karta hai.',
     '100+ vetted real-life ideas, wa aafnai idea lyaunuhos. Mentor le scope fix garchha.'),
    ('AI ke saath <br> build', 'AI sanga <br> build'),
    ('Claude, Copilot, Cursor — sahi tarike se. AI code likhta hai, concept tum samajhte ho.',
     'Claude, Copilot, Cursor — sahi tarika le. AI le code lekhchha, concept hajurle bujhnuhunchha.'),
    ('Industry engineer har hafte code, security aur architecture check karta hai.',
     'Industry engineer le har hapta code, security ra architecture check garchha.'),
    ('Live URL, report, slides aur mock viva. External bole — ‘ye toh real hai!’',
     'Live URL, report, slides ra mock viva. External le bhanchhan — ‘yo ta real ho!’'),
    ('data-itwd-filter="all">Sab projects dekho', 'data-itwd-filter="all">Sabai projects hernuhos'),
    ('Real-life projects, mentor ke saath', 'Real-life projects, mentor sanga'),
    ('Industry engineers jo tumhara code review karenge', 'Hajurko code review garne industry engineers'),

    # ---------------------------------------------------------------- About
    ('Dekho IT mein kya tumhe sabse zyada excite karta hai.', 'IT ma hajurlai sabai bhanda ke le excite garchha, patta lagaunuhos.'),
    ('Free courses se basics strong karo — C++, Python, Web.', 'Free courses bata basics strong banaunuhos — C++, Python, Web.'),
    ('Project ideas aur learning opportunities explore karo.', 'Project ideas ra learning opportunities explore garnuhos.'),
    ('CSIT, BIT, BCA — kaunsa tumhare liye sahi hai, samjho.', 'CSIT, BIT, BCA — hajurko lagi kun sahi ho, bujhnuhos.'),
    ('Seniors aur peers se seekho, sawaal poocho.', 'Seniors ra saathiharu bata siknuhos, prashna sodhnuhos.'),
    ('Greater confidence ke saath apna agla kadam uthao.', 'Thap confidence ka saath aafno arko kadam chalnuhos.'),
    ('class="category-btn th-btn style2">Dai se baat karo</a>', 'class="category-btn th-btn style2">Dai sanga kura garnuhos</a>'),

    # ---------------------------------------------------------------- Contact
    ('Dai se seedhi baat.</span>', 'Dai sanga sidhai kura.</span>'),
    ('Dai se seedhi baat — itwaladai@gmail.com', 'Dai sanga sidhai kura — itwaladai@gmail.com'),
    ('College, course, project, hackathon — kuch bhi poocho. Koi sawaal chhota nahi hota.',
     'College, course, project, hackathon — je pani sodhnuhos. Kunai prashna sano hudaina.'),
    ('<p class="box-text">Call ya WhatsApp karo</p>', '<p class="box-text">Call wa WhatsApp garnuhos</p>'),
    ('<p class="box-text">Kuch bhi poocho</p>', '<p class="box-text">Je pani sodhnuhos</p>'),
    ('<p class="box-text">Hum jaldi jawab dete hain</p>', '<p class="box-text">Hami chhitto jawaf dinchhau</p>'),
    ('>24 ghante ke andar</a>', '>24 ghanta bhitra</a>'),
    ('<h4 class="form-title">Message bhejo</h4>', '<h4 class="form-title">Message pathaunuhos</h4>'),
    ('placeholder="Message — apna sawaal likho..."', 'placeholder="Message — aafno prashna lekhnuhos..."'),
    ('MESSAGE BHEJO', 'MESSAGE PATHAUNUHOS'),
]


# guard: a replacement must never contain its own source text, or it would grow on every run
for _old, _new in COPY:
    assert _old not in _new, 'non-idempotent copy pair: %r' % _old


def apply(s):
    for old, new in COPY:
        if old in s:
            s = s.replace(old, new)
    return s
