/* ============================================================
   CNGPHM TIMELAPSE — MOTION & INTERACTION ENGINE
   Lenis Smooth Scroll + GSAP ScrollTrigger + Bilingual i18n
   ============================================================ */

(function () {
  'use strict';

  var root = document.documentElement;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var saveData = navigator.connection && navigator.connection.saveData;
  var contactConfig = window.TIMELAPSE_CONTACT || {};
  
  var lenis = null;
  var hasGsap = !!(window.gsap && window.ScrollTrigger);
  var currentLang = 'vi';

  /* ============ 1. Bilingual Translation Engine ============ */
  function getNestedTranslation(obj, path) {
    if (!obj || !path) return '';
    var keys = path.split('.');
    var res = obj;
    for (var i = 0; i < keys.length; i++) {
      if (res && typeof res === 'object' && keys[i] in res) {
        res = res[keys[i]];
      } else {
        return '';
      }
    }
    return res;
  }

  function setLanguage(lang) {
    if (!window.I18N_DATA || !window.I18N_DATA[lang]) return;
    currentLang = lang;
    var data = window.I18N_DATA[lang];

    // 1. Update document attributes & metadata
    root.setAttribute('lang', lang);
    if (data.meta) {
      if (data.meta.title) document.title = data.meta.title;
      var metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc && data.meta.desc) metaDesc.setAttribute('content', data.meta.desc);
    }

    // 2. Update plain text elements [data-i18n]
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.getAttribute('data-i18n');
      var val = getNestedTranslation(data, key);
      if (val) el.textContent = val;
    });

    // 3. Update HTML elements [data-i18n-html]
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-html');
      var val = getNestedTranslation(data, key);
      if (val) el.innerHTML = val;
    });

    // 4. Update placeholder attributes [data-i18n-ph]
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-ph');
      var val = getNestedTranslation(data, key);
      if (val) el.setAttribute('placeholder', val);
    });

    // 5. Update aria-label attributes [data-i18n-aria]
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) {
      var key = el.getAttribute('data-i18n-aria');
      var val = getNestedTranslation(data, key);
      if (val) el.setAttribute('aria-label', val);
    });

    // 6. Update Language Switcher buttons UI
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      var btnLang = btn.getAttribute('data-lang');
      var isActive = btnLang === lang;
      btn.classList.toggle('is-active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // 7. Persist to localStorage & URL state
    try {
      localStorage.setItem('cngphm_timelapse_lang', lang);
    } catch (e) {}

    // Update URL param without page reload
    var url = new URL(window.location);
    if (url.searchParams.get('lang') !== lang) {
      url.searchParams.set('lang', lang);
      window.history.replaceState({}, '', url);
    }

    // 8. Refresh ScrollTrigger layout
    if (window.ScrollTrigger) {
      window.ScrollTrigger.refresh();
    }
  }

  function initI18n() {
    // Detect language: URL param -> localStorage -> default 'vi'
    var urlParams = new URLSearchParams(window.location.search);
    var langParam = urlParams.get('lang');
    var savedLang = null;
    try {
      savedLang = localStorage.getItem('cngphm_timelapse_lang');
    } catch (e) {}

    var initialLang = (langParam === 'en' || langParam === 'vi') ? langParam : (savedLang || 'vi');
    setLanguage(initialLang);

    // Bind switcher buttons
    document.querySelectorAll('[data-lang]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var targetLang = btn.getAttribute('data-lang');
        if (targetLang && targetLang !== currentLang) {
          setLanguage(targetLang);
        }
      });
    });
  }

  /* ============ 2. Lenis Smooth Scroll Setup ============ */
  function initLenis() {
    if (!window.Lenis || reducedMotion) return;

    lenis = new Lenis({
      duration: 1.25,
      easing: function (t) {
        return Math.min(1, 1.001 - Math.pow(2, -10 * t));
      },
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.5
    });

    if (hasGsap) {
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    } else {
      var rafLoop = function (time) {
        lenis.raf(time);
        requestAnimationFrame(rafLoop);
      };
      requestAnimationFrame(rafLoop);
    }

    // Anchor Link Smooth Scroll
    document.addEventListener('click', function (e) {
      var link = e.target.closest('a[href^="#"]');
      if (!link) return;
      var targetId = link.getAttribute('href').slice(1);
      if (!targetId) return;
      var targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      e.preventDefault();
      lenis.scrollTo(targetEl, {
        offset: -20,
        duration: 1.4,
        easing: function (t) {
          return Math.min(1, 1.001 - Math.pow(2, -10 * t));
        }
      });
    });
  }

  /* ============ 3. Dynamic Smart Header ============ */
  function initHeader() {
    var header = document.getElementById('siteHeader');
    if (!header) return;

    var lastY = 0;
    function handleScroll(y) {
      var delta = y - lastY;
      header.classList.toggle('is-scrolled', y > 40);
      
      if (y < 120) {
        header.classList.remove('is-hidden');
      } else if (delta > 4 && y > 180) {
        header.classList.add('is-hidden');
      } else if (delta < -4) {
        header.classList.remove('is-hidden');
      }
      lastY = y;
    }

    if (lenis) {
      lenis.on('scroll', function (e) {
        handleScroll(e.scroll);
      });
    } else {
      window.addEventListener('scroll', function () {
        handleScroll(window.scrollY);
      }, { passive: true });
    }
  }

  /* ============ 4. GSAP Scroll Animations & Reveals ============ */
  function initAnimations() {
    if (!hasGsap || reducedMotion) {
      // Fallback: show everything
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    // Initial Hero Entrance Animation
    var heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    heroTl
      .fromTo('.site-header', { y: -30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 0)
      .fromTo('.hero-head .eyebrow', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9 }, 0.15)
      .fromTo('.hero-title', { y: 35, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, 0.25)
      .fromTo('.hero-sub-row', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 0.45)
      .fromTo('.hero-cinema', { y: 45, opacity: 0, scale: 0.98 }, { y: 0, opacity: 1, scale: 1, duration: 1.2 }, 0.55);

    // Section Scroll Reveals
    var revealElements = gsap.utils.toArray('.reveal:not(.hero-head *):not(.hero-cinema)');
    revealElements.forEach(function (el) {
      gsap.fromTo(
        el,
        { y: 32, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.95,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            toggleActions: 'play none none none'
          }
        }
      );
    });

    // Subtle Parallax on Hero Cinema Video
    var heroVideo = document.querySelector('.hero-video');
    if (heroVideo) {
      gsap.to(heroVideo, {
        yPercent: 10,
        ease: 'none',
        scrollTrigger: {
          trigger: '.hero-cinema',
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    }

    // Showcase image parallax
    var showcaseImages = gsap.utils.toArray('.showcase-card img');
    showcaseImages.forEach(function (img) {
      gsap.to(img, {
        yPercent: 6,
        ease: 'none',
        scrollTrigger: {
          trigger: img.closest('.showcase-card'),
          start: 'top bottom',
          end: 'bottom top',
          scrub: true
        }
      });
    });
  }

  /* ============ 5. Magnetic Buttons Interaction ============ */
  function initMagnetic() {
    if (!finePointer || reducedMotion || !hasGsap) return;

    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var rect = el.getBoundingClientRect();
        var x = (e.clientX - rect.left - rect.width / 2) * 0.25;
        var y = (e.clientY - rect.top - rect.height / 2) * 0.35;
        gsap.to(el, { x: x, y: y, duration: 0.4, ease: 'power2.out' });
      });

      el.addEventListener('pointerleave', function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' });
      });
    });
  }

  /* ============ 6. Video & Media Optimization ============ */
  function initMedia() {
    var heroVideo = document.querySelector('.hero-video');
    if (heroVideo && (reducedMotion || saveData)) {
      heroVideo.pause();
      heroVideo.removeAttribute('autoplay');
    }
  }

  /* ============ 7. Form & Booking Handlers ============ */
  function initContact() {
    var bookingLink = document.getElementById('bookingLink');
    if (bookingLink && contactConfig.bookingUrl) {
      bookingLink.href = contactConfig.bookingUrl;
      bookingLink.target = '_blank';
      bookingLink.rel = 'noopener';
      bookingLink.classList.remove('is-disabled');
      bookingLink.removeAttribute('aria-disabled');
      var activeText = window.I18N_DATA?.[currentLang]?.contact?.aside_book_btn_active || 'Select Consultation Time';
      bookingLink.querySelector('span:first-child').textContent = activeText;
    }

    var form = document.getElementById('briefForm');
    if (!form) return;
    var formStatus = document.getElementById('formStatus');
    var submitButton = form.querySelector('button[type="submit"]');

    function buildEmailBody(formData) {
      var isEn = currentLang === 'en';
      var labels = isEn ? {
        name: 'Full Name',
        company: 'Company',
        email: 'Email',
        phone: 'Phone / WhatsApp',
        projectType: 'Project Type',
        location: 'Location',
        timeline: 'Estimated Timeline',
        message: 'Objectives & Requirements'
      } : {
        name: 'Họ và tên',
        company: 'Công ty',
        email: 'Email',
        phone: 'Điện thoại / Zalo',
        projectType: 'Loại dự án',
        location: 'Địa điểm',
        timeline: 'Thời gian dự kiến',
        message: 'Mục tiêu & Yêu cầu'
      };
      return Object.keys(labels).map(function (k) {
        return labels[k] + ': ' + (formData.get(k) || (isEn ? 'Not provided' : 'Chưa cung cấp'));
      }).join('\n');
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      formStatus.textContent = '';
      var i18nContact = window.I18N_DATA?.[currentLang]?.contact || {};

      if (!form.checkValidity()) {
        form.reportValidity();
        formStatus.textContent = i18nContact.err_required || 'Vui lòng điền đầy đủ các thông tin có dấu *';
        return;
      }

      var formData = new FormData(form);

      // Default to Email Mailto fallback if no backend configured
      if (!contactConfig.formEndpoint) {
        var subjectPrefix = currentLang === 'en' ? 'Project Brief — ' : 'Brief dự án — ';
        var subject = subjectPrefix + (formData.get('projectType') || 'Timelapse') + ' — ' + formData.get('name');
        var mailto = 'mailto:' + encodeURIComponent(contactConfig.email || 'cuongphamworks@gmail.com') +
          '?subject=' + encodeURIComponent(subject) +
          '&body=' + encodeURIComponent(buildEmailBody(formData));
        
        formStatus.textContent = i18nContact.msg_opening_email || 'Đang mở ứng dụng email với nội dung brief đã điền sẵn...';
        window.location.href = mailto;
        return;
      }

      // If Formspree / Google Apps Script endpoint is available
      submitButton.disabled = true;
      var btnText = submitButton.querySelector('span:first-child');
      if (btnText) btnText.textContent = i18nContact.btn_sending || 'Đang gửi...';

      fetch(contactConfig.formEndpoint, {
        method: 'POST',
        body: formData,
        headers: { Accept: 'application/json' }
      })
      .then(function (res) {
        if (!res.ok) throw new Error('Network error');
        form.reset();
        formStatus.style.color = '#258b38';
        formStatus.textContent = i18nContact.msg_sent_success || 'Thông tin đã được gửi thành công.';
      })
      .catch(function () {
        formStatus.style.color = '#c43200';
        formStatus.textContent = i18nContact.msg_sent_error || 'Chưa thể gửi tự động. Vui lòng gửi email hoặc liên hệ Zalo.';
      })
      .finally(function () {
        submitButton.disabled = false;
        if (btnText) btnText.textContent = i18nContact.btn_submit || 'Gửi brief dự án';
      });
    });
  }

  /* ============ Initialization ============ */
  function init() {
    initI18n();
    initLenis();
    initHeader();
    initAnimations();
    initMagnetic();
    initMedia();
    initContact();
    root.classList.add('ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
