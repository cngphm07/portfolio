/* ============================================================
   CNGPHM MOTION FILM — 15-second showreel, 4 sub-sequences
   Each sequence demos a different motion-design style on the
   same wordmark, then everything resolves into the résumé hero
   (deployed end frame: globe + lockup). Letters are DOM (crisp),
   per-style backdrops live on canvas. Skippable at any moment.
   ============================================================ */
(function(){
'use strict';
window.__filmStarted = true;
var film = document.getElementById('filmOverlay');
var canvas = document.getElementById('filmCanvas');
var title = document.getElementById('filmTitle');
var eyebrow = document.querySelector('.film-eyebrow');
var letters = Array.prototype.slice.call(document.querySelectorAll('.film-title i'));
var word = document.getElementById('filmWord');
var flashEl = document.querySelector('.film-flash');
var timeEl = document.getElementById('filmTime');
var skipBtn = document.getElementById('filmSkip');
if(!film || !canvas || letters.length !== 6){
  document.documentElement.classList.remove('film-wait');
  return;
}

var ended = false;
function endFilm(){
  if(ended) return;
  ended = true;
  pause();
  if(flashEl) flashEl.style.opacity = '0';
  film.classList.add('film-end');
  /* hero intro takes over and resolves on the end frame */
  document.documentElement.classList.remove('film-wait');
  setTimeout(function(){ film.style.display = 'none'; }, 1150);
}

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced){
  /* no film: hero shows immediately */
  if(film.parentNode) film.parentNode.removeChild(film);
  document.documentElement.classList.remove('film-wait');
  return;
}

var ctx = canvas.getContext('2d', { alpha:true });
if(!ctx){
  if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
  ctx = null;
}

var dpr = 1, W = 1, H = 1;
var DUR = 15000;
var clock = 0, last = 0;
var lastNow = 0;
var raf = 0, inView = true;
var flashV = 0, flashLime = false, prevT = 0, evIdx = 0;
var lastWordIdx = -1, lastSeq = -1;

/* ---------- timeline ---------- */
/* sub-sequence boundaries: 0 pre-roll · 1 swiss · 2 fluid · 3 blueprint · 4 glitch · 5 resolve */
var SEQ_B = [0.4, 4.2, 7.6, 11.0, 14.0];
var WORDS1 = ['DESIGN', 'DIRECT', 'EDIT', 'FINISH'];
var WORDS2 = ['MOTION', 'DESIGN', 'FILM', 'BRAND'];
var LABELS = ['CNGPHM — MOTION SHOWREEL', 'SEQ 01 · SWISS EDITORIAL', 'SEQ 02 · FLUID MOTION',
              'SEQ 03 · BLUEPRINT HUD', 'SEQ 04 · GLITCH CUTS', 'CNGPHM — 2026'];
/* letter slam windows (seq 1) */
var ENTER = [[0.5, 0.95], [0.75, 1.2], [1.0, 1.45], [1.25, 1.7], [1.5, 1.95], [1.75, 2.2]];
/* flash pulses — rare and purposeful */
var EVENTS = [
  [2.25, .22, 0],    /* wordmark assembled            */
  [11.05, .25, 0],   /* glitch cut in                 */
  [13.7, .3, 0],     /* final slam                    */
  [14.62, .7, 1]     /* lime frame before the handoff */
];

function seqOf(t){
  var s = 0;
  for(var i = 0; i < SEQ_B.length; i++){ if(t >= SEQ_B[i]) s = i + 1; }
  return s;
}

function clamp(n, a, b){ return n < a ? a : n > b ? b : n; }
function phase(t, a, b){ return clamp((t - a) / (b - a), 0, 1); }
function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
function easeIn(t){ return t * t * t; }
function easeInOut(t){ return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function backOut(t){ var c = 1.2; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function pad(n){ return String(n).padStart(2, '0'); }
function seeded(n){ return Math.abs((Math.sin(n * 127.1) * 43758.5453) % 1); }

/* ---------- ticker strips ---------- */
(function buildStrips(){
  var words = ['CNGPHM', 'MOTION', 'DESIGN', 'FILM', 'BRAND', 'DIRECT', 'EDIT', 'FINISH'];
  var seq = words.map(function(w){ return '<span>' + w + '</span><span class="dot">✦</span>'; }).join('');
  [1, 2].forEach(function(n){
    var el = document.getElementById('filmStrip' + n);
    if(el) el.innerHTML = '<span class="half">' + seq.repeat(3) + '</span><span class="half">' + seq.repeat(3) + '</span>';
  });
})();

/* ---------- letters: shared element, per-sequence choreography ---------- */
function drawLetters(t){
  var seq = seqOf(t);
  var out = easeIn(phase(t, 14.25, 14.8));
  for(var i = 0; i < 6; i++){
    var o = 1, x = 0, y = 0, s = 1, r = 0;

    if(seq === 0 || (seq === 1 && t < ENTER[i][0])){
      /* not arrived yet */
      o = 0;
    }else if(seq === 1){
      /* swiss slam: C N G drop, P H M rise, staggered */
      var e = ENTER[i];
      var pe = phase(t, e[0], e[1]);
      var fromY = i < 3 ? -H * .62 : H * .62;
      y = (1 - backOut(pe)) * fromY;
      s = 1 + (1 - pe) * .35;
      o = pe > 0 ? 1 : 0;
    }else if(seq === 2){
      /* fluid bob */
      y = Math.sin((t - 4.2) * 2.2 + i * .9) * 10;
    }else if(seq === 3){
      /* blueprint: settle left, room for the wireframe globe */
      x = -W * .05;
      s = .94;
    }else if(seq === 4){
      /* glitch jumps, then the final slam back */
      var slam = easeOut(phase(t, 13.5, 13.95));
      var slot = Math.floor((t - 11) / .33);
      var jx = (seeded(slot * 13 + i * 7) - .5) * 44;
      var jy = (seeded(slot * 29 + i * 3) - .5) * 26;
      x = jx * (1 - slam);
      y = jy * (1 - slam);
      s = 1 + .06 * (1 - slam) * (slot % 2 ? 1 : -1);
    }

    /* resolve hold → slight lift while the overlay dissolves */
    y -= out * H * .3;
    o *= 1 - out;

    var st = letters[i].style;
    st.opacity = o.toFixed(3);
    st.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)' +
      ' rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
  }

  /* fluid tracking breathes only in seq 2 */
  if(seq === 2){
    title.style.letterSpacing = (-.095 + Math.sin((t - 4.2) * 1.5) * .018).toFixed(4) + 'em';
  }else if(title.style.letterSpacing){
    title.style.letterSpacing = '';
  }
}

/* ---------- editorial word cuts (seq 1) ---------- */
function drawWord(t){
  var seq = seqOf(t);
  var on = seq === 1 && t >= 2.6;
  if(!on){
    if(lastWordIdx !== -1){
      word.style.opacity = '0';
      word.style.setProperty('--wrule', '0');
      lastWordIdx = -1;
    }
    return;
  }
  var idx = clamp(Math.floor((t - 2.6) / .4), 0, 3);
  if(idx !== lastWordIdx){
    word.textContent = WORDS1[idx];
    lastWordIdx = idx;
  }
  var cut = (t - 2.6) % .4;
  var punch = easeOut(Math.min(1, cut / .16));
  word.style.opacity = '.96';
  word.style.transform = 'translateX(' + ((1 - punch) * -18).toFixed(1) + 'px)';
  word.style.setProperty('--wrule', easeOut(Math.min(1, cut / .3)).toFixed(3));
}

/* ---------- canvas backdrops per style ---------- */
function drawGlobe(cx, cy, rad, rot){
  ctx.beginPath();
  ctx.arc(cx, cy, rad, 0, 6.283);
  ctx.strokeStyle = 'rgba(255,255,255,.4)';
  ctx.lineWidth = 1;
  ctx.stroke();
  for(var m = 0; m < 3; m++){
    var rx = rad * Math.abs(Math.cos(rot + m * 1.047));
    ctx.beginPath();
    ctx.ellipse(cx, cy, Math.max(1, rx), rad, 0, 0, 6.283);
    ctx.strokeStyle = m === 1 ? 'rgba(201,242,75,.35)' : 'rgba(255,255,255,.22)';
    ctx.stroke();
  }
  for(var lat = -1; lat <= 1; lat++){
    var ly = cy + lat * rad * .5;
    var lw = rad * Math.sqrt(1 - lat * lat * .25);
    ctx.beginPath();
    ctx.moveTo(cx - lw, ly); ctx.lineTo(cx + lw, ly);
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.stroke();
  }
}

function drawCanvas(t){
  if(!ctx) return;
  var seq = seqOf(t);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if(seq <= 1){
    /* faint ambient nodes (swiss keeps the field quiet) */
    for(var i = 0; i < 42; i++){
      var sx = seeded(i) * W, sy = seeded(i + 50) * H;
      var px = (sx + t * (12 + seeded(i + 9) * 22)) % W;
      var py = (sy + Math.sin(t * .5 + i) * 14 + H) % H;
      ctx.beginPath();
      ctx.arc(px, py, 1 + seeded(i + 3) * 1.4, 0, 6.283);
      ctx.fillStyle = i % 9 === 0 ? 'rgba(201,242,75,.28)' : 'rgba(255,255,255,.14)';
      ctx.fill();
    }
    /* editorial rules drawing across at the slams */
    var rp = easeInOut(phase(t, 1.0, 2.6));
    if(rp > 0){
      [0.34, 0.66].forEach(function(fy, k){
        var w = W * .34 * rp;
        var x0 = k === 0 ? W * .06 : W - W * .06 - w;
        ctx.beginPath();
        ctx.moveTo(x0, H * fy); ctx.lineTo(x0 + w, H * fy);
        ctx.strokeStyle = 'rgba(255,255,255,' + (.25 * rp).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }
  }

  if(seq === 2){
    /* fluid: silk curves + drifting lime orb */
    var tt = t - 4.2;
    for(var c = 0; c < 6; c++){
      var base = H * (.18 + c * .13);
      ctx.beginPath();
      for(var x = 0; x <= W; x += Math.max(8, W / 90)){
        var y = base + Math.sin(x * .006 + tt * 1.4 + c * 1.3) * H * .05
                     + Math.sin(x * .0025 - tt * .8 + c) * H * .03;
        if(x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = c === 2 || c === 4 ? 'rgba(201,242,75,' + (.3 - c * .02).toFixed(3) + ')'
                                           : 'rgba(255,255,255,' + (.2 - c * .02).toFixed(3) + ')';
      ctx.lineWidth = c % 3 === 0 ? 1.4 : .8;
      ctx.stroke();
    }
    var ox = W * (.5 + Math.sin(tt * .8) * .24);
    var oy = H * (.42 + Math.cos(tt * .6) * .08);
    var orr = Math.min(W, H) * .17;
    var og = ctx.createRadialGradient(ox, oy, 0, ox, oy, orr);
    og.addColorStop(0, 'rgba(201,242,75,.5)');
    og.addColorStop(.35, 'rgba(201,242,75,.16)');
    og.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = og;
    ctx.fillRect(ox - orr, oy - orr, orr * 2, orr * 2);
  }

  if(seq === 3){
    /* blueprint: measurement ticks + center crosshair + wireframe globe */
    var bt = t - 7.6;
    ctx.strokeStyle = 'rgba(255,255,255,.3)';
    ctx.lineWidth = 1;
    for(var m2 = 0; m2 < 12; m2++){
      var my = H * .1 + m2 * (H * .8 / 11);
      var ml = m2 % 3 === 0 ? 10 : 5;
      ctx.beginPath();
      ctx.moveTo(0, my); ctx.lineTo(ml, my);
      ctx.moveTo(W, my); ctx.lineTo(W - ml, my);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(W / 2 - 14, H / 2); ctx.lineTo(W / 2 + 14, H / 2);
    ctx.moveTo(W / 2, H / 2 - 14); ctx.lineTo(W / 2, H / 2 + 14);
    ctx.strokeStyle = 'rgba(201,242,75,.4)';
    ctx.stroke();
    var grow = easeOut(phase(bt, .3, 1.6));
    drawGlobe(W * .72, H * .44, Math.min(W, H) * (.13 + grow * .1), bt * .9);
  }

  if(seq === 4){
    /* glitch: jumping bars, seeded per slot */
    var slot = Math.floor((t - 11) / .33);
    for(var g = 0; g < 9; g++){
      var gy = seeded(slot * 3 + g) * H;
      var gh = 2 + seeded(slot * 9 + g) * 9;
      var gx = seeded(slot * 5 + g * 2) * W;
      var gw = W * (.1 + seeded(g * 7) * .5);
      ctx.fillStyle = g % 4 === 0 ? 'rgba(201,242,75,' + (.14 + seeded(slot + g) * .12).toFixed(3) + ')'
                                  : 'rgba(255,255,255,' + (.08 + seeded(g * 3) * .1).toFixed(3) + ')';
      ctx.fillRect(gx, gy, gw, gh);
    }
    var ly2 = seeded(slot * 17) * H;
    ctx.fillStyle = 'rgba(255,255,255,.25)';
    ctx.fillRect(0, ly2, W, 1);
  }

  /* finale: full-bleed speed lines into the handoff */
  var sweep = t >= 14 ? phase(t, 14, 15) : 0;
  if(sweep > 0){
    for(var l = 0; l < 26; l++){
      var sy2 = seeded(l + 7) * H;
      var prog = (sweep * (1.3 + seeded(l) * .9) + seeded(l + 2)) % 1;
      var lx = prog * (W + 300) - 150;
      var len = 90 + seeded(l + 5) * 190;
      ctx.beginPath();
      ctx.moveTo(lx, sy2); ctx.lineTo(lx + len, sy2);
      ctx.strokeStyle = l % 6 === 0 ? 'rgba(201,242,75,' + (.32 - sweep * .12).toFixed(3) + ')'
                                     : 'rgba(255,255,255,' + (.18 - sweep * .08).toFixed(3) + ')';
      ctx.lineWidth = 1 + seeded(l + 8) * 1.2;
      ctx.stroke();
    }
  }

  ctx.restore();
}

/* ---------- flash ---------- */
function drawFx(t, dt){
  var ts = t;
  if(ts < prevT){ endFilm(); return; }     /* loop wrapped → resolve into the hero */
  while(evIdx < EVENTS.length && ts >= EVENTS[evIdx][0]){
    if(EVENTS[evIdx][0] > prevT || prevT === 0 || ts < prevT){
      flashV = Math.max(flashV, EVENTS[evIdx][1]);
      flashLime = !!EVENTS[evIdx][2];
    }
    evIdx++;
  }
  prevT = ts;
  flashV *= Math.pow(.86, dt / 16.7);
  if(flashV < .01) flashV = 0;
  if(flashEl) flashEl.style.opacity = flashV.toFixed(3);
  if(flashEl) flashEl.classList.toggle('lime', flashLime && flashV > 0);
  film.style.setProperty('--film-flash', flashV.toFixed(3));
}

/* ---------- main ---------- */
function draw(now){
  if(!last) last = now;
  var dt = Math.min(50, now - last);
  last = now; lastNow = now;
  clock = (clock + dt) % DUR;
  var t = clock / 1000;

  var seq = seqOf(t);
  if(seq !== lastSeq){
    lastSeq = seq;
    film.setAttribute('data-seq', String(seq));
    if(eyebrow) eyebrow.textContent = LABELS[seq];
  }

  drawLetters(t);
  drawWord(t);
  drawCanvas(t);
  drawFx(t, dt);

  if(timeEl){
    timeEl.textContent = '00:00:' + pad(Math.floor(t) % 60) + ':' + pad(Math.floor(t * 24) % 24);
  }
}

function frame(now){
  raf = 0;
  if(!inView || document.hidden) { last = 0; return; }
  draw(now);
  raf = requestAnimationFrame(frame);
}
function play(){ if(!raf){ last = 0; raf = requestAnimationFrame(frame); } }
function pause(){ if(raf){ cancelAnimationFrame(raf); raf = 0; } }

/* watchdog — some embedded webviews throttle rAF to zero while the surface
   is technically visible; keep the reel alive at ~30fps when that happens */
setInterval(function(){
  if(reduced || !inView || document.hidden) return;
  var n = performance.now();
  if(raf && n - lastNow > 200) draw(n);
  else if(!raf) play();
}, 33);

if('IntersectionObserver' in window){
  new IntersectionObserver(function(entries){
    inView = entries[0].isIntersecting;
    if(inView) play(); else pause();
  }, { threshold: .02 }).observe(film);
}else{
  play();
}
document.addEventListener('visibilitychange', function(){
  if(document.hidden) pause(); else if(inView) play();
});

function resize(){
  var r = film.getBoundingClientRect();
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  if(ctx){
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
}

resize();
window.addEventListener('resize', resize, { passive: true });
if(skipBtn) skipBtn.addEventListener('click', endFilm);
play();
})();
