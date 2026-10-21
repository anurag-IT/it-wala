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
  document.querySelectorAll('[data-app-link]').forEach(function (a) {
    var url = APP_LINKS[a.getAttribute('data-app-link')];
    a.removeAttribute('onclick');
    a.setAttribute('href', url || waUrl('Namaste Dai! Malai IT Wala Dai App ko download link chahiyo.'));
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener');
  });

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
  }

  // ---- Find Project: "Start Project" modal -> WhatsApp
  var modal = document.getElementById('start-project');
  if (modal) {
    // must live outside the transformed #smooth-content so position:fixed works
    document.body.appendChild(modal);
    var startForm = modal.querySelector('form');
    var title = modal.querySelector('.itwd-modal__title');
    var eyebrow = modal.querySelector('.itwd-modal__eyebrow');
    var kind = 'project';
    var startStatus = startForm.querySelector('.itwd-form-status');

    var openModal = function (project, k) {
      kind = k || 'project';
      title.textContent = project;
      if (eyebrow) eyebrow.textContent = kind === 'course' ? 'Free Course' : 'Start Project';
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
      if (!name || !phone || !email || !f.email.checkValidity()) {
        startStatus.textContent = 'Kripaya naam, phone ra sahi email bharnuhos.';
        startStatus.classList.add('is-error');
        return;
      }
      var msg =
        'Hello IT Wala Dai! 🙏\n' +
        (kind === 'course'
          ? 'Malai "' + f.project.value + '" free course join garnu xa.\n\n'
          : 'Malai "' + f.project.value + '" project banaunu xa.\n\n') +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Email: ' + email + '\n' +
        (desc ? 'Details: ' + desc + '\n' : '') +
        '\nKripaya guide garnu hola. Dhanyabad!';
      window.open('https://wa.me/' + startForm.getAttribute('data-whatsapp') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      startStatus.classList.remove('is-error');
      startStatus.textContent = 'WhatsApp khulyo — tyaha Send thichnuhos. Dai chhittai reply garnuhunchha!';
      startForm.reset();
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
      if (!/^[+\d][\d\s-]{6,}$/.test(val('phone'))) missing.push('sahi phone number');
      if (!val('level')) missing.push('ahile ko padhai');
      if (!val('course')) missing.push('interest bhayeko course');
      if (!val('question')) missing.push('prashna');
      form.querySelectorAll('.form-control, .form-select').forEach(function (el) {
        var bad = el.required && !el.value.trim();
        if (el.name === 'phone') bad = !/^[+\d][\d\s-]{6,}$/.test(el.value.trim());
        el.classList.toggle('is-invalid', bad);
        el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      });
      if (missing.length) {
        setStatus('Kripaya ' + missing.join(', ') + ' bharnuhos.', true);
        return;
      }
      var contact = (form.querySelector('input[name="contact"]:checked') || {}).value || 'WhatsApp';
      var msg =
        'Namaste Dai! 🙏 Malai free IT consultation chahiyo.\n\n' +
        'Naam: ' + val('name') + '\n' +
        'Phone: ' + val('phone') + '\n' +
        'Ahile ko padhai: ' + val('level') + '\n' +
        'Interest: ' + val('course') + '\n' +
        (val('colleges') ? 'Man pareko college/university: ' + val('colleges') + '\n' : '') +
        'Contact: ' + contact + '\n\n' +
        'Prashna: ' + val('question');
      window.open(waUrl(msg), '_blank', 'noopener');
      setStatus('WhatsApp khulyo — request pathauna tyaha Send thichnuhos. Hami chhitto reply garchhau.');
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
