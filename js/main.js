/* ============================================================
   MAIN — boot order: motion init → preloader → hero intro
   ============================================================ */
(function(){
'use strict';
var hasGsap = !!(window.gsap && window.ScrollTrigger);
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var pre = document.getElementById('preloader');
var t0 = performance.now();
var MIN = 1500;          // minimum time the loader stays up
var opened = false;

function pad(n){ return String(n).padStart(2, '0'); }

/* preloader timecode */
var preTc = document.getElementById('preTc');
var clockStart = Date.now();
var clockIv = setInterval(function(){
  if(opened || !preTc){ clearInterval(clockIv); return; }
  var ms = Date.now() - clockStart;
  var f = Math.floor(ms / 1000 * 24) % 24;
  preTc.textContent = 'LOADING REEL — TC 00:' + pad(Math.floor(ms / 60000) % 60) + ':' +
    pad(Math.floor(ms / 1000) % 60) + ':' + pad(f);
}, 42);

function hardOpen(){
  if(opened) return;
  opened = true;
  if(pre) pre.style.display = 'none';
  document.body.classList.remove('is-loading');
  if(window.__hero) window.__hero.playIntro();
  if(window.Motion) Motion.revealIn();
}

function boot(){
  document.body.classList.add('is-loading');
  if(window.Motion) Motion.init();

  /* no animation stack (CDN blocked / reduced motion): open fast */
  if(!hasGsap || reduced){
    var p = window.__hero ? window.__hero.ready : Promise.resolve(true);
    Promise.race([p, new Promise(function(r){ setTimeout(r, 2500); })])
      .then(function(){ setTimeout(hardOpen, 150); });
    return;
  }

  var countEl = document.getElementById('preCount');
  var bar = document.getElementById('preBar');
  var cnt = { v: 0 };
  function draw(){ 
    countEl.textContent = String(Math.round(cnt.v)).padStart(3, '0');
    bar.style.transform = 'scaleX(' + (cnt.v / 100).toFixed(4) + ')';
  }
  var warm = gsap.to(cnt, {
    v: 92, duration: MIN / 1000 * 0.92, ease: 'power1.inOut', onUpdate: draw
  });

  var heroP = window.__hero ? window.__hero.ready : Promise.resolve(true);
  var minTime = new Promise(function(r){ setTimeout(r, MIN); });
  var fonts = document.fonts ? document.fonts.ready : Promise.resolve();

  Promise.all([fonts, heroP, minTime]).then(function(){
    warm.kill();
    gsap.to(cnt, {
      v: 100, duration: .35, ease: 'power1.in', onUpdate: draw,
      onComplete: function(){
        var tl = gsap.timeline({ onComplete: function(){ pre.style.display = 'none'; } });
        tl.to('.pre-core', { opacity: 0, y: -18, duration: .4, ease: 'power2.in' })
          .to('.pre-top', { yPercent: -100, duration: .95, ease: 'power4.inOut' }, '-=.05')
          .to('.pre-bot', { yPercent: 100, duration: .95, ease: 'power4.inOut' }, '<')
          .add(hardOpen, '-=.55');
      }
    });
  });

  /* safety: never trap the user behind the loader */
  setTimeout(hardOpen, 8000);
}

boot();
})();
