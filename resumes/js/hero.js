/* ============================================================
   RESUME HERO — Raw WebGL scene (stateless, no dependencies)
   Holographic globe + plexus edges + orbit rings + silk streams + dust.
   Includes timecode clock & marquee setup.
   ============================================================ */
(function(){
'use strict';
var canvas = document.getElementById('heroCanvas');
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* timecode clock */
var tc = document.getElementById('tcClock');
if(tc){
  var t0 = Date.now();
  function pad(n){ return String(n).padStart(2, '0'); }
  setInterval(function(){
    var ms = Date.now() - t0;
    var f = Math.floor(ms / 1000 * 24) % 24;
    var s = Math.floor(ms / 1000) % 60;
    var m = Math.floor(ms / 60000) % 60;
    var h = Math.floor(ms / 3600000) % 24;
    tc.textContent = 'TC ' + pad(h) + ':' + pad(m) + ':' + pad(s) + ':' + pad(f);
  }, 42);
}

/* marquee populate */
var track = document.getElementById('marqueeTrack');
if(track){
  var words = ['RÉSUMÉ 2026', 'MEDIA LEADER', 'FILMMAKER', 'POST PRODUCTION MANAGER', 'VIDEO EDITOR', 'OPERATION MANAGER', 'COLORIST', 'VFX', 'DIRECTING'];
  var seq = words.map(function(w){ return '<span>' + w + '</span><span class="sep">✦</span>'; }).join('');
  track.innerHTML = seq + seq;
}

if(!canvas) return;

var gl = null;
try{
  gl = canvas.getContext('webgl', { alpha:true, antialias:false, depth:false, stencil:false, powerPreference:'high-performance' })
    || canvas.getContext('experimental-webgl');
}catch(e){ gl = null; }
if(!gl){
  if(canvas.parentNode) canvas.parentNode.removeChild(canvas);
  return;
}

var isMobile = window.matchMedia('(max-width: 760px)').matches || !window.matchMedia('(pointer: fine)').matches;
var dpr = Math.min(window.devicePixelRatio || 1, 1.75);

/* ---------- shader helper ---------- */
function makeProgram(vsSrc, fsSrc, attrs, unis){
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
  var o = { prog: p, u: {}, a: {} };
  unis.forEach(function(n){ o.u[n] = gl.getUniformLocation(p, n); });
  attrs.forEach(function(n){ o.a[n] = gl.getAttribLocation(p, n); });
  return o;
}

var GLSL_ROT = [
  'vec3 rotY(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z); }',
  'vec3 rotX(vec3 p, float a){ float c = cos(a), s = sin(a); return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z); }',
  'float hash(float n){ return fract(sin(n)*43758.5453123); }'
].join('\n');

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

var FLAT_FRAG = [
  'precision mediump float;',
  'varying float vAlpha;',
  'varying float vTint;',
  'void main(){',
  '  vec3 col = mix(vec3(1.0), vec3(0.788, 0.949, 0.294), vTint);',
  '  gl_FragColor = vec4(col, vAlpha);',
  '}'
].join('\n');

/* ---------- silk streams (ambient layer) ---------- */
var SILK_VERT = [
  'attribute vec2 aGrid;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uFormed;',
  'uniform float uScroll;',
  'uniform vec2 uMouse;',
  'uniform float uForce;',
  'varying float vAlpha;',
  'varying float vTint;',
  'float hash(float n){ return fract(sin(n)*43758.5453123); }',
  'void main(){',
  '  float x01 = mix(-0.38, 1.22, aGrid.y);',
  '  float px = x01 * uRes.x;',
  '  float rowY = aGrid.x * uRes.y;',
  '  float t = uTime;',
  '  float amp = 12.0 + 6.0 * uFormed + 50.0 * uScroll;',
  '  float wave = sin(px*0.032 + t*1.1 + aGrid.x*43.0)*0.6',
  '             + sin(px*0.015 - t*0.7 + aGrid.x*9.0)*0.4;',
  '  float py = rowY + wave * amp;',
  '  vec2 mpx = vec2((uMouse.x + 1.0) * 0.5 * uRes.x, (1.0 - uMouse.y) * 0.5 * uRes.y);',
  '  vec2 dv = vec2(px, py) - mpx;',
  '  float push = uForce * exp(-dot(dv, dv) * 0.00012);',
  '  py += normalize(dv + vec2(0.0, 0.001)).y * push * 36.0;',
  '  py += uScroll * (40.0 + 70.0 * hash(aGrid.x * 91.7));',
  '  gl_Position = vec4((px / uRes.x) * 2.0 - 1.0, 1.0 - (py / uRes.y) * 2.0, 0.0, 1.0);',
  '  float tw = 0.85 + 0.15 * sin(t * 0.7 + aGrid.x * 21.0);',
  '  vAlpha = mix(0.035, 0.075, hash(aGrid.x * 5.31)) * tw * uFormed * (1.0 - uScroll * 0.85);',
  '  vTint = step(0.95, hash(aGrid.x * 3.7)) * 0.8;',
  '}'
].join('\n');

/* ---------- plexus edges (globe web) ---------- */
var EDGE_VERT = [
  'attribute vec3 aPos;',
  'uniform vec2 uRes;',
  'uniform vec3 uGlobe;',
  'uniform float uRotX;',
  'uniform float uRotY;',
  'uniform float uFormed;',
  'uniform float uScroll;',
  'varying float vAlpha;',
  'varying float vTint;',
  GLSL_ROT,
  'void main(){',
  '  vec3 p = rotX(rotY(aPos, uRotY), uRotX);',
  '  float z01 = (p.z + 1.0) * 0.5;',
  '  float per = 1.0 + p.z * 0.16;',
  '  float px = uGlobe.x + p.x * uGlobe.z * per;',
  '  float py = uGlobe.y - p.y * uGlobe.z * per - uScroll * 60.0;',
  '  gl_Position = vec4((px / uRes.x) * 2.0 - 1.0, 1.0 - (py / uRes.y) * 2.0, 0.0, 1.0);',
  '  float rnd = hash(dot(aPos, vec3(12.9898, 78.233, 37.719)));',
  '  vAlpha = (0.04 + 0.26 * z01) * (0.7 + 0.3 * rnd) * uFormed;',
  '  vTint = step(0.93, fract(rnd * 13.7)) * 0.85;',
  '}'
].join('\n');

/* ---------- orbit rings ---------- */
var RING_VERT = [
  'attribute vec2 aRing;',
  'uniform vec2 uRes;',
  'uniform vec3 uGlobe;',
  'uniform float uTime;',
  'uniform float uFormed;',
  'uniform float uScroll;',
  'varying float vAlpha;',
  'varying float vTint;',
  GLSL_ROT,
  'void main(){',
  '  float u = aRing.x;',
  '  float ang = aRing.y * 6.28318 + uTime * (0.22 + 0.18 * hash(u * 17.0)) * (hash(u * 31.0) > 0.5 ? 1.0 : -1.0);',
  '  float rr = uGlobe.z * (1.14 + 0.26 * u);',
  '  vec3 p = vec3(cos(ang) * rr, 0.0, sin(ang) * rr);',
  '  float tilt = 0.35 + 1.05 * hash(u * 7.0);',
  '  p = rotX(p, tilt + 0.08 * sin(uTime * 0.3 + u * 9.0));',
  '  p = rotY(p, uTime * 0.1 * (0.5 + hash(u * 3.0)));',
  '  float z01 = clamp((p.z / (uGlobe.z * 1.45) + 1.0) * 0.5, 0.0, 1.0);',
  '  float px = uGlobe.x + p.x;',
  '  float py = uGlobe.y - p.y - uScroll * 60.0;',
  '  gl_Position = vec4((px / uRes.x) * 2.0 - 1.0, 1.0 - (py / uRes.y) * 2.0, 0.0, 1.0);',
  '  vAlpha = (0.05 + 0.11 * z01) * (0.6 + 0.4 * hash(u * 5.0)) * uFormed;',
  '  vTint = step(0.93, hash(u * 11.0)) * 0.85;',
  '}'
].join('\n');

/* ---------- globe nodes ---------- */
var NODE_VERT = [
  'attribute vec3 aPos;',
  'attribute vec4 aSeed;',
  'uniform vec2 uRes;',
  'uniform vec3 uGlobe;',
  'uniform float uRotX;',
  'uniform float uRotY;',
  'uniform float uTime;',
  'uniform float uFormed;',
  'uniform float uScroll;',
  'uniform float uDPR;',
  'varying float vAlpha;',
  'varying float vTint;',
  GLSL_ROT,
  'void main(){',
  '  vec3 p = rotX(rotY(aPos, uRotY), uRotX);',
  '  float z01 = (p.z + 1.0) * 0.5;',
  '  float per = 1.0 + p.z * 0.16;',
  '  float px = uGlobe.x + p.x * uGlobe.z * per;',
  '  float py = uGlobe.y - p.y * uGlobe.z * per - uScroll * 60.0;',
  '  gl_Position = vec4((px / uRes.x) * 2.0 - 1.0, 1.0 - (py / uRes.y) * 2.0, 0.0, 1.0);',
  '  float depth = 0.7 + 0.3 * hash(aSeed.x * 9.7);',
  '  float orb = step(0.94, hash(aSeed.y * 7.7));',
  '  float tw = 0.85 + 0.15 * sin(uTime * (1.2 + hash(aSeed.z * 3.3) * 2.0) + aSeed.w * 40.0);',
  '  gl_PointSize = ((1.5 + z01 * 2.0) * depth + orb * 3.4) * uDPR * (0.6 + 0.4 * uFormed);',
  '  vAlpha = (0.3 + 0.7 * z01) * tw * uFormed;',
  '  vTint = step(0.93, hash(aSeed.w * 3.7)) * 0.9;',
  '}'
].join('\n');

/* ---------- ambient dust ---------- */
var DUST_VERT = [
  'attribute vec4 aSeed;',
  'uniform vec2 uRes;',
  'uniform float uTime;',
  'uniform float uFormed;',
  'uniform float uScroll;',
  'uniform vec2 uMouse;',
  'uniform float uForce;',
  'uniform float uDPR;',
  'varying float vAlpha;',
  'varying float vTint;',
  'float hash(float n){ return fract(sin(n)*43758.5453123); }',
  'void main(){',
  '  vec2 pos = (vec2(hash(aSeed.x*91.7), hash(aSeed.y*45.3)) * 2.0 - 1.0) * 1.15;',
  '  float t = uTime;',
  '  pos += vec2(',
  '    sin(t*0.55 + aSeed.z*6.2831) + 0.6*sin(t*1.13 + aSeed.w*6.2831),',
  '    cos(t*0.47 + aSeed.w*6.2831) + 0.6*cos(t*0.91 + aSeed.x*6.2831)',
  '  ) * 0.28;',
  '  pos.y += uScroll * (0.35 + 0.55*hash(aSeed.z*11.1));',
  '  pos.x *= 1.0 + uScroll*0.4;',
  '  vec2 d = pos - uMouse;',
  '  float dist2 = dot(d, d);',
  '  float push = uForce * exp(-dist2*16.0);',
  '  pos += (d/(sqrt(dist2)+0.001)) * push * 0.35;',
  '  gl_Position = vec4(pos, 0.0, 1.0);',
  '  float depth = 0.62 + 0.38*hash(aSeed.w*9.7);',
  '  float orb = step(0.94, hash(aSeed.x*7.7));',
  '  gl_PointSize = (mix(1.4, 2.6, depth) + orb * 3.6) * uDPR * (1.0 + 0.7*push);',
  '  float tw = 0.85 + 0.15*sin(t*(1.5 + hash(aSeed.x*3.3)*2.0) + aSeed.y*40.0);',
  '  vAlpha = mix(0.18, 0.55, hash(aSeed.z*5.31)) * tw * uFormed * (1.0 - uScroll);',
  '  vTint = step(0.93, hash(aSeed.w*3.7)) * 0.9;',
  '}'
].join('\n');

var silk = makeProgram(SILK_VERT, FLAT_FRAG, ['aGrid'], ['uRes','uTime','uFormed','uScroll','uMouse','uForce']);
var edges = makeProgram(EDGE_VERT, FLAT_FRAG, ['aPos'], ['uRes','uGlobe','uRotX','uRotY','uFormed','uScroll']);
var rings = makeProgram(RING_VERT, FLAT_FRAG, ['aRing'], ['uRes','uGlobe','uTime','uFormed','uScroll']);
var nodes = makeProgram(NODE_VERT, GLOW_FRAG, ['aPos','aSeed'], ['uRes','uGlobe','uRotX','uRotY','uTime','uFormed','uScroll','uDPR']);
var dust = makeProgram(DUST_VERT, GLOW_FRAG, ['aSeed'], ['uRes','uTime','uFormed','uScroll','uMouse','uForce','uDPR']);
if(!silk || !edges || !rings || !nodes || !dust) return;

gl.disable(gl.DEPTH_TEST);
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
gl.clearColor(0, 0, 0, 0);

function bindBuf(data){
  var b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

/* silk grid */
var ROWS = isMobile ? 130 : 200, SEGS = isMobile ? 110 : 170;
var silkVerts = ROWS * SEGS * 2;
var sg = new Float32Array(silkVerts * 2);
var vi = 0;
for(var r = 0; r < ROWS; r++){
  var u0 = r / (ROWS - 1);
  for(var s = 0; s < SEGS; s++){
    sg[vi++] = u0; sg[vi++] = s / SEGS;
    sg[vi++] = u0; sg[vi++] = (s + 1) / SEGS;
  }
}
silk.buf = bindBuf(sg);

/* globe geometry: fibonacci sphere nodes + nearest-neighbour edges */
var NODES = isMobile ? 420 : 640;
var gpos = new Float32Array(NODES * 3);
var GA = 2.399963229728653;
for(var i = 0; i < NODES; i++){
  var ny = 1 - 2 * (i + 0.5) / NODES;
  var nr = Math.sqrt(1 - ny * ny);
  var nth = i * GA;
  gpos[i * 3] = nr * Math.cos(nth);
  gpos[i * 3 + 1] = ny;
  gpos[i * 3 + 2] = nr * Math.sin(nth);
}
var K = 3, seen = {}, pairList = [];
for(var a = 0; a < NODES; a++){
  var best = [];
  for(var b = 0; b < NODES; b++){
    if(b === a) continue;
    var dx = gpos[a*3]-gpos[b*3], dy = gpos[a*3+1]-gpos[b*3+1], dz = gpos[a*3+2]-gpos[b*3+2];
    var d2 = dx*dx + dy*dy + dz*dz;
    best.push([d2, b]);
  }
  best.sort(function(p, q){ return p[0] - q[0]; });
  for(var k = 0; k < K; k++){
    var j = best[k][1], lo = Math.min(a, j), hi = Math.max(a, j), key = lo * NODES + hi;
    if(!seen[key]){ seen[key] = 1; pairList.push([lo, hi]); }
  }
}
var edgeVerts = pairList.length * 2;
var ev = new Float32Array(edgeVerts * 3);
for(var e = 0; e < pairList.length; e++){
  var pa = pairList[e][0] * 3, pb = pairList[e][1] * 3;
  ev[e*6]   = gpos[pa];   ev[e*6+1] = gpos[pa+1]; ev[e*6+2] = gpos[pa+2];
  ev[e*6+3] = gpos[pb];   ev[e*6+4] = gpos[pb+1]; ev[e*6+5] = gpos[pb+2];
}
edges.buf = bindBuf(ev);

/* node seeds */
var nseeds = new Float32Array(NODES * 4);
for(var nsi = 0; nsi < nseeds.length; nsi++) nseeds[nsi] = Math.random();
nodes.bufPos = bindBuf(gpos);
nodes.bufSeed = bindBuf(nseeds);

/* orbit rings */
var RINGS = 4, RSEG = isMobile ? 110 : 170;
var ringVerts = RINGS * RSEG * 2;
var rg = new Float32Array(ringVerts * 2);
vi = 0;
for(var ri = 0; ri < RINGS; ri++){
  var ru = ri / (RINGS - 1);
  for(var rs = 0; rs < RSEG; rs++){
    rg[vi++] = ru; rg[vi++] = rs / RSEG;
    rg[vi++] = ru; rg[vi++] = (rs + 1) / RSEG;
  }
}
rings.buf = bindBuf(rg);

/* dust */
var DUST = isMobile ? 1400 : 2600;
var dseeds = new Float32Array(DUST * 4);
for(var dsi = 0; dsi < dseeds.length; dsi++) dseeds[dsi] = Math.random();
dust.buf = bindBuf(dseeds);

/* ---------- state ---------- */
var W = 1, H = 1;
var morph = 1;
var scroll = 0;
var mouse = { x: 0, y: -2, force: 0, last: -1e9 };
var smx = 0, smy = 0;
var inView = true, running = true;
var start = performance.now();
var globe = { x: 0, y: 0, r: 1 };

function resize(){
  var rect = canvas.getBoundingClientRect();
  W = Math.max(1, rect.width);
  H = Math.max(1, rect.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(W * dpr);
  canvas.height = Math.round(H * dpr);
  gl.viewport(0, 0, canvas.width, canvas.height);
  if(isMobile){
    globe.x = W * 0.5;
    globe.y = H * 0.26;
    globe.r = Math.min(W * 0.33, H * 0.16);
  }else{
    globe.x = W * 0.73;
    globe.y = H * 0.43;
    globe.r = Math.min(W * 0.2, H * 0.34);
  }
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

  var formed = Math.max(0, morph * (1 - 0.5 * scroll));

  var vh = window.innerHeight || 1;
  var sy = window.scrollY || window.pageYOffset || 0;
  var st = Math.min(1, Math.max(0, sy / (vh * 0.9)));
  scroll += (st - scroll) * 0.09;

  var f = (now - mouse.last) < 130 ? 1 : 0;
  mouse.force += (f - mouse.force) * 0.08;
  smx += (mouse.x - smx) * 0.03;
  smy += (mouse.y - smy) * 0.03;
  var rotY = t * 0.14 + smx * 0.55;
  var rotX = 0.24 * Math.sin(t * 0.1) + smy * 0.4;
  var breath = 1 + 0.02 * Math.sin(t * 0.5);
  var gx = globe.x, gy = globe.y - scroll * 60, gr = globe.r * breath * (0.8 + 0.2 * formed);

  gl.clear(gl.COLOR_BUFFER_BIT);

  /* silk */
  gl.useProgram(silk.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, silk.buf);
  gl.enableVertexAttribArray(silk.a.aGrid);
  gl.vertexAttribPointer(silk.a.aGrid, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(silk.u.uRes, W, H);
  gl.uniform1f(silk.u.uTime, t);
  gl.uniform1f(silk.u.uFormed, formed);
  gl.uniform1f(silk.u.uScroll, scroll);
  gl.uniform2f(silk.u.uMouse, mouse.x, mouse.y);
  gl.uniform1f(silk.u.uForce, mouse.force);
  gl.drawArrays(gl.LINES, 0, silkVerts);

  /* plexus edges */
  gl.useProgram(edges.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, edges.buf);
  gl.enableVertexAttribArray(edges.a.aPos);
  gl.vertexAttribPointer(edges.a.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.uniform2f(edges.u.uRes, W, H);
  gl.uniform3f(edges.u.uGlobe, gx, gy, gr);
  gl.uniform1f(edges.u.uRotX, rotX);
  gl.uniform1f(edges.u.uRotY, rotY);
  gl.uniform1f(edges.u.uFormed, formed);
  gl.uniform1f(edges.u.uScroll, scroll);
  gl.drawArrays(gl.LINES, 0, edgeVerts);

  /* orbit rings */
  gl.useProgram(rings.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, rings.buf);
  gl.enableVertexAttribArray(rings.a.aRing);
  gl.vertexAttribPointer(rings.a.aRing, 2, gl.FLOAT, false, 0, 0);
  gl.uniform2f(rings.u.uRes, W, H);
  gl.uniform3f(rings.u.uGlobe, gx, gy, gr);
  gl.uniform1f(rings.u.uTime, t);
  gl.uniform1f(rings.u.uFormed, formed);
  gl.uniform1f(rings.u.uScroll, scroll);
  gl.drawArrays(gl.LINES, 0, ringVerts);

  /* globe nodes */
  gl.useProgram(nodes.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, nodes.bufPos);
  gl.enableVertexAttribArray(nodes.a.aPos);
  gl.vertexAttribPointer(nodes.a.aPos, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, nodes.bufSeed);
  gl.enableVertexAttribArray(nodes.a.aSeed);
  gl.vertexAttribPointer(nodes.a.aSeed, 4, gl.FLOAT, false, 0, 0);
  gl.uniform2f(nodes.u.uRes, W, H);
  gl.uniform3f(nodes.u.uGlobe, gx, gy, gr);
  gl.uniform1f(nodes.u.uRotX, rotX);
  gl.uniform1f(nodes.u.uRotY, rotY);
  gl.uniform1f(nodes.u.uTime, t);
  gl.uniform1f(nodes.u.uFormed, formed);
  gl.uniform1f(nodes.u.uScroll, scroll);
  gl.uniform1f(nodes.u.uDPR, dpr);
  gl.drawArrays(gl.POINTS, 0, NODES);

  /* dust */
  gl.useProgram(dust.prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, dust.buf);
  gl.enableVertexAttribArray(dust.a.aSeed);
  gl.vertexAttribPointer(dust.a.aSeed, 4, gl.FLOAT, false, 0, 0);
  gl.uniform2f(dust.u.uRes, W, H);
  gl.uniform1f(dust.u.uTime, t);
  gl.uniform1f(dust.u.uFormed, formed);
  gl.uniform1f(dust.u.uScroll, scroll);
  gl.uniform2f(dust.u.uMouse, mouse.x, mouse.y);
  gl.uniform1f(dust.u.uForce, mouse.force);
  gl.uniform1f(dust.u.uDPR, dpr);
  gl.drawArrays(gl.POINTS, 0, DUST);

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

raf = requestAnimationFrame(tick);
})();
