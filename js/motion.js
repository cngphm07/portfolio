/* ============================================================
   MOTION — Lenis smooth scroll + GSAP scroll choreography
   Reveals, marquee velocity, counters, magnetic elements,
   custom cursor, header timecode.
   ============================================================ */
window.Motion = (function(){
'use strict';
var hasGsap = !!(window.gsap && window.ScrollTrigger);
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine = window.matchMedia('(pointer: fine)').matches;
var lenis = null;
var marqueeTween = null;

if(hasGsap){
  gsap.registerPlugin(ScrollTrigger);
  if(window.SplitText) gsap.registerPlugin(SplitText);
}

function pad(n){ return String(n).padStart(2, '0'); }

/* ---------- lenis ---------- */
function setupLenis(){
  if(!window.Lenis || reduced) return;
  /* wheel smoothing off — macOS trackpad already has native momentum, so
     Lenis lerp read as heavy lag. Native scroll stays crisp; Lenis keeps
     its smooth scrollTo for anchor links only. */
  lenis = new Lenis({ duration: 1.15, smoothWheel: false });
  if(hasGsap){
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);
  }else{
    var loop = function(t){ lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  document.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="#"]');
    if(!a) return;
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if(!el) return;
    e.preventDefault();
    lenis.scrollTo(el, { offset: 0, duration: 1.5 });
  });
}

function stop(){
  if(lenis) lenis.stop();
  document.body.style.overflow = 'hidden';
}
function start(){
  if(lenis) lenis.start();
  document.body.style.overflow = '';
}

/* ---------- header hide/show ---------- */
function setupHeader(){
  var header = document.getElementById('siteHeader');
  if(!header) return;
  var lastY = 0, hidden = false, away = false;
  var acc = 0, accT = 0;
  header.style.transition = 'transform .55s cubic-bezier(.19,1,.22,1)';
  /* direction judged on a ~90ms delta window so a single jittery scroll
     event can't flip hide/show (and with it the sticky HUD bar offset) */
  function onY(y){
    var now = performance.now();
    acc += y - lastY;
    lastY = y;
    if(now - accT < 90) return;
    accT = now;
    var d = acc;
    acc = 0;
    if(y < 90){ hidden = false; }
    else if(d > 3 && y > 140){ hidden = true; }
    else if(d < -3){ hidden = false; }
    if(hidden !== away){
      away = hidden;
      document.body.classList.toggle('nav-away', away);
    }
    header.style.transform = hidden ? 'translateY(-110%)' : '';
  }
  if(lenis) lenis.on('scroll', function(e){ onY(e.scroll); });
  else window.addEventListener('scroll', function(){ onY(window.scrollY); }, { passive: true });
}

/* ---------- marquee (velocity-reactive) ---------- */
function setupMarquee(){
  var track = document.getElementById('marqueeTrack');
  if(!track) return;
  var words = ['SHOWREEL 2026','TVC','DOCUMENTARY','ARCHITECTURE','CORPORATE','MUSIC VIDEO','WEDDING','PODCAST'];
  var seq = words.map(function(w){ return '<span>' + w + '</span><span class="sep">✦</span>'; }).join('');
  track.innerHTML = seq + seq;
  if(!hasGsap || reduced) return;
  marqueeTween = gsap.to(track, { xPercent: -50, ease: 'none', duration: 26, repeat: -1 });
  var targetTS = 1;
  ScrollTrigger.create({
    onUpdate: function(self){ targetTS = Math.min(4, 1 + Math.abs(self.getVelocity()) / 900); }
  });
  gsap.ticker.add(function(){
    var cur = marqueeTween.timeScale();
    marqueeTween.timeScale(cur + (targetTS - cur) * 0.08);
    targetTS += (1 - targetTS) * 0.04;
  });
}

/* ---------- section choreography (adapted from getartcraft/filmcraft) ----------
   Per [data-choreo] section, on first entry (top 88%):
   top hairline draws in (scaleX) → HUD bar lifts out of blur → corner "+" marks pop */
function setupChoreo(){
  if(!hasGsap || reduced) return;
  document.querySelectorAll('[data-choreo]').forEach(function(sec){
    var rule = sec.querySelector('.sec-topline');
    var ticks = sec.querySelectorAll('.sec-tick');
    var hud = sec.querySelector('.sec-head');
    if(rule) gsap.set(rule, { scaleX: 0 });
    if(ticks.length) gsap.set(ticks, { scale: 0, opacity: 0 });
    if(hud) gsap.set(hud, { autoAlpha: 0, y: 28, filter: 'blur(8px)' });
    ScrollTrigger.create({
      trigger: sec, start: 'top 88%', once: true,
      onEnter: function(){
        var tl = gsap.timeline();
        if(rule) tl.to(rule, { scaleX: 1, duration: .7, ease: 'power2.out', clearProps: 'all' }, 0);
        if(hud) tl.to(hud, { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: .9, ease: 'power3.out', clearProps: 'all' }, .15);
        if(ticks.length) tl.to(ticks, { scale: 1, opacity: 1, duration: .35, ease: 'power3.out', stagger: .06, clearProps: 'all' }, .35);
      }
    });
  });
}

/* ---------- reveals ---------- */
function setupReveals(){
  if(!hasGsap || reduced) return;

  /* [data-reveal-group]: children cascade left→right by x position within the
     group (filmcraft's horizontal stagger), instead of a flat index stagger */
  function groupReveal(groupSel, childSel){
    var group = document.querySelector(groupSel);
    if(!group) return;
    var gw = group.getBoundingClientRect().width;
    group.querySelectorAll(childSel).forEach(function(el){
      var relX = gw > 0 ? (el.getBoundingClientRect().left - group.getBoundingClientRect().left) / gw : 0;
      gsap.from(el, {
        autoAlpha: 0, y: 24, filter: 'blur(8px)', duration: .9, ease: 'power3.out',
        delay: relX * .18,
        scrollTrigger: { trigger: group, start: 'top 90%', once: true },
        clearProps: 'filter'
      });
    });
  }
  groupReveal('#brandsRow', 'span');
  groupReveal('.foot-grid', '.foot-col');

  if(window.SplitText){
    var lead = new SplitText('#aboutLead', { type: 'lines' });
    gsap.from(lead.lines, {
      y: 42, opacity: 0, duration: 1, stagger: .07, ease: 'power3.out',
      scrollTrigger: { trigger: '#aboutLead', start: 'top 82%' }
    });
    var fh = new SplitText('#footerH', { type: 'words' });
    gsap.from(fh.words, {
      yPercent: 70, opacity: 0, duration: .9, stagger: .05, ease: 'power4.out',
      scrollTrigger: { trigger: '#footerH', start: 'top 85%' }
    });
  }else{
    gsap.from('#aboutLead', { y: 40, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '#aboutLead', start: 'top 82%' } });
    gsap.from('#footerH', { y: 40, opacity: 0, duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '#footerH', start: 'top 85%' } });
  }

  gsap.from('#aboutContact', {
    autoAlpha: 0, y: 18, filter: 'blur(6px)', duration: .9, ease: 'power3.out',
    clearProps: 'filter',
    scrollTrigger: { trigger: '#aboutContact', start: 'top 92%', once: true }
  });
  gsap.from('.foot-base', {
    autoAlpha: 0, y: 16, duration: 1, ease: 'power3.out',
    scrollTrigger: { trigger: '.foot-base', start: 'top 96%', once: true }
  });
}

/* ---------- counters ---------- */
function runCounters(scope){
  (scope || document).querySelectorAll('[data-count]').forEach(function(el){
    var end = +el.dataset.count;
    var suf = el.dataset.suffix || '';
    if(!hasGsap || reduced){ el.textContent = end + suf; return; }
    var obj = { v: 0 };
    gsap.to(obj, {
      v: end, duration: 1.8, ease: 'power3.out',
      onUpdate: function(){ el.textContent = Math.round(obj.v) + suf; }
    });
  });
}

/* ---------- grid cards ---------- */
function bindCards(initial){
  if(!hasGsap || reduced) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card'));
  if(!cards.length) return;
  if(initial){
    gsap.set(cards, { y: 36, opacity: 0 });
    ScrollTrigger.batch(cards, {
      start: 'top 94%', once: true,
      onEnter: function(batch){
        gsap.to(batch, { y: 0, opacity: 1, duration: 1, stagger: .07, ease: 'power3.out', overwrite: true });
      }
    });
  }else{
    gsap.set(cards, { y: 28, opacity: 0 });
    gsap.to(cards, { y: 0, opacity: 1, duration: .8, stagger: .045, ease: 'power3.out', overwrite: true });
  }
}

/* ---------- magnetic ---------- */
function setupMagnetic(){
  if(!fine || !hasGsap || reduced) return;
  document.querySelectorAll('[data-magnetic]').forEach(function(el){
    el.addEventListener('pointermove', function(e){
      var r = el.getBoundingClientRect();
      gsap.to(el, {
        x: (e.clientX - r.left - r.width / 2) * 0.3,
        y: (e.clientY - r.top - r.height / 2) * 0.45,
        duration: .5, ease: 'power3.out'
      });
    });
    el.addEventListener('pointerleave', function(){
      gsap.to(el, { x: 0, y: 0, duration: .8, ease: 'elastic.out(1,.45)' });
    });
  });
}

/* ---------- custom cursor ---------- */
function setupCursor(){
  if(!fine || reduced || !hasGsap) return;
  document.body.classList.add('has-cursor');
  var dot = document.getElementById('cursorDot');
  var ring = document.getElementById('cursorRing');
  var label = document.getElementById('cursorLabel');
  var pos = { x: innerWidth / 2, y: innerHeight / 2 };
  var rp = { x: pos.x, y: pos.y };
  var s = 1, sTarget = 1;

  window.addEventListener('pointermove', function(e){
    pos.x = e.clientX; pos.y = e.clientY;
    dot.style.opacity = ring.style.opacity = '1';
  }, { passive: true });
  document.addEventListener('pointerdown', function(){ sTarget = .82; });
  document.addEventListener('pointerup', function(){ sTarget = 1; });
  document.addEventListener('pointerover', function(e){
    var t = e.target.closest && e.target.closest('a, button, [role="button"], .card, [data-cursor]');
    if(!t){
      ring.classList.remove('is-hover', 'is-label');
      return;
    }
    var lbl = t.getAttribute('data-cursor');
    if(lbl){
      label.textContent = lbl;
      ring.classList.add('is-label');
      ring.classList.remove('is-hover');
    }else{
      ring.classList.add('is-hover');
      ring.classList.remove('is-label');
    }
  });
  document.addEventListener('mouseleave', function(){
    dot.style.opacity = ring.style.opacity = '0';
  });

  gsap.ticker.add(function(){
    rp.x += (pos.x - rp.x) * 0.16;
    rp.y += (pos.y - rp.y) * 0.16;
    s += (sTarget - s) * 0.2;
    dot.style.transform = 'translate(' + pos.x + 'px,' + pos.y + 'px)';
    ring.style.transform = 'translate(' + rp.x + 'px,' + rp.y + 'px) scale(' + s.toFixed(3) + ')';
  });
}

/* ---------- timecode ---------- */
function setupClock(){
  var tc = document.getElementById('tcClock');
  if(!tc) return;
  var t0 = Date.now();
  setInterval(function(){
    var ms = Date.now() - t0;
    var f = Math.floor(ms / 1000 * 24) % 24;
    var s = Math.floor(ms / 1000) % 60;
    var m = Math.floor(ms / 60000) % 60;
    var h = Math.floor(ms / 3600000) % 24;
    tc.textContent = 'TC ' + pad(h) + ':' + pad(m) + ':' + pad(s) + ':' + pad(f);
  }, 42);
}

/* ---------- reveal after preloader ---------- */
function revealIn(){
  if(!hasGsap || reduced){
    document.querySelectorAll('#siteHeader, #heroTitleWrap, #heroName, #heroLoc, #heroAvail, #heroMeta, #heroScroll, .hero-frame, .marquee')
      .forEach(function(el){ el.style.opacity = '1'; });
    runCounters(document.getElementById('heroMeta'));
    return;
  }
  var tl = gsap.timeline({ defaults: { ease: 'power4.out' } });
  tl.fromTo('#siteHeader', { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, 0)
    .fromTo('#heroTitleWrap', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, .14)
    .fromTo('#heroName', { y: 44, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1 }, .3)
    .fromTo('#heroLoc', { y: 26, opacity: 0 }, { y: 0, opacity: 1, duration: .9 }, .46)
    .fromTo('#heroAvail', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: .9 }, .52)
    .fromTo('#heroMeta', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1 }, .58)
    .fromTo('#heroScroll', { opacity: 0 }, { opacity: 1, duration: 1.2 }, .9)
    .fromTo('.hero-frame', { opacity: 0 }, { opacity: 1, duration: 1.4 }, .7)
    .fromTo('.marquee', { yPercent: 100 }, { yPercent: 0, duration: 1, ease: 'power3.out' }, .6)
    .add(function(){ runCounters(document.getElementById('heroMeta')); }, .58);
}

/* ---------- active nav highlighting ---------- */
function setupActiveNav(){
  if(!('IntersectionObserver' in window)) return;
  var links = Array.prototype.slice.call(document.querySelectorAll('header nav a'));
  var byId = {};
  links.forEach(function(a){
    var id = (a.getAttribute('href') || '').replace('#', '');
    if(id) byId[id] = a;
  });
  var nio = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting && byId[en.target.id]){
        links.forEach(function(a){ a.classList.remove('active'); });
        byId[en.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  Object.keys(byId).forEach(function(id){
    var s = document.getElementById(id);
    if(s) nio.observe(s);
  });
}

function init(){
  setupLenis();
  setupHeader();
  setupMarquee();
  setupChoreo();
  setupReveals();
  setupMagnetic();
  setupCursor();
  setupClock();
  setupActiveNav();
  bindCards(true);
  document.addEventListener('gallery:render', function(){ bindCards(false); });
  if(hasGsap) ScrollTrigger.refresh();
}

return {
  init: init,
  stop: stop,
  start: start,
  revealIn: revealIn,
  bindCards: bindCards
};
})();
