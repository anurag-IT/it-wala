/* IT Wala Dai — small page scripts (app links, project tabs, start-project / free-course modal, course pages, testimonials filter, consultation form, contact form) */
(function () {
  'use strict';

  // The site uses GSAP ScrollSmoother. Make sure every page opens at the very top so the
  // visitor always lands on the main page (hero) — never stuck down at the contact CTA.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  // Theme uses GSAP ScrollSmoother: refresh it after layout changes, and scroll through it when present
  function refreshScroll() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  function scrollToEl(el) {
    var smoother = window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get();
    if (smoother) smoother.scrollTo(el, true, 'top 90px');
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  // Scroll to the very top — through ScrollSmoother when present, else natively.
  function goTop(smooth) {
    var smoother = window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get();
    if (smoother) smoother.scrollTo(0, !!smooth);
    else window.scrollTo({ top: 0, left: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  // ---- Open the site at the top of the main page
  // Jump up as soon as the script runs, and again once everything (and ScrollSmoother) is ready.
  goTop(false);
  window.addEventListener('load', function () { goTop(false); });

  // ---- Logo -> home / scroll to top of home
  // Every site logo (desktop header, mobile menu, side panel) should take the visitor to the
  // top of the home page. When already on home we smooth-scroll up; from any other page we
  // navigate to "/", which loads at the top thanks to the logic above.
  var isHome = function () {
    var p = location.pathname.replace(/\/+$/, '');
    return p === '' || p === '/' || p === '/index.html';
  };
  document.querySelectorAll('.header-logo a, .mobile-logo a, .about-logo a').forEach(function (a) {
    a.setAttribute('href', '/');
    a.addEventListener('click', function (e) {
      if (isHome()) {
        e.preventDefault();
        goTop(true);
      }
    });
  });

  // ---- IT Wala Dai App download buttons ([data-app-link="android" | "windows"])
  // Paste the real store / download links here once they are ready. While a link is empty the button opens
  // WhatsApp so the student can ask Dai for the app link (never a dead "#" button).
  var APP_LINKS = {
    android: '',
    windows: ''
  };
  var WA_NUMBER = '9779823415625';
  var waUrl = function (msg) { return 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(msg); };

  // Open WhatsApp with a prepared message. Nothing is stored by the website, so the status never claims a booking:
  // it tells the visitor to press Send in WhatsApp, and always offers a link in case the popup was blocked.
  var openWhatsApp = function (msg, status, button) {
    var url = waUrl(msg);
    if (button) {
      if (button.disabled) return;
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      setTimeout(function () { button.disabled = false; button.removeAttribute('aria-busy'); }, 2500);
    }
    var win = window.open(url, '_blank');
    if (win) { try { win.opener = null; } catch (err) { /* cross-origin: fine */ } }
    if (!status) return;
    status.classList.remove('is-error');
    status.textContent = win
      ? 'WhatsApp khulyo — tyaha Send thichepachhi matra message Dai lai pugchha. '
      : 'Browser le WhatsApp window block garyo. ';
    var link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'itwd-wa-fallback';
    link.innerHTML = '<i class="fab fa-whatsapp"></i>' + (win ? 'WhatsApp khulena? Yaha thichnuhos' : 'WhatsApp kholna yaha thichnuhos');
    status.appendChild(link);
  };
  var PHONE_RE = /^\+?[\d\s-]{7,16}$/;
  document.querySelectorAll('[data-app-link]').forEach(function (a) {
    var url = APP_LINKS[a.getAttribute('data-app-link')];
    a.removeAttribute('onclick');
    a.setAttribute('href', url || waUrl('Namaste Dai! Malai IT Wala Dai App ko download link chahiyo.'));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

  // ---- Coming Soon countdowns ([data-countdown="hackathon" | "community"])
  // ONE place for the launch targets (about four months of development from October 2026).
  // Change a date here and every countdown and "Target launch" label on the site follows.
  var LAUNCH_TARGETS = {
    hackathon: '2027-02-23T10:00:00+05:45',
    community: '2027-02-23T10:00:00+05:45'
  };
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  document.querySelectorAll('[data-countdown-target]').forEach(function (el) {
    var t = new Date(LAUNCH_TARGETS[el.getAttribute('data-countdown-target')]);
    if (!isNaN(t)) el.textContent = t.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  });
  var countdowns = Array.prototype.slice.call(document.querySelectorAll('[data-countdown]'));
  if (countdowns.length) {
    var tick = function () {
      var now = Date.now(); // real current time on every tick, never a fake decrementing counter
      countdowns.forEach(function (box) {
        var key = box.getAttribute('data-countdown');
        var left = new Date(LAUNCH_TARGETS[key]).getTime() - now;
        if (!(left > 0)) {
          box.hidden = true;
          var done = document.querySelector('[data-countdown-done="' + key + '"]');
          if (done) done.hidden = false;
          return;
        }
        var parts = {
          days: Math.floor(left / 864e5),
          hours: Math.floor(left / 36e5) % 24,
          minutes: Math.floor(left / 6e4) % 60,
          seconds: Math.floor(left / 1e3) % 60
        };
        box.querySelectorAll('[data-unit]').forEach(function (el) {
          var u = el.getAttribute('data-unit');
          var v = u === 'days' ? String(parts.days) : pad2(parts[u]);
          if (el.textContent !== v) {
            el.textContent = v;
            el.classList.remove('is-tick');
            void el.offsetWidth;
            el.classList.add('is-tick');
          }
        });
      });
    };
    tick();
    setInterval(tick, 1000);
  }

  // ---- "All Things in One Place" cards: enable the paint-out animation only after a real hover
  document.addEventListener('mouseover', function (e) {
    var card = e.target.closest && e.target.closest('.elementor-element-faea3de .category-card3');
    if (card) card.classList.add('itwd-was-hovered');
  });

  // ---- Find Project: category tabs (+ category cards above) and mobile swipe carousel
  var projectsSection = document.getElementById('featured-projects');
  var projWrap = projectsSection && projectsSection.querySelector('.itwd-projects');
  if (projWrap) {
    var grid = projWrap.querySelector('.itwd-proj-grid');
    var cards = Array.prototype.slice.call(grid.querySelectorAll('.itwd-proj'));
    var tabs = Array.prototype.slice.call(projWrap.querySelectorAll('.itwd-tab'));
    var countEl = projWrap.querySelector('.itwd-proj-nav__count b');
    var totalEl = projWrap.querySelector('.itwd-proj-nav__count span');
    var visible = function () { return cards.filter(function (c) { return !c.hidden; }); };

    var showCategory = function (cat) {
      if (!tabs.some(function (t) { return t.getAttribute('data-itwd-filter') === cat; })) cat = tabs[0].getAttribute('data-itwd-filter');
      tabs.forEach(function (t) {
        var on = t.getAttribute('data-itwd-filter') === cat;
        t.classList.toggle('is-active', on);
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on && t.scrollIntoView && window.matchMedia('(max-width: 991px)').matches) {
          t.parentNode.scrollTo({ left: t.offsetLeft - 16, behavior: 'smooth' });
        }
      });
      document.querySelectorAll('.category-card2[data-itwd-filter]').forEach(function (card) {
        card.classList.toggle('is-active', card.getAttribute('data-itwd-filter') === cat);
      });
      cards.forEach(function (c) { c.hidden = c.getAttribute('data-cat') !== cat; });
      // replay the entrance animation
      grid.classList.remove('is-animating');
      void grid.offsetWidth;
      grid.classList.add('is-animating');
      grid.scrollLeft = 0;
      if (totalEl) totalEl.textContent = visible().length;
      if (countEl) countEl.textContent = '1';
      refreshScroll();
    };

    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-itwd-filter]');
      if (!trigger) return;
      e.preventDefault();
      var cat = trigger.getAttribute('data-itwd-filter');
      if (cat !== 'all') showCategory(cat);
      if (!trigger.classList.contains('itwd-tab')) scrollToEl(projectsSection);
    });

    // mobile carousel: arrows + "2 / 5" counter
    var step = function () {
      var first = visible()[0];
      return first ? first.getBoundingClientRect().width + 16 : grid.clientWidth;
    };
    projWrap.querySelectorAll('.itwd-proj-nav__btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        grid.scrollBy({ left: step() * Number(btn.getAttribute('data-dir')), behavior: 'smooth' });
      });
    });
    grid.addEventListener('scroll', function () {
      if (!countEl) return;
      var n = Math.round(grid.scrollLeft / step()) + 1;
      countEl.textContent = Math.min(Math.max(n, 1), visible().length);
    }, { passive: true });

    showCategory(tabs[0].getAttribute('data-itwd-filter'));

    // header search ("Search..." -> /programs?q=...): show the matching project ideas
    var query = (new URLSearchParams(location.search).get('q') || '').trim();
    if (query) {
      var ql = query.toLowerCase();
      var hits = cards.filter(function (c) { return c.textContent.toLowerCase().indexOf(ql) !== -1; });
      var note = document.createElement('p');
      note.className = 'itwd-search-note';
      note.setAttribute('role', 'status');
      if (hits.length) {
        tabs.forEach(function (t) { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
        cards.forEach(function (c) { c.hidden = hits.indexOf(c) === -1; });
        if (totalEl) totalEl.textContent = hits.length;
        note.textContent = '"' + query + '" ko lagi ' + hits.length + ' project idea bhetiyo. Category thichera sabai hernuhos.';
      } else {
        note.textContent = '"' + query + '" sanga milne project idea bhetiyena. Category bata hernuhos wa Dai lai sodhnuhos.';
      }
      projWrap.insertBefore(note, projWrap.firstChild);
      document.querySelectorAll('.itwd-nav-search input[name="q"]').forEach(function (i) { i.value = query; });
      setTimeout(function () { scrollToEl(projectsSection); refreshScroll(); }, 600);
    }
  }

  // ---- Find Project: "Start Project" modal -> WhatsApp
  var modal = document.getElementById('start-project');
  if (modal) {
    // must live outside the transformed #smooth-content so position:fixed works
    document.body.appendChild(modal);
    var startForm = modal.querySelector('form');
    var title = modal.querySelector('.itwd-modal__title');
    var eyebrow = modal.querySelector('.itwd-modal__eyebrow');
    var lead = modal.querySelector('.itwd-modal__lead');
    var intro = modal.querySelector('.itwd-modal__text');
    var kind = 'project';
    var startStatus = startForm.querySelector('.itwd-form-status');
    // Why the form opens WhatsApp: one message for free courses, one for the paid project-guidance service
    var MODAL_COPY = {
      course: {
        eyebrow: 'Free Course',
        lead: 'Hajurko learning journey yahi bata suru hunchha!',
        text: 'Form bharnuhos, ani WhatsApp bata Dai sanga direct kura garnuhos. Hajurko interest ra learning needs bujhera course ko barema clear information pauna saknuhunchha.',
        placeholder: 'Kun class ma padhdai hunuhunchha? Aru kura bhaye lekhnuhos...'
      },
      project: {
        eyebrow: 'Project Guidance',
        lead: 'Aafno project idea ko lagi sahi guidance khojdai hunuhunchha?',
        text: 'Project ko idea ra requirements share garnuhos. WhatsApp ma Dai sanga kura garera guidance, scope ra project-anusar ko pricing bujhna saknuhunchha.',
        placeholder: 'Project ko barema bataunuhos: college, semester, deadline, aafno idea...'
      }
    };

    var openModal = function (project, k) {
      kind = k === 'course' ? 'course' : 'project';
      var copy = MODAL_COPY[kind];
      title.textContent = project;
      if (eyebrow) eyebrow.textContent = copy.eyebrow;
      if (lead) lead.textContent = copy.lead;
      if (intro) intro.textContent = copy.text;
      startForm.elements.description.setAttribute('placeholder', copy.placeholder);
      startForm.elements.project.value = project;
      startStatus.textContent = '';
      startStatus.classList.remove('is-error');
      modal.hidden = false;
      document.documentElement.classList.add('itwd-modal-open');
      setTimeout(function () { startForm.elements.name.focus(); }, 50);
    };
    var closeModal = function () {
      modal.hidden = true;
      document.documentElement.classList.remove('itwd-modal-open');
    };

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('.itwd-start');
      if (btn) {
        e.preventDefault();
        openModal(btn.getAttribute('data-project'), btn.getAttribute('data-kind'));
      } else if (e.target.closest('[data-itwd-close]')) {
        closeModal();
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !modal.hidden) closeModal();
    });

    startForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = startForm.elements;
      var name = f.name.value.trim();
      var phone = f.phone.value.trim();
      var email = f.email.value.trim();
      var desc = f.description.value.trim();
      if (!name || !PHONE_RE.test(phone) || !email || !f.email.checkValidity()) {
        startStatus.textContent = 'Kripaya naam, sahi phone number ra sahi email bharnuhos.';
        startStatus.classList.add('is-error');
        return;
      }
      var msg =
        'Hello IT Wala Dai! 🙏\n' +
        (kind === 'course'
          ? 'Malai "' + f.project.value + '" free course join garnu xa.\n\n'
          : 'Malai "' + f.project.value + '" ko lagi project guidance chahiyo. Mero project ko idea ra requirements share garna chahanchhu.\n\n') +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Email: ' + email + '\n' +
        (desc ? 'Details: ' + desc + '\n' : '') +
        '\nKripaya guide garnu hola. Dhanyabad!';
      openWhatsApp(msg, startStatus, startForm.querySelector('button[type="submit"]'));
    });
  }

  // ---- Course detail pages: accordion, section tabs, share, wishlist, sticky sidebar
  var toast = function (text) {
    var t = document.querySelector('.itwd-toast');
    if (!t) {
      t = document.createElement('div');
      t.className = 'itwd-toast';
      t.setAttribute('role', 'status');
      document.body.appendChild(t);
    }
    t.textContent = text;
    t.classList.add('is-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function () { t.classList.remove('is-show'); }, 2200);
  };

  // accordion (curriculum modules + FAQs)
  document.addEventListener('click', function (e) {
    var head = e.target.closest('.itwd-acc__head');
    if (!head) return;
    var acc = head.parentNode;
    var open = !acc.classList.contains('is-open');
    acc.classList.toggle('is-open', open);
    head.setAttribute('aria-expanded', open ? 'true' : 'false');
    setTimeout(refreshScroll, 480);
  });

  // wishlist hearts (remembered in this browser)
  var WISH_KEY = 'itwd-wishlist';
  var getWish = function () {
    try { return JSON.parse(localStorage.getItem(WISH_KEY)) || []; } catch (err) { return []; }
  };
  var paintWish = function () {
    var list = getWish();
    document.querySelectorAll('[data-wish]').forEach(function (b) {
      var on = list.indexOf(b.getAttribute('data-wish')) !== -1;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  };
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-wish]');
    if (!b) return;
    e.preventDefault();
    var id = b.getAttribute('data-wish');
    var list = getWish();
    var i = list.indexOf(id);
    if (i === -1) { list.push(id); toast('Wishlist ma thapiyo ❤'); } else { list.splice(i, 1); toast('Wishlist bata hatayiyo'); }
    try { localStorage.setItem(WISH_KEY, JSON.stringify(list)); } catch (err) { /* private mode */ }
    paintWish();
  });
  paintWish();

  // share: native share sheet on phones, otherwise copy the link
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-share]');
    if (!b) return;
    e.preventDefault();
    var data = { title: document.title, url: location.href };
    if (navigator.share) {
      navigator.share(data).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(location.href).then(function () { toast('Link copy bhayo!'); });
    }
  });

  var cdTabs = document.querySelector('.itwd-cd-tabs');
  if (cdTabs) {
    var tabLinks = Array.prototype.slice.call(cdTabs.querySelectorAll('a'));
    var secs = tabLinks.map(function (a) { return document.querySelector(a.getAttribute('href')); });
    tabLinks.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        if (secs[i]) scrollToEl(secs[i]);
      });
    });
    // highlight the tab of the section currently on screen
    var spy = function () {
      var current = 0;
      secs.forEach(function (sec, i) {
        if (sec && sec.getBoundingClientRect().top < window.innerHeight * 0.35) current = i;
      });
      tabLinks.forEach(function (a, i) { a.classList.toggle('is-active', i === current); });
    };
    window.addEventListener('scroll', spy, { passive: true });
    spy();
  }

  // sticky sidebar on desktop (ScrollSmoother transforms the page, so CSS position:sticky can't work)
  var side = document.querySelector('.itwd-cd-side');
  var mainCol = document.querySelector('.itwd-cd__main');
  if (side && mainCol) {
    window.addEventListener('load', function () {
      if (!window.ScrollTrigger || !window.matchMedia('(min-width: 992px)').matches) return;
      // short sidebar: stick under the header; tall sidebar: stick once its bottom reaches the screen bottom
      var fits = function () { return side.offsetHeight + 130 <= window.innerHeight; };
      window.ScrollTrigger.create({
        trigger: side,
        start: function () { return fits() ? 'top 110px' : 'bottom bottom-=24'; },
        endTrigger: mainCol,
        end: function () { return fits() ? 'bottom ' + (110 + side.offsetHeight) + 'px' : 'bottom bottom-=24'; },
        pin: true,
        pinSpacing: false,
        invalidateOnRefresh: true
      });
    });
  }

  // ---- Testimonials page: category filter
  var tGrid = document.querySelector('.itwd-tgrid');
  if (tGrid) {
    var tCards = Array.prototype.slice.call(tGrid.querySelectorAll('.itwd-tc'));
    document.querySelectorAll('.itwd-tfilter').forEach(function (btn) {
      btn.setAttribute('aria-pressed', btn.classList.contains('is-active') ? 'true' : 'false');
      btn.addEventListener('click', function () {
        var cat = btn.getAttribute('data-tfilter');
        document.querySelectorAll('.itwd-tfilter').forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-pressed', on ? 'true' : 'false');
        });
        tCards.forEach(function (c) { c.hidden = cat !== 'all' && c.getAttribute('data-cat') !== cat; });
        tGrid.classList.remove('is-animating');
        void tGrid.offsetWidth;
        tGrid.classList.add('is-animating');
        refreshScroll();
      });
    });
  }

  // ---- Header "Join Now" -> join form -> WhatsApp
  var join = document.getElementById('itwd-join');
  if (join) {
    if (join.parentNode !== document.body) document.body.appendChild(join);
    var joinForm = join.querySelector('form');
    var joinStatus = joinForm.querySelector('.itwd-form-status');
    var lastFocus = null;
    var mobileMenu = document.querySelector('.th-menu-wrapper');
    var openJoin = function () {
      if (mobileMenu) mobileMenu.classList.remove('th-body-visible');
      lastFocus = document.activeElement;
      join.hidden = false;
      document.documentElement.classList.add('itwd-modal-open');
      setTimeout(function () { joinForm.elements.name.focus(); }, 50);
    };
    var closeJoin = function () {
      join.hidden = true;
      document.documentElement.classList.remove('itwd-modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    };
    // bound on each button: the theme's mobile menu stops click propagation inside its panel
    document.querySelectorAll('[data-itwd-join]').forEach(function (btn) {
      btn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); openJoin(); });
    });
    join.querySelectorAll('[data-itwd-join-close]').forEach(function (el) { el.addEventListener('click', closeJoin); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !join.hidden) closeJoin(); });
    joinForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = joinForm.elements;
      var v = function (n) { return (f[n].value || '').trim(); };
      var checks = [['name', !!v('name'), 'naam'], ['level', !!v('level'), 'ahile ko padhai'],
        ['interest', !!v('interest'), 'mukhya interest'], ['phone', PHONE_RE.test(v('phone')), 'sahi WhatsApp number']];
      var missing = [];
      checks.forEach(function (c) {
        f[c[0]].classList.toggle('is-invalid', !c[1]);
        f[c[0]].setAttribute('aria-invalid', c[1] ? 'false' : 'true');
        if (!c[1]) missing.push(c[2]);
      });
      if (missing.length) {
        joinStatus.classList.add('is-error');
        joinStatus.textContent = 'Kripaya ' + missing.join(', ') + ' bharnuhos.';
        return;
      }
      var msg = 'Namaste IT Wala Dai! 🙏 Ma IT Wala Dai sanga jodina chahanchhu.\n\n' +
        'Naam: ' + v('name') + '\n' +
        'Padhai: ' + v('level') + '\n' +
        'Interest: ' + v('interest') + '\n' +
        'WhatsApp: ' + v('phone') + '\n' +
        (v('message') ? '\nMessage: ' + v('message') + '\n' : '');
      openWhatsApp(msg, joinStatus, joinForm.querySelector('button[type="submit"]'));
    });
  }

  // ---- Theme mobile menu: accessible names + close after choosing a link on the same page
  document.querySelectorAll('.th-menu-toggle').forEach(function (btn) {
    if (!btn.getAttribute('aria-label')) btn.setAttribute('aria-label', btn.querySelector('.fa-times') ? 'Menu band garnuhos' : 'Menu kholnuhos');
  });
  document.querySelectorAll('.th-mobile-menu a[href]').forEach(function (a) {
    a.addEventListener('click', function () {
      var wrap = document.querySelector('.th-menu-wrapper');
      if (wrap) wrap.classList.remove('th-body-visible');
    });
  });

  // ---- Project guidance accordion (home "AI Project Lab"): one item open at a time
  document.querySelectorAll('[data-itwd-accordion]').forEach(function (acc) {
    var buttons = Array.prototype.slice.call(acc.querySelectorAll('.itwd-gacc__btn'));
    var setOpen = function (btn, open) {
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      btn.closest('.itwd-gacc__item').classList.toggle('is-open', open);
    };
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var wasOpen = btn.getAttribute('aria-expanded') === 'true';
        buttons.forEach(function (b) { setOpen(b, false); });
        if (!wasOpen) setOpen(btn, true);
        setTimeout(refreshScroll, 380);
      });
    });
  });

  // ---- Free IT consultation page: college search
  var collegeSearch = document.getElementById('itwd-college-search');
  if (collegeSearch) {
    var collegeCols = Array.prototype.slice.call(document.querySelectorAll('.itwd-fc-college-col'));
    var emptyNote = document.querySelector('.itwd-fc-empty');
    collegeSearch.addEventListener('input', function () {
      var q = collegeSearch.value.trim().toLowerCase();
      var shown = 0;
      collegeCols.forEach(function (c) {
        var hit = !q || c.getAttribute('data-name').indexOf(q) !== -1;
        c.hidden = !hit;
        if (hit) shown++;
      });
      if (emptyNote) emptyNote.hidden = shown !== 0;
      refreshScroll();
    });
  }

  // ---- Free IT consultation page: request form -> WhatsApp (no backend; nothing is stored)
  document.querySelectorAll('form.itwd-fc-form').forEach(function (form) {
    var status = form.querySelector('.itwd-form-status');
    var setStatus = function (text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var f = form.elements;
      var val = function (n) { return (f[n].value || '').trim(); };
      var missing = [];
      if (!val('name')) missing.push('naam');
      if (!PHONE_RE.test(val('phone'))) missing.push('sahi phone number');
      if (!val('level')) missing.push('ahile ko padhai');
      if (!val('course')) missing.push('interest bhayeko course');
      if (!val('question')) missing.push('prashna');
      form.querySelectorAll('.form-control, .form-select').forEach(function (el) {
        var bad = el.required && !el.value.trim();
        if (el.name === 'phone') bad = !PHONE_RE.test(el.value.trim());
        el.classList.toggle('is-invalid', bad);
        el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      });
      if (missing.length) {
        setStatus('Kripaya ' + missing.join(', ') + ' bharnuhos.', true);
        return;
      }
      var contactEl = form.querySelector('input[name="contact"]:checked');
      var contact = contactEl ? contactEl.value : '';
      // only the offered options are accepted (the "Chhannuhos" placeholder is disabled and has no value)
      var allowed = function (name, value) {
        return Array.prototype.some.call(form.querySelectorAll('[name="' + name + '"] option:not([disabled]), input[name="' + name + '"]'),
          function (o) { return o.value === value; });
      };
      if (!contact || !allowed('contact', contact)) {
        setStatus('Kripaya contact garne tarika (WhatsApp wa Phone call) chhannuhos.', true);
        return;
      }
      if (!allowed('level', val('level')) || !allowed('course', val('course'))) {
        setStatus('Kripaya list bata padhai ra course chhannuhos.', true);
        return;
      }
      var msg =
        'Namaste Dai! 🙏 Malai free IT consultation chahiyo.\n\n' +
        'Naam: ' + val('name') + '\n' +
        'Phone: ' + val('phone') + '\n' +
        'Ahile ko padhai: ' + val('level') + '\n' +
        'Interest: ' + val('course') + '\n' +
        (val('colleges') ? 'Man pareko college/university: ' + val('colleges') + '\n' : '') +
        'Contact: ' + contact + '\n\n' +
        'Prashna: ' + val('question');
      openWhatsApp(msg, status, form.querySelector('button[type="submit"]'));
    });
  });

  // ---- Contact form -> sent straight to the inbox via FormSubmit (no backend, no mail app)
  document.querySelectorAll('form.itwd-contact-form').forEach(function (form) {
    var status = form.querySelector('.itwd-form-status');
    var button = form.querySelector('button[type="submit"]');
    var to = form.getAttribute('data-mailto');
    var setStatus = function (text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['your-name'].value.trim();
      var email = form.elements['your-email'].value.trim();
      var msg = form.elements['your-message'].value.trim();
      if (!name || !email || !msg || !form.elements['your-email'].checkValidity()) {
        setStatus('Kripaya naam, sahi email ra message — tinai bharnuhos.', true);
        return;
      }
      setStatus('Pathaudai chhau...');
      button.disabled = true;

      fetch('https://formsubmit.co/ajax/' + to, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          message: msg,
          _replyto: email,
          _subject: 'IT Wala Dai website — message from ' + name,
          _template: 'table',
          _captcha: 'false'
        })
      })
        .then(function (r) {
          return r.json().catch(function () { return { success: 'false', message: 'HTTP ' + r.status }; });
        })
        .then(function (data) {
          if (String(data.success) !== 'true') throw new Error(data.message || 'Unknown error');
          setStatus('Dhanyabad ' + name + '! Message pugyo — 24 ghanta bhitra reply garchhau.');
          form.reset();
        })
        .catch(function (err) {
          var reason = (err && err.message) || '';
          if (window.console) console.warn('Contact form (FormSubmit):', reason);
          if (/activat/i.test(reason)) {
            // FormSubmit sends a one-time "Activate Form" email to the inbox; until it is clicked nothing is delivered
            setStatus('Form ahile activate bhayeko chhaina. ' + to + ' ko inbox (ra Spam) ma FormSubmit ko "Activate Form" email kholera button thichnuhos — tyaspachhi messages sidhai aaunchhan.', true);
          } else {
            setStatus('Message pugena (' + (reason || 'network error') + '). Kehi bermapachhi feri try garnuhos wa ' + to + ' ma email garnuhos.', true);
          }
        })
        .finally(function () { button.disabled = false; });
    });
  });
})();
