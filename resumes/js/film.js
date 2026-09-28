/* ============================================================
   CNGPHM MOTION FILM — 15-second kinetic logo showreel
   Pure motion graphics at ~120BPM: type slams, deconstruct /
   reassemble, word-cycle, line strips. Letters are DOM (crisp);
   speed-lines live on canvas. Smooth and held, never strobing.
   Loop is non-blocking: ENTER RÉSUMÉ works at any moment.
   ============================================================ */
(function(){
'use strict';
var film = document.querySelector('.motion-film');
var canvas = document.getElementById('filmCanvas');
var eyebrow = document.querySelector('.film-eyebrow');
var letters = Array.prototype.slice.call(document.querySelectorAll('.film-title i'));
var word = document.getElementById('filmWord');
var flashEl = document.querySelector('.film-flash');
var timeEl = document.getElementById('filmTime');
if(!film || !canvas || letters.length !== 6) return;

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduced){
  /* designed static end-card: lockup + tagline, no canvas, no loop */
  if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
  if(flashEl && flashEl.parentNode) flashEl.parentNode.removeChild(flashEl);
  return;
}

var ctx = canvas.getContext('2d', { alpha:true });
if(!ctx){
  if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
  ctx = null;
}

var dpr = 1, W = 1, H = 1;
var DUR = 15000;            /* ms, loop length          */
var clock = 0, last = 0;    /* timeline clock            */
var lastNow = 0;            /* last real draw timestamp  */
var raf = 0, inView = true;
var scatter = [];           /* per-letter scatter targets */
var flashV = 0, flashLime = false, prevT = 0, evIdx = 0;
var lastWordIdx = -1;
var lastScene = 0;

var WORDS = ['MOTION', 'DESIGN', 'FILM', 'BRAND'];
/* flash pulses — rare and purposeful: PHM landing + lime loop frame */
var EVENTS = [
  [2.9, .35, 0],
  [14.55, .7, 1]
];
/* scene boundaries → 8 scenes over 15s */
var SCENE_B = [1.5, 2.2, 4.6, 6.2, 9.2, 11.0, 13.2];

/* ticker strip content: identical halves so translateX(-50%) loops clean */
(function buildStrips(){
  var words = ['CNGPHM', 'MOTION', 'DESIGN', 'FILM', 'BRAND', 'DIRECT', 'EDIT', 'FINISH'];
  var seq = words.map(function(w){ return '<span>' + w + '</span><span class="dot">✦</span>'; }).join('');
  [1, 2, 3].forEach(function(n){
    var el = document.getElementById('filmStrip' + n);
    if(el) el.innerHTML = '<span class="half">' + seq.repeat(3) + '</span><span class="half">' + seq.repeat(3) + '</span>';
  });
})();

function sceneOf(t){
  var s = 1;
  for(var i = 0; i < SCENE_B.length; i++){ if(t >= SCENE_B[i]) s = i + 2; }
  return s;
}

function clamp(n, a, b){ return n < a ? a : n > b ? b : n; }
function phase(t, a, b){ return clamp((t - a) / (b - a), 0, 1); }
function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
function easeIn(t){ return t * t * t; }
function easeInOut(t){ return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; }
function backOut(t){ var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function pad(n){ return String(n).padStart(2, '0'); }

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
  /* letters fly toward screen edges on deconstruct */
  var tx = [-.34, -.47, .36, .42, -.30, .38];
  var ty = [-.30, .33, -.37, .30, .41, -.43];
  var tr = [-24, 18, 26, -18, 14, -22];
  var m = W < 760 ? .68 : 1;
  scatter = letters.map(function(_, i){
    return { x: tx[i] * W * m, y: ty[i] * H * m, r: tr[i] * Math.PI / 180 };
  });
}

/* ---------- per-letter timeline ---------- */
var ENTER = [[0.15, 0.85], [0.62, 1.22], [1.02, 1.62], [2.2, 2.85], [2.35, 3.0], [2.5, 3.15]];

function drawLetters(t){
  var out = easeIn(phase(t, 13.5, 14.75));   /* global wipe-up   */
  var sc = easeIn(phase(t, 4.6, 5.6)) * (1 - easeOut(phase(t, 9.2, 10.4)));
  for(var i = 0; i < 6; i++){
    var e = ENTER[i];
    var pe = phase(t, e[0], e[1]);
    var o, x = 0, y = 0, s = 1, r = 0;
    if(i < 3){ /* C N G — slam from left with back-out */
      x = (1 - backOut(pe)) * -(W * .3 + i * W * .06);
      s = 1 + (1 - pe) * 1.15;
      o = phase(t, e[0], e[0] + .1);
    }else{ /* P H M — drop from above, lime */
      y = (1 - easeOut(pe)) * -(H * .62);
      s = 1 + (1 - pe) * .32;
      r = (1 - pe) * -9;
      o = phase(t, e[0], e[0] + .08);
    }
    x += sc * scatter[i].x;
    y += sc * scatter[i].y;
    r += sc * scatter[i].r;
    s *= 1 - sc * .18;
    y -= out * H * .55;
    o *= 1 - out;
    var st = letters[i].style;
    st.opacity = o.toFixed(3);
    st.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)' +
      ' rotate(' + r.toFixed(2) + 'deg) scale(' + s.toFixed(3) + ')';
  }
  eyebrow.style.opacity = phase(t, .3, 1.2).toFixed(3);
}

/* ---------- word cycle 6.2–9.2 ---------- */
function drawWord(t){
  var on = t >= 6.2 && t < 9.2;
  if(!on){
    if(lastWordIdx !== -1){
      word.style.opacity = '0';
      word.style.setProperty('--wrule', '0');
      lastWordIdx = -1;
    }
    return;
  }
  var idx = clamp(Math.floor((t - 6.2) / .75), 0, 3);
  if(idx !== lastWordIdx){
    word.textContent = WORDS[idx];
    word.classList.toggle('lm', idx % 2 === 1);
    lastWordIdx = idx;
  }
  var cut = (t - 6.2) % .75;
  var punch = easeOut(Math.min(1, cut / .18));
  var xoff = (idx % 2 ? 1 : -1) * 14 * (1 - punch);
  word.style.opacity = '.96';
  word.style.transform = 'translate(calc(-50% + ' + xoff.toFixed(1) + 'px),-50%) scale(' + (1.12 - .12 * punch).toFixed(3) + ')';
  word.style.setProperty('--wrule', easeOut(Math.min(1, cut / .4)).toFixed(3));
}

/* ---------- canvas layer ---------- */
function seeded(n){ return Math.abs((Math.sin(n * 127.1) * 43758.5453) % 1); }

function drawCanvas(t){
  if(!ctx) return;
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* ambient node field, always faintly alive */
  for(var i = 0; i < 42; i++){
    var sx = seeded(i) * W, sy = seeded(i + 50) * H;
    var px = (sx + t * (12 + seeded(i + 9) * 22)) % W;
    var py = (sy + Math.sin(t * .5 + i) * 14 + H) % H;
    ctx.beginPath();
    ctx.arc(px, py, 1 + seeded(i + 3) * 1.6, 0, 6.283);
    ctx.fillStyle = i % 9 === 0 ? 'rgba(201,242,75,.3)' : 'rgba(255,255,255,.16)';
    ctx.fill();
  }

  /* speed-line sweeps only at scene transitions */
  var sweep = (t < 1.7 ? phase(t, 0, 1.7) : 0) ||
              (t >= 4.6 && t < 5.8 ? phase(t, 4.6, 5.8) : 0) ||
              (t >= 9.2 && t < 10.5 ? phase(t, 9.2, 10.5) : 0) ||
              (t >= 13.2 ? phase(t, 13.2, 15) : 0);
  if(sweep > 0){
    for(var l = 0; l < 26; l++){
      var ly = seeded(l + 7) * H;
      var prog = (sweep * (1.3 + seeded(l) * .9) + seeded(l + 2)) % 1;
      var lx = prog * (W + 300) - 150;
      var len = 90 + seeded(l + 5) * 190;
      ctx.beginPath();
      ctx.moveTo(lx, ly); ctx.lineTo(lx + len, ly);
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
  if(ts < prevT) evIdx = 0;               /* loop wrapped */
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

  /* scene engine: data-scene drives CSS (strips, outline) */
  var sc = sceneOf(t);
  if(sc !== lastScene){
    lastScene = sc;
    film.setAttribute('data-scene', String(sc));
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

resize();
window.addEventListener('resize', resize, { passive: true });
play();
})();
