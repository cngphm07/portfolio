/* ============================================================
   CNGPHM DOT FILM — homepage intro controller (5 seconds)
   The animation itself runs in the resume-style WebGL hero
   (js/hero.js): the same Fibonacci nodes evolve
   grid → wave → vortex → rotating plexus globe.
   This controller owns only the clock, HUD, final logo,
   the lime wipe and the handoff to the hero intro.
   ============================================================ */
(function(){
'use strict';
window.__filmStarted = true;
window.__filmGate = true;
var film = document.getElementById('filmOverlay');
if(!film){
  window.__filmGate = false;
  document.documentElement.classList.remove('film-hold');
  return;
}
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced || document.body.classList.contains('no-webgl')){
  /* reduced motion or no WebGL: skip the film, show the hero now */
  var h0 = hero();
  if(h0) h0.finishFilm();
  window.__filmGate = false;
  film.remove();
  document.documentElement.classList.remove('film-hold');
  return;
}
var DUR = 5000;
var clock = 0, last = 0, raf = 0, ended = false, readyWait = 0;
var logo = document.getElementById('filmLogo');
var timeEl = document.getElementById('filmTime');
var skipBtn = document.getElementById('filmSkip');

function hero(){ return window.__hero && window.__hero.setFilmTime ? window.__hero : null; }
function pad(n){ return String(n).padStart(2, '0'); }
function phase(t, a, b){ return Math.max(0, Math.min(1, (t-a)/(b-a))); }
function easeIn(t){ return t*t*t; }
function easeOut(t){ return 1-Math.pow(1-t,3); }

function finish(){
  if(ended) return;
  ended = true;
  cancelAnimationFrame(raf);
  var h = hero();
  if(h) h.finishFilm();
  window.__filmGate = false;
  film.classList.add('film-wipe-run');
  document.documentElement.classList.remove('film-hold');
  /* reveal the résumé hero content as the wipe crosses the frame */
  if(window.Motion) window.Motion.revealIn();
  setTimeout(function(){
    film.classList.add('film-end');
    setTimeout(function(){ film.style.display = 'none'; }, 900);
  }, 500);
}

function update(now){
  if(!last) last = now;
  var dt = Math.min(50, now-last);
  last = now;
  clock += dt;
  var h = hero();
  if(!h){
    /* WebGL unavailable: skip the film, hero fallback handles the intro */
    finish();
    return;
  }
  h.setFilmTime(clock);
  var t = clock / 1000;

  /* CNGPHM logo payoff once the globe has formed (2.4s - 4.4s) */
  if(logo){
    var p = phase(t, 2.4, 3.0) * (1 - easeIn(phase(t, 4.25, 4.7)));
    logo.style.opacity = p.toFixed(3);
    logo.style.transform = 'translate(-50%,-50%) scale(' + (1.16 - .16*easeOut(phase(t, 2.4, 2.9))).toFixed(3) + ')';
  }
  if(timeEl) timeEl.textContent = '00:00:' + pad(Math.floor(t)%60) + ':' + pad(Math.floor(t*24)%24);

  if(clock >= DUR){ finish(); return; }
  raf = requestAnimationFrame(update);
}

if(reduced){
  var h0 = hero();
  if(h0) h0.finishFilm();
  film.remove();
  document.documentElement.classList.remove('film-hold');
  return;
}

if(skipBtn) skipBtn.addEventListener('click', finish);
raf = requestAnimationFrame(update);
})();
