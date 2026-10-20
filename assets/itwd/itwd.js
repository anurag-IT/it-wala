/* IT Wala Dai — small page scripts (countdown, project filter, start-project modal, contact form) */
(function () {
  'use strict';

  // Theme uses GSAP ScrollSmoother: refresh it after layout changes, and scroll through it when present
  function refreshScroll() {
    if (window.ScrollTrigger) window.ScrollTrigger.refresh();
  }
  function scrollToEl(el) {
    var smoother = window.ScrollSmoother && window.ScrollSmoother.get && window.ScrollSmoother.get();
    if (smoother) smoother.scrollTo(el, true, 'top 90px');
    else el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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

  // ---- Find Project: category filter (category cards + chips)
  var projectsSection = document.getElementById('featured-projects');
  if (projectsSection) {
    var cards = projectsSection.querySelectorAll('.th-course-single[data-cat]');
    var applyFilter = function (cat) {
      cards.forEach(function (c) { c.hidden = cat !== 'all' && c.getAttribute('data-cat') !== cat; });
      projectsSection.querySelectorAll('.itwd-chip').forEach(function (chip) {
        chip.classList.toggle('is-active', chip.getAttribute('data-itwd-filter') === cat);
      });
      document.querySelectorAll('.category-card2[data-itwd-filter]').forEach(function (card) {
        card.classList.toggle('is-active', card.getAttribute('data-itwd-filter') === cat);
      });
      refreshScroll();
    };
    document.addEventListener('click', function (e) {
      var trigger = e.target.closest('[data-itwd-filter]');
      if (!trigger) return;
      e.preventDefault();
      applyFilter(trigger.getAttribute('data-itwd-filter'));
      if (!trigger.classList.contains('itwd-chip')) scrollToEl(projectsSection);
    });
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

  // ---- Contact form -> email (FormSubmit, no backend needed). Falls back to the mail app if the request fails.
  document.querySelectorAll('form.itwd-contact-form').forEach(function (form) {
    var status = form.querySelector('.itwd-form-status');
    var button = form.querySelector('button[type="submit"]');
    var to = form.getAttribute('data-mailto');

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = form.elements['your-name'].value.trim();
      var email = form.elements['your-email'].value.trim();
      var msg = form.elements['your-message'].value.trim();
      if (!name || !email || !msg || !form.elements['your-email'].checkValidity()) {
        status.textContent = 'Name, sahi email aur message — teeno bharo please.';
        status.classList.add('is-error');
        return;
      }
      status.classList.remove('is-error');
      status.textContent = 'Bhej rahe hain...';
      button.disabled = true;

      fetch('https://formsubmit.co/ajax/' + to, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: name,
          email: email,
          message: msg,
          _subject: 'IT Wala Dai website — message from ' + name,
          _template: 'table',
          _captcha: 'false'
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (String(data.success) !== 'true') throw new Error(data.message || 'failed');
          status.textContent = 'Shukriya ' + name + '! Message mil gaya — reply 24 ghante mein.';
          form.reset();
        })
        .catch(function () {
          var subject = 'IT Wala Dai — message from ' + name;
          var body = msg + '\n\n— ' + name + ' (' + email + ')';
          window.location.href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
          status.textContent = 'Direct send nahi hua — tumhara mail app khul raha hai, wahan se send kar do.';
        })
        .finally(function () { button.disabled = false; });
    });
  });
})();
