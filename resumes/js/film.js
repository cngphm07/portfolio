/* ============================================================
   CNGPHM MOTION FILM — browser-native 15 second showreel loop
   Canvas field + kinetic type + brand-system pulse. No media download.
   It never blocks the résumé: users can scroll or enter immediately.
   ============================================================ */
(function(){
'use strict';
var film = document.querySelector('.motion-film');
var canvas = document.getElementById('filmCanvas');
var title = document.querySelector('.film-title');
var eyebrow = document.querySelector('.film-eyebrow');
var discipline = document.querySelector('.film-discipline');
var brands = document.querySelector('.film-branding');
var time = document.getElementById('filmTime');
if(!film || !canvas) return;

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var ctx = canvas.getContext('2d', { alpha: true });
if(!ctx) return;

var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
var W = 1, H = 1, inView = true, raf = 0;
var start = performance.now();
var DURATION = 15000;
var nodes = [];
var mouse = { x: -.4, y: -.2, active: false };

function ease(p){ return p < .5 ? 4*p*p*p : 1-Math.pow(-2*p+2,3)/2; }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }
function phase(t, from, to){ return clamp((t-from)/(to-from), 0, 1); }
function pad(n){ return String(n).padStart(2, '0'); }

function resize(){
  var r = film.getBoundingClientRect();
  W = Math.max(1, r.width);
  H = Math.max(1, r.height);
  dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  canvas.width = Math.round(W*dpr);
  canvas.height = Math.round(H*dpr);
  canvas.style.width = W+'px';
  canvas.style.height = H+'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  makeNodes();
}

function makeNodes(){
  var count = W < 760 ? 58 : 116;
  nodes = Array.from({ length: count }, function(_, i){
    var a = i * 2.3999632297;
    var r = Math.sqrt((i+.5)/count);
    return {
      x: .67 + Math.cos(a)*r*.42,
      y: .43 + Math.sin(a)*r*.64,
      s: .4 + ((i*17)%9)/10,
      seed: (i*41.13)%100
    };
  });
}

function setCopy(t){
  /* 0-3s lockup build, 3-7s scale burst, 7-11s brand system,
     11-15s settle and reset — CSS variables keep all text GPU-driven. */
  var build = ease(phase(t, .2, 2.6));
  var burst = Math.sin(Math.PI*phase(t, 3.1, 6.7));
  var settle = ease(phase(t, 10.8, 13.3));
  var pulse = 1 + burst*.035 - settle*.018;
  var dx = (1-build)*-42 + Math.sin(t*1.8)*burst*6;
  title.style.transform = 'translate3d('+dx.toFixed(2)+'px,0,0) scale('+pulse.toFixed(4)+')';
  title.style.opacity = String(.22 + build*.78);
  eyebrow.style.transform = 'translate3d('+((1-build)*-18).toFixed(2)+'px,0,0)';
  eyebrow.style.opacity = String(build);
  discipline.style.transform = 'translate3d('+((1-build)*18).toFixed(2)+'px,0,0)';
  discipline.style.opacity = String(build);
  brands.style.transform = 'translate3d(0,'+(-5 + (1-build)*22).toFixed(2)+'%,0)';
  brands.style.opacity = String(.16 + build*.84);
  film.style.setProperty('--film-flash', String(burst*.52));
  film.style.setProperty('--film-shift', String(Math.sin(t*.6)*.5+.5));
}

function draw(now){
  raf = requestAnimationFrame(draw);
  if(!inView || document.hidden) return;
  var elapsed = reduced ? 7500 : (now-start)%DURATION;
  var t = elapsed/1000;
  var p = elapsed/DURATION;
  var build = ease(phase(t, .1, 2.7));
  var burst = Math.sin(Math.PI*phase(t, 3, 6.7));
  var brandPhase = ease(phase(t, 7.1, 10.4));
  var reset = phase(t, 13.9, 15);

  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  /* breathable lime/white field */
  var gx = W*(.70 + mouse.x*.035), gy = H*(.44 + mouse.y*.035);
  var grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(W,H)*.56);
  grad.addColorStop(0, 'rgba(201,242,75,'+(.035+burst*.045)+')');
  grad.addColorStop(.38, 'rgba(255,255,255,.016)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,W,H);

  /* orbit ribbons */
  for(var ring=0; ring<4; ring++){
    var cx = W*(.7 + mouse.x*.025);
    var cy = H*(.45 + mouse.y*.025);
    var rx = W*(.13+ring*.048)*(1+burst*.08);
    var ry = H*(.12+ring*.042)*(1+burst*.08);
    ctx.beginPath();
    for(var a=0;a<=Math.PI*2+.04;a+=.04){
      var ang = a+t*(.16+ring*.035)*(ring%2?1:-1)+ring*1.13;
      var x = cx+Math.cos(ang)*rx;
      var y = cy+Math.sin(ang)*ry*.38+Math.cos(ang*2+t)*H*.015;
      if(a===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.strokeStyle = ring===1 ? 'rgba(201,242,75,'+(.08+burst*.12)+')' : 'rgba(255,255,255,'+(.025+burst*.035)+')';
    ctx.lineWidth = ring===1 ? 1.1 : .65;
    ctx.stroke();
  }

  /* plexus nodes and links: forms over 0-3 sec, pulse around 3-7 */
  for(var i=0;i<nodes.length;i++){
    var n = nodes[i];
    var x = W*(.5+(n.x-.5)*build);
    var y = H*(.5+(n.y-.5)*build);
    n.px = x; n.py = y;
  }
  for(var a=0;a<nodes.length;a++){
    var na=nodes[a];
    for(var b=a+1;b<nodes.length;b++){
      var nb=nodes[b];
      var dx=na.px-nb.px, dy=na.py-nb.py, dist=dx*dx+dy*dy;
      if(dist < W*W*.012){
        var alpha=(1-dist/(W*W*.012))*(.025+build*.09+burst*.05);
        ctx.beginPath(); ctx.moveTo(na.px,na.py); ctx.lineTo(nb.px,nb.py);
        ctx.strokeStyle = (a+b)%11===0 ? 'rgba(201,242,75,'+alpha+')' : 'rgba(255,255,255,'+alpha+')';
        ctx.lineWidth=.55; ctx.stroke();
      }
    }
  }
  for(var j=0;j<nodes.length;j++){
    var nd=nodes[j];
    var flicker=.6+.4*Math.sin(t*2.4+nd.seed);
    var radius=(1+nd.s*1.7+burst*1.3)*build;
    ctx.beginPath(); ctx.arc(nd.px,nd.py,radius,0,Math.PI*2);
    ctx.fillStyle = j%13===0 ? 'rgba(201,242,75,'+(.28*flicker*build)+')' : 'rgba(255,255,255,'+(.18*flicker*build)+')';
    ctx.fill();
  }

  /* scanline wipe reveals brand-system segment at 7-10 sec */
  if(brandPhase>0){
    var scanX = W*(.18+brandPhase*.72);
    var lg = ctx.createLinearGradient(scanX-W*.12,0,scanX+W*.12,0);
    lg.addColorStop(0,'rgba(0,0,0,0)');
    lg.addColorStop(.48,'rgba(201,242,75,'+(.08*brandPhase)+')');
    lg.addColorStop(.5,'rgba(255,255,255,'+(.32*brandPhase)+')');
    lg.addColorStop(.52,'rgba(201,242,75,'+(.08*brandPhase)+')');
    lg.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=lg; ctx.fillRect(scanX-W*.12,0,W*.24,H);
  }

  /* subtle reset flash near the loop point */
  if(reset>0){
    ctx.fillStyle='rgba(255,255,255,'+(reset*.12)+')';
    ctx.fillRect(0,0,W,H);
  }
  ctx.restore();

  setCopy(t);
  if(time){
    var frames = Math.floor((elapsed/1000*24)%24);
    time.textContent='00:00:'+pad(Math.floor(elapsed/1000)%60)+':'+pad(frames);
  }
}

film.addEventListener('pointermove', function(e){
  var r=film.getBoundingClientRect();
  mouse.x=(e.clientX-r.left)/Math.max(r.width,1)*2-1;
  mouse.y=(e.clientY-r.top)/Math.max(r.height,1)*2-1;
  mouse.active=true;
}, {passive:true});

if('IntersectionObserver' in window){
  new IntersectionObserver(function(entries){ inView=entries[0].isIntersecting; }, {threshold:.02}).observe(film);
}

resize();
window.addEventListener('resize', resize, {passive:true});
raf=requestAnimationFrame(draw);
})();
