/* ============================================================
   CNGPHM MOTION FILM — 15-second showreel, 4 sub-sequences
   Seq 1–3 are pure motion styles (type / forms / techviz); the
   CNGPHM wordmark appears ONLY in the final logo reveal, then
   everything hands off to the résumé hero (deployed end frame).
   Letters are DOM (crisp); backdrops live on canvas. Skippable.
   ============================================================ */
(function(){
'use strict';
window.__filmStarted = true;
var film = document.getElementById('filmOverlay');
var canvas = document.getElementById('filmCanvas');
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

/* ---------- timeline ----------
   0   pre-roll (black + label)
   1   0.4–4.2   · kinetic type — word cuts, rules
   2   4.2–7.6   · fluid forms — silk curves + lime orb + ring
   3   7.6–11.0  · blueprint HUD — ticks, crosshair, wireframe globe
   4   11.0–14.2 · logo reveal — CNGPHM slams, holds, exits
   5   14.2–15   · resolve into the hero                        */
var SEQ_B = [0.4, 4.2, 7.6, 11.0, 14.2];
var WORDS1 = ['MOTION', 'DESIGN', 'DIRECT', 'EDIT'];
/* logo reveal: staggered slams at 11.2–13.0 */
var ENTER = [[11.2, 11.7], [11.45, 11.95], [11.7, 12.2], [11.95, 12.45], [12.2, 12.7], [12.45, 12.95]];
var LABELS = ['CNGPHM — MOTION SHOWREEL', 'SEQ 01 · KINETIC TYPE', 'SEQ 02 · FLUID FORMS',
              'SEQ 03 · BLUEPRINT HUD', 'CNGPHM', 'CNGPHM — 2026'];
/* flash pulses — rare and purposeful */
var EVENTS = [
  [4.2, .18, 0],     /* type → forms cut     */
  [7.6, .18, 0],     /* forms → blueprint    */
  [12.98, .3, 0],    /* wordmark assembled   */
  [14.55, .7, 1]     /* lime frame handoff   */
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

/* ---------- letters: hidden until the logo reveal ---------- */
function drawLetters(t){
  var seq = seqOf(t);
  var reveal = seq >= 4 && t < 14.7;
  for(var i = 0; i < 6; i++){
    var o = 0, x = 0, y = 0, s = 1;
    if(reveal){
      var e = ENTER[i];
      var pe = phase(t, e[0], e[1]);
      var fromY = i < 3 ? -H * .62 : H * .62;
      y = (1 - backOut(pe)) * fromY;
      s = 1 + (1 - pe) * .3;
      o = pe > 0 ? 1 : 0;
      /* gentle breath while the lockup holds */
      if(t > 13.0) s *= 1 + .008 * Math.sin((t - 13) * 2.2);
      /* exit: wipe up */
      var exit = easeIn(phase(t, 14.15, 14.6));
      y -= exit * H * .38;
      o *= 1 - exit;
    }
    var st = letters[i].style;
    st.opacity = o.toFixed(3);
    st.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0) scale(' + s.toFixed(3) + ')';
  }
}

/* ---------- kinetic type cuts (seq 1) ---------- */
function drawWord(t){
  var seq = seqOf(t);
  var on = seq === 1 && t >= 0.7;
  if(!on){
    if(lastWordIdx !== -1){
      word.style.opacity = '0';
      word.style.setProperty('--wrule', '0');
      lastWordIdx = -1;
    }
    return;
  }
  var idx = clamp(Math.floor((t - 0.7) / .825), 0, 3);
  if(idx !== lastWordIdx){
    word.textContent = WORDS1[idx];
    word.classList.toggle('lm', idx % 2 === 1);
    lastWordIdx = idx;
  }
  var cut = (t - 0.7) % .825;
  var punch = easeOut(Math.min(1, cut / .22));
  word.style.opacity = '.96';
  word.style.transform = 'translate(-50%,-50%) scale(' + (1.1 - .1 * punch).toFixed(3) + ')';
  word.style.setProperty('--wrule', easeOut(Math.min(1, cut / .45)).toFixed(3));
}

/* ---------- canvas backdrops per sequence ---------- */
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
    /* faint ambient nodes + editorial rules under the word cuts */
    for(var i = 0; i < 42; i++){
      var sx = seeded(i) * W, sy = seeded(i + 50) * H;
      var px = (sx + t * (12 + seeded(i + 9) * 22)) % W;
      var py = (sy + Math.sin(t * .5 + i) * 14 + H) % H;
      ctx.beginPath();
      ctx.arc(px, py, 1 + seeded(i + 3) * 1.4, 0, 6.283);
      ctx.fillStyle = i % 9 === 0 ? 'rgba(201,242,75,.28)' : 'rgba(255,255,255,.14)';
      ctx.fill();
    }
    var rp = easeInOut(phase(t, 1.1, 2.9)) * (1 - easeIn(phase(t, 3.8, 4.2)));
    if(rp > 0){
      [0.3, 0.7].forEach(function(fy, k){
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
    /* fluid: silk curves + drifting lime orb + expanding ring */
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
    var ring = easeInOut(phase(tt, .4, 2.6));
    if(ring > 0 && ring < 1){
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.min(W, H) * (.08 + ring * .3), 0, 6.283);
      ctx.strokeStyle = 'rgba(255,255,255,' + (.3 * (1 - ring)).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  if(seq === 3){
    /* blueprint: measurement ticks + crosshair + wireframe globe */
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

  if(seq >= 4){
    /* logo moment: quiet field so the wordmark carries */
    for(var j = 0; j < 30; j++){
      var qx = seeded(j) * W, qy = seeded(j + 80) * H;
      ctx.beginPath();
      ctx.arc((qx + t * 8) % W, qy, 1 + seeded(j + 3) * 1.2, 0, 6.283);
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      ctx.fill();
    }
    /* short speed-line burst as the letters land */
    var land = (t >= 12.9 && t < 13.8) ? phase(t, 12.9, 13.8) : 0;
    if(land > 0){
      for(var l = 0; l < 18; l++){
        var ly = seeded(l + 7) * H;
        var prog = (land * (1.2 + seeded(l) * .8) + seeded(l + 2)) % 1;
        var lx = prog * (W + 260) - 130;
        ctx.beginPath();
        ctx.moveTo(lx, ly); ctx.lineTo(lx + 120 + seeded(l + 5) * 140, ly);
        ctx.strokeStyle = 'rgba(255,255,255,' + (.2 - land * .1).toFixed(3) + ')';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    /* finale sweep into the handoff */
    var fin = t >= 14.3 ? phase(t, 14.3, 15) : 0;
    if(fin > 0){
      for(var f = 0; f < 26; f++){
        var fy2 = seeded(f + 7) * H;
        var pr = (fin * (1.3 + seeded(f) * .9) + seeded(f + 2)) % 1;
        var fx = pr * (W + 300) - 150;
        ctx.beginPath();
        ctx.moveTo(fx, fy2); ctx.lineTo(fx + 90 + seeded(f + 5) * 190, fy2);
        ctx.strokeStyle = f % 6 === 0 ? 'rgba(201,242,75,' + (.32 - fin * .12).toFixed(3) + ')'
                                       : 'rgba(255,255,255,' + (.18 - fin * .08).toFixed(3) + ')';
        ctx.lineWidth = 1 + seeded(f + 8) * 1.2;
        ctx.stroke();
      }
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
