/* ============================================================
   HERO — GPU particle field (raw WebGL1, stateless, no deps)
   Dust drifts across the frame, converges into the word
   FILMMAKER, repels from the pointer, disperses on scroll.
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

/* ---------- shaders ---------- */
var VERT = [
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
  '  vec2 jitter = vec2(sin(t*2.1 + aSeed.x*61.0), cos(t*1.7 + aSeed.y*53.0)) * 0.0035;',
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
  '  gl_PointSize = (mix(2.4, 3.8, uMorph) * (0.75 + 0.5*depth) + orb * 5.0 * uMorph) * uDPR * (1.0 + 0.7*push);',
  '  float tw = 0.92 + 0.08*sin(t*(1.5 + hash(aSeed.x*3.3)*2.0) + aSeed.y*40.0);',
  '  vAlpha = mix(0.55, 1.0, hash(aSeed.z*5.31)) * tw * (0.35 + 0.65*uMorph);',
  '  vTint = step(0.93, hash(aSeed.w*3.7)) * 0.9;',
  '}'
].join('\n');

var FRAG = [
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

function makeShader(type, src){
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    console.warn('[hero] shader:', gl.getShaderInfoLog(s));
    return null;
  }
  return s;
}
var vs = makeShader(gl.VERTEX_SHADER, VERT);
var fs = makeShader(gl.FRAGMENT_SHADER, FRAG);
if(!vs || !fs){ fallback(); return; }
var prog = gl.createProgram();
gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ fallback(); return; }
gl.useProgram(prog);

var isMobile = window.matchMedia('(max-width: 760px)').matches || !window.matchMedia('(pointer: fine)').matches;
var COUNT = isMobile ? 30000 : 60000; // buffer cap; actual draw count = sampled points
var drawCount = 0;
var dpr = Math.min(window.devicePixelRatio || 1, 1.75);

/* ---------- buffers ---------- */
var seeds = new Float32Array(COUNT * 4);
for(var i = 0; i < seeds.length; i++) seeds[i] = Math.random();
var targets = new Float32Array(COUNT * 2);

var tbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, tbo);
gl.bufferData(gl.ARRAY_BUFFER, targets, gl.DYNAMIC_DRAW);
var aTarget = gl.getAttribLocation(prog, 'aTarget');
gl.enableVertexAttribArray(aTarget);
gl.vertexAttribPointer(aTarget, 2, gl.FLOAT, false, 0, 0);

var sbo = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, sbo);
gl.bufferData(gl.ARRAY_BUFFER, seeds, gl.STATIC_DRAW);
var aSeed = gl.getAttribLocation(prog, 'aSeed');
gl.enableVertexAttribArray(aSeed);
gl.vertexAttribPointer(aSeed, 4, gl.FLOAT, false, 0, 0);

var U = {};
['uRes','uTime','uMorph','uScroll','uMouse','uForce','uDPR'].forEach(function(n){ U[n] = gl.getUniformLocation(prog, n); });

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
gl.clearColor(0, 0, 0, 0);

/* ---------- state ---------- */
var W = 1, H = 1;
var points = null;          // flat [x,y,...] on the sample canvas
var built = false;
var morph = reduced ? 1 : 0;
var morphStart = morph, morphTarget = morph, introStart = 0, introDur = 2200;
var scroll = 0;
var mouse = { x: 0, y: -2, force: 0, last: -1e9 };
var inView = true, running = true;
var start = performance.now();
var SW = 1400, SH = 440;    // sample canvas size

function resize(){
  var rect = canvas.getBoundingClientRect();
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  if(built) fillTargets();
}

function sampleText(){
  var SW = 1400, SH = 400;
  var c = document.createElement('canvas');
  c.width = SW; c.height = SH;
  var x = c.getContext('2d', { willReadFrequently: true });
  if(!x) return null;
  x.fillStyle = '#fff';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if('fontStretch' in x){ try{ x.fontStretch = 'expanded'; }catch(e){} }
  // poster lockup: line 1 full width, line 2 at 76% width for hierarchy
  var full = SW - 40;
  var lines = [['FILMMAKER', full, 140], ['& VIDEOGRAPHER', full * 0.76, 300]];
  lines.forEach(function(ln){
    var fs = 300;
    x.font = '900 ' + fs + 'px Archivo, sans-serif';
    var w = x.measureText(ln[0]).width;
    fs = Math.floor(fs * ln[1] / w);
    x.font = '900 ' + fs + 'px Archivo, sans-serif';
    x.fillText(ln[0], SW / 2, ln[2]);
  });
  var img;
  try{ img = x.getImageData(0, 0, SW, SH).data; }catch(e){ return null; }
  var step = 5, pts = [];
  for(var py = 0; py < SH; py += step){
    for(var px = 0; px < SW; px += step){
      if(img[(py * SW + px) * 4 + 3] > 128){
        pts.push(px + Math.random() * 2.0 - 1.0, py + Math.random() * 2.0 - 1.0);
      }
    }
  }
  // shuffle so the modulo assignment spreads evenly across the glyph
  for(var i = pts.length / 2 - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var tx = pts[i * 2]; pts[i * 2] = pts[j * 2]; pts[j * 2] = tx;
    var ty = pts[i * 2 + 1]; pts[i * 2 + 1] = pts[j * 2 + 1]; pts[j * 2 + 1] = ty;
  }
  return pts;
}

function fillTargets(){
  if(!points || !points.length) return;
  var maxW = Math.min(W * 0.92, 1500);
  var maxH = H * 0.41;
  var s = Math.min(maxW / SW, maxH / SH);
  var ox = (W - SW * s) / 2;
  var oy = H * 0.05; // lockup anchored to the upper area, clear of the name block below
  var n = points.length / 2;
  drawCount = Math.min(n, COUNT);
  for(var i = 0; i < drawCount; i++){
    var k = i * 2; // one unique sample point per particle: LED dot-matrix look
    var px = ox + points[k] * s;
    var py = oy + points[k + 1] * s;
    targets[i * 2]     = (px / W) * 2 - 1;
    targets[i * 2 + 1] = 1 - (py / H) * 2;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, tbo);
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
  new IntersectionObserver(function(en){
    inView = en[0].isIntersecting;
  }, { threshold: 0.02 }).observe(canvas);
}

/* ---------- render loop ---------- */
var raf = 0;
function tick(now){
  if(!running) return;
  raf = requestAnimationFrame(tick);
  if(!inView || document.hidden) return;
  var t = (now - start) / 1000;
  if(reduced) t = 12.345; // frozen: static formed word, no twinkle/jitter

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
  gl.uniform2f(U.uRes, W, H);
  gl.uniform1f(U.uTime, t);
  gl.uniform1f(U.uMorph, Math.max(0, morph * (1 - 0.55 * scroll)));
  gl.uniform1f(U.uScroll, scroll);
  gl.uniform2f(U.uMouse, mouse.x, mouse.y);
  gl.uniform1f(U.uForce, mouse.force * (1 - scroll));
  gl.uniform1f(U.uDPR, dpr);
  gl.drawArrays(gl.POINTS, 0, drawCount);

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
      document.fonts.load('900 230px Archivo').catch(function(){}),
      document.fonts.ready
    ]).then(function(){ return true; }).catch(function(){ return true; })
  : Promise.resolve(true);

var ready = fontsReady.then(function(){
  points = sampleText();
  if(points && points.length){ fillTargets(); built = true; }
  return built;
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
