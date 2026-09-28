/* ============================================================
   CNGPHM DOT FILM — 15-second controller
   The actual animation lives in the resume WebGL hero: the exact
   same Fibonacci nodes evolve grid → wave → vortex → plexus globe.
   This script owns only timing, HUD, final logo, skip and wipe.
   ============================================================ */
(function(){
'use strict';
window.__filmStarted = true;
var film = document.getElementById('filmOverlay');
var logo = document.getElementById('filmLogo');
var wipe = document.querySelector('.film-wipe');
var timeEl = document.getElementById('filmTime');
var skipBtn = document.getElementById('filmSkip');
if(!film){
  document.documentElement.classList.remove('film-wait');
  return;
}

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var DUR = 5000, clock = 0, last = 0, raf = 0, ended = false;
var readyWait = 0;

function hero(){ return window.__resumeHero; }
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
  film.classList.add('film-wipe-run');
  document.documentElement.classList.remove('film-wait');
  setTimeout(function(){
    film.classList.add('film-end');
    setTimeout(function(){ film.style.display = 'none'; }, 700);
  }, 480);
}

function update(now){
  if(!last) last = now;
  var dt = Math.min(50, now-last);
  last = now;
  clock += dt;
  var h = hero();
  if(!h){
    readyWait += dt;
    if(readyWait > 2400) finish();
    raf = requestAnimationFrame(update);
    return;
  }
  h.setFilmTime(clock);
  var t = clock / 1000;

  /* CNGPHM appears once the globe forms: logo payoff from 2.2s - 4.2s */
  var p = phase(t, 2.2, 2.8) * (1-easeIn(phase(t, 3.8, 4.4)));
  if(logo){
    logo.style.opacity = p.toFixed(3);
    logo.style.transform = 'translate(-50%,-50%) scale(' + (1.16 - .16*easeOut(phase(t,2.2,2.7))).toFixed(3) + ')';
  }
  if(timeEl) timeEl.textContent = '00:00:' + pad(Math.floor(t)%60) + ':' + pad(Math.floor(t*24)%24);

  if(clock >= DUR){ finish(); return; }
  raf = requestAnimationFrame(update);
}

function skip(){
  finish();
}

if(reduced){
  if(hero()) hero().finishFilm();
  film.remove();
  document.documentElement.classList.remove('film-wait');
  return;
}
if(skipBtn) skipBtn.addEventListener('click', skip);
raf = requestAnimationFrame(update);
})();
