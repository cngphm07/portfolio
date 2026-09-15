/* ============================================================
   HERO — "Flux" WebGL scene (raw WebGL1, stateless, no deps)
   Silk streamlines flow across the frame and light up where
   they pass through the FILMMAKER & VIDEOGRAPHER lockup,
   plus a layer of glowing dots. Mask = text canvas texture
   sampled in the vertex shader (vertex texture fetch).
   ============================================================ */
(function(){
'use strict';
var canvas = document.getElementById('heroCanvas');
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function fallback(){
  document.body.classList.add('no-webgl');
  if(canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  window.__hero = { ready: Promise.resolve(false), playIntro: function(){} };
}

if(!canvas){ window.__hero = { ready: Promise.resolve(false), playIntro: function(){} }; return; }

var gl = null;
try{
  gl = canvas.getContext('webgl', { alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'high-performance' })
    || canvas.getContext('experimental-webgl');
}catch(e){ gl = null; }
if(!gl){ fallback(); return; }

var isMobile = window.matchMedia('(max-width: 760px)').matches || !window.matchMedia('(pointer: fine)').matches;
var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
var vtf = gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS) > 0;

/* ---------- text mask canvas (1400 x 400) ---------- */
var SW = 1400, SH = 400;
var textCanvas = document.createElement('canvas');
textCanvas.width = SW; textCanvas.height = SH;

function drawText(){
  var x = textCanvas.getContext('2d', { willReadFrequently: false });
  if(!x) return false;
  x.clearRect(0, 0, SW, SH);
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if('fontStretch' in x){ try{ x.fontStretch = 'expanded'; }catch(e){} }
  var full = SW - 40;
  var lines = [['FILMMAKER', full, 140], ['& VIDEOGRAPHER', full * 0.76, 300]];
  for(var i = 0; i < lines.length; i++){
    var fs = 300;
    x.font = '900 ' + fs + 'px Archivo, sans-serif';
    var w = x.measureText(lines[i][0]).width;
    fs = Math.floor(fs * lines[i][1] / w);
    x.font = '900 ' + fs + 'px Archivo, sans-serif';
    x.fillText(lines[i][0], SW / 2, lines[i][2]);
  }
  return true;
}

/* ---------- shader helper ---------- */
function makeProgram(vsSrc, fsSrc){
  function sh(type, src){
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
      console.warn('[hero] shader:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  var vs = sh(gl.VERTEX_SHADER, vsSrc), fs = sh(gl.FRAGMENT_SHADER, fsSrc);
  if(!vs || !fs) return null;
  var p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if(!gl.getProgramParameter(p, gl.LINK_STATUS)){ console.warn('[hero] link:', gl.getProgramInfoLog(p)); return null; }
  return p;
}

var GLOW_FRAG = [
  'precision mediump float;',
  'varying float vAlpha;',
  'varying float vTint;',
  'void main(){',
  '  float d = length(gl_PointCoord - vec2(0.5));',
  '  float core = smoothstep(0.26, 0.04, d);',
  '  float halo = smoothstep(0.5, 0.14, d);',
  '  vec3 col = mix(vec3(1.0), vec3(0.788, 0.949, 0.294), vTint);',
  '  gl_FragColor = vec4(col, (core + halo * 0.4) * vAlpha);',
  '}'
].join('\n');

/* ---------- line (flux silk) program ---------- */
var LINE_VERT = [
  'attribute vec2 aGrid;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uMorph;',
  'uniform float uScroll;',
  'uniform vec2 uMouse;',
  'uniform float uForce;',
  'uniform vec4 uLock;',
  'uniform sampler2D uMask;',
  'varying float vAlpha;',
  'varying float vTint;',
  'float hash(float n){ return fract(sin(n)*43758.5453123); }',
  'void main(){',
  '  float x01 = mix(-0.38, 1.22, aGrid.y);',
  '  float px = uLock.x + x01 * uLock.z;',
  '  float rowY = uLock.y + aGrid.x * uLock.w;',
  '  float t = uTime;',
  '  float amp = 5.0 + 3.0 * uMorph + 45.0 * uScroll;',
  '  float wave = sin(px*0.035 + t*1.15 + aGrid.x*43.0)*0.6',
  '             + sin(px*0.016 - t*0.75 + aGrid.x*9.0)*0.4;',
  '  float py = rowY + wave * amp;',
  '  vec2 mpx = vec2((uMouse.x + 1.0) * 0.5 * uRes.x, (1.0 - uMouse.y) * 0.5 * uRes.y);',
  '  vec2 dv = vec2(px, py) - mpx;',
  '  float push = uForce * exp(-dot(dv, dv) * 0.00012);',
  '  py += normalize(dv + vec2(0.0, 0.001)).y * push * 36.0;',
  '  py += uScroll * (40.0 + 70.0 * hash(aGrid.x * 91.7));',
  '  gl_Position = vec4((px / uRes.x) * 2.0 - 1.0, 1.0 - (py / uRes.y) * 2.0, 0.0, 1.0);',
  '  vec2 uv = vec2((px - uLock.x) / uLock.z, (py - uLock.y) / uLock.w);',
  '  float inside = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);',
  '  float m = texture2D(uMask, clamp(uv, 0.0, 1.0)).a * inside;',
  '  float formed = smoothstep(0.0, 1.0, uMorph);',
  '  float bright = mix(0.3, 0.95, hash(aGrid.x * 5.31));',
  '  float ambient = 0.05 + 0.025 * sin(t * 0.8 + aGrid.x * 21.0);',
  '  vAlpha = (m * bright * formed + ambient) * (1.0 - uScroll * 0.85);',
  '  vTint = step(0.94, hash(aGrid.x * 3.7)) * 0.85;',
  '}'
].join('\n');

var LINE_FRAG = [
  'precision mediump float;',
  'varying float vAlpha;',
  'varying float vTint;',
  'void main(){',
  '  vec3 col = mix(vec3(1.0), vec3(0.788, 0.949, 0.294), vTint);',
  '  gl_FragColor = vec4(col, vAlpha);',
  '}'
].join('\n');

/* ---------- glowing dots program ---------- */
var POINT_VERT = [
  'attribute vec2 aTarget;',
  'attribute vec4 aSeed;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uMorph;',
  'uniform float uScroll;',
  'uniform vec2 uMouse;',
  'uniform float uForce;',
  'uniform float uDPR;',
  'varying float vAlpha;',
  'varying float vTint;',
  'float hash(float n){ return fract(sin(n)*43758.5453123); }',
  'void main(){',
  '  vec2 scatter = vec2(hash(aSeed.x*91.7), hash(aSeed.y*45.3)) * 2.0 - 1.0;',
  '  float t = uTime;',
  '  vec2 drift = vec2(',
  '    sin(t*0.55 + aSeed.z*6.2831) + 0.6*sin(t*1.13 + aSeed.w*6.2831),',
  '    cos(t*0.47 + aSeed.w*6.2831) + 0.6*cos(t*0.91 + aSeed.x*6.2831)',
  '  ) * 0.30;',
  '  vec2 jitter = vec2(sin(t*2.1 + aSeed.x*61.0), cos(t*1.7 + aSeed.y*53.0)) * 0.005;',
  '  vec2 pos = mix(scatter*1.15 + drift, aTarget + jitter, uMorph);',
  '  pos.y += uScroll * (0.35 + 0.55*hash(aSeed.z*11.1));',
  '  pos.x *= 1.0 + uScroll*0.4;',
  '  vec2 d = pos - uMouse;',
  '  float dist2 = dot(d, d);',
  '  float push = uForce * exp(-dist2*16.0);',
  '  pos += (d/(sqrt(dist2)+0.001)) * push * 0.38;',
  '  pos += vec2(-d.y, d.x) * push * 0.22;',
  '  gl_Position = vec4(pos, 0.0, 1.0);',
  '  float depth = 0.62 + 0.38*hash(aSeed.w*9.7);',
  '  float orb = step(0.93, hash(aSeed.x*7.7));',
  '  gl_PointSize = (mix(2.2, 3.4, uMorph) * (0.75 + 0.5*depth) + orb * 4.5 * uMorph) * uDPR * (1.0 + 0.7*push);',
  '  float tw = 0.9 + 0.1*sin(t*(1.5 + hash(aSeed.x*3.3)*2.0) + aSeed.y*40.0);',
  '  vAlpha = mix(0.4, 0.9, hash(aSeed.z*5.31)) * tw * (0.3 + 0.7*uMorph);',
  '  vTint = step(0.93, hash(aSeed.w*3.7)) * 0.9;',
  '}'
].join('\n');

var lineProg = vtf ? makeProgram(LINE_VERT, LINE_FRAG) : null;
var pointProg = makeProgram(POINT_VERT, GLOW_FRAG);
if(!pointProg || (vtf && !lineProg)){ fallback(); return; }

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
gl.clearColor(0, 0, 0, 0);

/* ---------- line grid buffer (LINES segment pairs) ---------- */
var ROWS = isMobile ? 130 : 210;
var SEGS = isMobile ? 120 : 180;
var lineVertCount = 0;
var aGridLoc = -1, lineU = null, lineBuf = null;
if(lineProg){
  var grid = new Float32Array(ROWS * SEGS * 2 * 2);
  var vi = 0;
  for(var r = 0; r < ROWS; r++){
    var u0 = r / (ROWS - 1);
    for(var s = 0; s < SEGS; s++){
      grid[vi++] = u0; grid[vi++] = s / SEGS;
      grid[vi++] = u0; grid[vi++] = (s + 1) / SEGS;
    }
  }
  lineVertCount = ROWS * SEGS * 2;
  lineBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
  gl.bufferData(gl.ARRAY_BUFFER, grid, gl.STATIC_DRAW);
  aGridLoc = gl.getAttribLocation(lineProg, 'aGrid');
  lineU = {};
  ['uRes','uTime','uMorph','uScroll','uMouse','uForce','uLock','uMask'].forEach(function(n){ lineU[n] = gl.getUniformLocation(lineProg, n); });

  var maskTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, maskTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  lineU._maskTex = maskTex;
}

/* ---------- point dust buffers ---------- */
var MAXP = vtf ? (isMobile ? 2500 : 4500) : (isMobile ? 9000 : 18000);
var seeds = new Float32Array(MAXP * 4);
for(var si = 0; si < seeds.length; si++) seeds[si] = Math.random();
var targets = new Float32Array(MAXP * 2);
var pointDrawCount = 0;

var pTbo = gl.createBuffer(), pSbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, pTbo);
gl.bufferData(gl.ARRAY_BUFFER, targets, gl.DYNAMIC_DRAW);
gl.bindBuffer(gl.ARRAY_BUFFER, pSbo);
gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);

var pU = {}, pAttr = {};
['uRes','uTime','uMorph','uScroll','uMouse','uForce','uDPR'].forEach(function(n){ pU[n] = gl.getUniformLocation(pointProg, n); });
pAttr.target = gl.getAttribLocation(pointProg, 'aTarget');
pAttr.seed = gl.getAttribLocation(pointProg, 'aSeed');

/* ---------- state ---------- */
var W = 1, H = 1;
var points = null;
var built = false;
var morph = reduced ? 1 : 0;
var morphStart = morph, morphTarget = morph, introStart = 0, introDur = 2400;
var scroll = 0;
var mouse = { x: 0, y: -2, force: 0, last: -1e9 };
var inView = true, running = true;
var start = performance.now();
var lock = { x: 0, y: 0, w: 1, h: 1 };

function resize(){
  var rect = canvas.getBoundingClientRect();
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  computeLock();
}

function computeLock(){
  var maxW = Math.min(W * 0.92, 1500);
  var maxH = H * 0.41;
  var s = Math.min(maxW / SW, maxH / SH);
  lock.w = SW * s;
  lock.h = SH * s;
  lock.x = (W - lock.w) / 2;
  lock.y = H * 0.05;
}

/* one unique glowing dot per sampled glyph point (subsampled) */
function buildPoints(){
  var img = textCanvas.getContext('2d').getImageData(0, 0, SW, SH).data;
  var step = 3, pts = [];
  for(var py = 0; py < SH; py += step){
    for(var px = 0; px < SW; px += step){
      if(img[(py * SW + px) * 4 + 3] > 128){
        pts.push(px, py);
      }
    }
  }
  // shuffle, then keep MAXP
  for(var i = pts.length / 2 - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var tx = pts[i * 2]; pts[i * 2] = pts[j * 2]; pts[j * 2] = tx;
    var ty = pts[i * 2 + 1]; pts[i * 2 + 1] = pts[j * 2 + 1]; pts[j * 2 + 1] = ty;
  }
  var n = Math.min(pts.length / 2, MAXP);
  fillPointTargets(pts, n);
}

function fillPointTargets(pts, n){
  if(!n) return;
  var s = lock.w / SW;
  for(var i = 0; i < n; i++){
    var px = lock.x + pts[i * 2] * s;
    var py = lock.y + pts[i * 2 + 1] * s;
    targets[i * 2]     = (px / W) * 2 - 1;
    targets[i * 2 + 1] = 1 - (py / H) * 2;
  }
  pointDrawCount = n;
  gl.bindBuffer(gl.ARRAY_BUFFER, pTbo);
  gl.bufferData(gl.ARRAY_BUFFER, targets, gl.DYNAMIC_DRAW);
}

/* ---------- pointer ---------- */
window.addEventListener('pointermove', function(e){
  if(!inView) return;
  var r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / Math.max(r.width, 1)) * 2 - 1;
  mouse.y = 1 - ((e.clientY - r.top) / Math.max(r.height, 1)) * 2;
  mouse.last = performance.now();
}, { passive: true });

if('IntersectionObserver' in window){
  new IntersectionObserver(function(en){ inView = en[0].isIntersecting; }, { threshold: 0.02 }).observe(canvas);
}

/* ---------- render loop ---------- */
var raf = 0;
function tick(now){
  if(!running) return;
  raf = requestAnimationFrame(tick);
  if(!inView || document.hidden) return;
  var t = (now - start) / 1000;
  if(reduced) t = 12.345;

  if(morphTarget !== morph){
    var p = Math.min(1, (now - introStart) / introDur);
    var e = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
    morph = morphStart + (morphTarget - morphStart) * e;
    if(p >= 1) morph = morphTarget;
  }

  var vh = window.innerHeight || 1;
  var sy = window.scrollY || window.pageYOffset || 0;
  var target = Math.min(1, Math.max(0, sy / (vh * 0.9)));
  scroll += (target - scroll) * 0.09;

  var f = (now - mouse.last) < 130 ? 1 : 0;
  mouse.force += (f - mouse.force) * 0.08;

  gl.clear(gl.COLOR_BUFFER_BIT);

  /* silk streams */
  if(lineProg && lineVertCount){
    gl.useProgram(lineProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuf);
    gl.enableVertexAttribArray(aGridLoc);
    gl.vertexAttribPointer(aGridLoc, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lineU._maskTex);
    gl.uniform1i(lineU.uMask, 0);
    gl.uniform2f(lineU.uRes, W, H);
    gl.uniform1f(lineU.uTime, t);
    gl.uniform1f(lineU.uMorph, Math.max(0, morph * (1 - 0.35 * scroll)));
    gl.uniform1f(lineU.uScroll, scroll);
    gl.uniform2f(lineU.uMouse, mouse.x, mouse.y);
    gl.uniform1f(lineU.uForce, mouse.force * (1 - scroll));
    gl.uniform4f(lineU.uLock, lock.x, lock.y, lock.w, lock.h);
    gl.drawArrays(gl.LINES, 0, lineVertCount);
  }

  /* glowing dots */
  if(pointDrawCount){
    gl.useProgram(pointProg);
    gl.bindBuffer(gl.ARRAY_BUFFER, pTbo);
    gl.enableVertexAttribArray(pAttr.target);
    gl.vertexAttribPointer(pAttr.target, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, pSbo);
    gl.enableVertexAttribArray(pAttr.seed);
    gl.vertexAttribPointer(pAttr.seed, 4, gl.FLOAT, false, 0, 0);
    gl.uniform2f(pU.uRes, W, H);
    gl.uniform1f(pU.uTime, t);
    gl.uniform1f(pU.uMorph, Math.max(0, morph * (1 - 0.55 * scroll)));
    gl.uniform1f(pU.uScroll, scroll);
    gl.uniform2f(pU.uMouse, mouse.x, mouse.y);
    gl.uniform1f(pU.uForce, mouse.force * (1 - scroll));
    gl.uniform1f(pU.uDPR, dpr);
    gl.drawArrays(gl.POINTS, 0, pointDrawCount);
  }

  var op = Math.max(0, 1 - scroll * 1.2);
  var cur = parseFloat(canvas.style.opacity || '1');
  if(Math.abs(cur - op) > 0.01) canvas.style.opacity = op.toFixed(3);
}

/* ---------- boot ---------- */
resize();
var rsz;
window.addEventListener('resize', function(){
  clearTimeout(rsz);
  rsz = setTimeout(resize, 180);
});
canvas.addEventListener('webglcontextlost', function(e){
  e.preventDefault();
  running = false;
  cancelAnimationFrame(raf);
});

var fontsReady = (document.fonts && document.fonts.load)
  ? Promise.all([
      document.fonts.load('900 240px Archivo').catch(function(){}),
      document.fonts.ready
    ]).then(function(){ return true; }).catch(function(){ return true; })
  : Promise.resolve(true);

var ready = fontsReady.then(function(){
  var ok = drawText();
  if(!ok) return false;
  if(lineProg){
    gl.bindTexture(gl.TEXTURE_2D, lineU._maskTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
  }
  buildPoints();
  built = true;
  return true;
});

function playIntro(){
  if(reduced){ morph = morphTarget = 1; return; }
  morphStart = morph;
  morphTarget = 1;
  introStart = performance.now();
}
window.__hero = { ready: ready, playIntro: playIntro };
raf = requestAnimationFrame(tick);
})();
