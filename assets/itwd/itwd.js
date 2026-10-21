/* IT Wala Dai — small page scripts (countdown, project filter, start-project modal, contact form) */
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

  // ---- Community countdown
  document.querySelectorAll('[data-countdown]').forEach(function (el) {
    var target = new Date(el.getAttribute('data-countdown')).getTime();
    var nums = {};
    el.querySelectorAll('[data-cd]').forEach(function (n) { nums[n.getAttribute('data-cd')] = n; });
    var done = el.parentNode.querySelector('.itwd-cd__done');
    var pad = function (v) { return String(v).padStart(2, '0'); };
    var timer;

    function tick() {
      var diff = Math.max(0, target - Date.now());
      var s = Math.floor(diff / 1000);
      nums.days.textContent = pad(Math.floor(s / 86400));
      nums.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      nums.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      nums.seconds.textContent = pad(s % 60);
      if (diff === 0) {
        clearInterval(timer);
        if (done) done.hidden = false;
      }
    }
    tick();
    timer = setInterval(tick, 1000);
  });

  // ---- Find Project: category filter (category cards + chips) and "View More"
  var projectsSection = document.getElementById('featured-projects');
  if (projectsSection) {
    var cards = Array.prototype.slice.call(projectsSection.querySelectorAll('.th-course-single[data-cat]'));
    var moreWrap = projectsSection.querySelector('.itwd-more-wrap');
    var moreBtn = projectsSection.querySelector('.itwd-view-more');
    var moreLabel = moreBtn ? moreBtn.innerHTML : '';
    var current = 'all';
    var expanded = false;

    // cards per row right now (3 on desktop, 2 on tablet, 1 on mobile)
    var perRow = function () {
      var top = cards[0].offsetTop, n = 0;
      cards.forEach(function (c) { if (!c.hidden && c.offsetTop === top) n++; });
      return Math.max(1, n);
    };
    var render = function () {
      var matching = cards.filter(function (c) { return current === 'all' || c.getAttribute('data-cat') === current; });
      cards.forEach(function (c) { c.hidden = matching.indexOf(c) === -1; });
      if (current === 'all' && !expanded) {
        var limit = perRow() * 2;   // two rows
        matching.forEach(function (c, i) { c.hidden = i >= limit; });
        if (moreWrap) moreWrap.hidden = matching.length <= limit;
        if (moreBtn) moreBtn.innerHTML = moreLabel;
      } else if (moreWrap) {
        moreWrap.hidden = current !== 'all';
        if (moreBtn) moreBtn.textContent = 'View Less';
      }
      refreshScroll();
    };
    var applyFilter = function (cat) {
      current = cat;
      expanded = false;
      projectsSection.querySelectorAll('.itwd-chip').forEach(function (chip) {
        chip.classList.toggle('is-active', chip.getAttribute('data-itwd-filter') === cat);
      });
      document.querySelectorAll('.category-card2[data-itwd-filter]').forEach(function (card) {
        card.classList.toggle('is-active', card.getAttribute('data-itwd-filter') === cat);
      });
      render();
    };
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-itwd-filter]');
      if (!trigger) return;
      e.preventDefault();
      applyFilter(trigger.getAttribute('data-itwd-filter'));
      if (!trigger.classList.contains('itwd-chip')) scrollToEl(projectsSection);
    });
    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        expanded = !expanded;
        render();
        if (!expanded) scrollToEl(projectsSection);
      });
    }
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(render, 150);
    });
    render();
  }

  // ---- Find Project: "Start Project" modal -> WhatsApp
  var modal = document.getElementById('start-project');
  if (modal) {
    // must live outside the transformed #smooth-content so position:fixed works
    document.body.appendChild(modal);
    var startForm = modal.querySelector('form');
    var title = modal.querySelector('.itwd-modal__title');
    var startStatus = startForm.querySelector('.itwd-form-status');

    var openModal = function (project) {
      title.textContent = project;
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
        openModal(btn.getAttribute('data-project'));
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
        startStatus.textContent = 'Name, phone aur sahi email bharo please.';
        startStatus.classList.add('is-error');
        return;
      }
      var msg =
        'Hello IT Wala Dai! 🙏\n' +
        'Malai "' + f.project.value + '" project banaunu xa.\n\n' +
        'Name: ' + name + '\n' +
        'Phone: ' + phone + '\n' +
        'Email: ' + email + '\n' +
        (desc ? 'Details: ' + desc + '\n' : '') +
        '\nKripaya guide garnu hola. Dhanyabad!';
      window.open('https://wa.me/' + startForm.getAttribute('data-whatsapp') + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      startStatus.classList.remove('is-error');
      startStatus.textContent = 'WhatsApp khul gaya — wahan Send dabao. Dai jaldi reply karenge!';
      startForm.reset();
    });
  }

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
        setStatus('Name, sahi email aur message — teeno bharo please.', true);
        return;
      }
      setStatus('Bhej rahe hain...');
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
          setStatus('Shukriya ' + name + '! Message mil gaya — reply 24 ghante mein.');
          form.reset();
        })
        .catch(function (err) {
          var reason = (err && err.message) || '';
          if (window.console) console.warn('Contact form (FormSubmit):', reason);
          if (/activat/i.test(reason)) {
            // FormSubmit sends a one-time "Activate Form" email to the inbox; until it is clicked nothing is delivered
            setStatus('Form abhi activate nahi hua hai. ' + to + ' ke inbox (aur Spam) mein FormSubmit ka "Activate Form" email kholo aur button dabao — uske baad messages direct aayenge.', true);
          } else {
            setStatus('Message nahi gaya (' + (reason || 'network error') + '). Thodi der baad try karo ya ' + to + ' pe email karo.', true);
          }
        })
        .finally(function () { button.disabled = false; });
    });
  });
})();
