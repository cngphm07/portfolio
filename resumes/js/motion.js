/* ============================================================
   RESUME MOTION — vanilla, zero dependencies
   Scroll reveals, stat counters, header hide/show, active nav,
   custom cursor, magnetic elements. Respects reduced motion.
   ============================================================ */
(function(){
'use strict';
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var fine = window.matchMedia('(pointer: fine)').matches;

/* ---------- stagger delays inside [data-stagger] groups ---------- */
document.querySelectorAll('[data-stagger]').forEach(function(c){
  c.querySelectorAll('[data-reveal]').forEach(function(el, i){
    el.style.setProperty('--d', i);
  });
});

/* ---------- reveal on scroll ---------- */
var reveals = document.querySelectorAll('[data-reveal]');
if(reduced || !('IntersectionObserver' in window)){
  reveals.forEach(function(el){ el.classList.add('in'); });
}else{
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting){
        en.target.classList.add('in');
        io.unobserve(en.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -6% 0px' });
  reveals.forEach(function(el){ io.observe(el); });
}

/* ---------- stat counters ---------- */
function runCounter(el){
  var end = +el.dataset.count;
  var suf = el.dataset.suffix || '';
  if(reduced){ el.textContent = end + suf; return; }
  var t0 = null, dur = 1500;
  function step(ts){
    if(t0 === null) t0 = ts;
    var p = Math.min(1, (ts - t0) / dur);
    var e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(end * e) + (p === 1 ? suf : '');
    if(p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
var counters = document.querySelectorAll('[data-count]');
if(counters.length){
  if(!('IntersectionObserver' in window) || reduced){
    counters.forEach(runCounter);
  }else{
    var cio = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if(en.isIntersecting){
          runCounter(en.target);
          cio.unobserve(en.target);
        }
      });
    }, { threshold: 0.4 });
    counters.forEach(function(el){ cio.observe(el); });
  }
}

/* ---------- header hide/show on scroll ---------- */
var header = document.getElementById('siteHeader');
if(header){
  var lastY = 0;
  window.addEventListener('scroll', function(){
    var y = window.scrollY || 0;
    var d = y - lastY;
    if(y < 90){ header.classList.remove('hide'); }
    else if(d > 4 && y > 140){ header.classList.add('hide'); }
    else if(d < -4){ header.classList.remove('hide'); }
    lastY = y;
  }, { passive: true });
}

/* ---------- active nav highlighting ---------- */
var navLinks = Array.prototype.slice.call(document.querySelectorAll('.site-header nav a'));
var navById = {};
navLinks.forEach(function(a){
  var id = (a.getAttribute('href') || '').replace('#', '');
  if(id) navById[id] = a;
});
if('IntersectionObserver' in window && navLinks.length){
  var nio = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if(en.isIntersecting && navById[en.target.id]){
        navLinks.forEach(function(a){ a.classList.remove('active'); });
        navById[en.target.id].classList.add('active');
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });
  Object.keys(navById).forEach(function(id){
    var s = document.getElementById(id);
    if(s) nio.observe(s);
  });
}

/* ---------- custom cursor (desktop only) ---------- */
if(fine && !reduced){
  var dot = document.getElementById('cursorDot');
  var ring = document.getElementById('cursorRing');
  if(dot && ring){
    document.body.classList.add('has-cursor');
    var px = innerWidth / 2, py = innerHeight / 2, rx = px, ry = py, shown = false;
    window.addEventListener('pointermove', function(e){
      px = e.clientX; py = e.clientY;
      if(!shown){ shown = true; dot.style.opacity = ring.style.opacity = '1'; }
      dot.style.transform = 'translate(' + px + 'px,' + py + 'px)';
    }, { passive: true });
    (function loop(){
      rx += (px - rx) * 0.16;
      ry += (py - ry) * 0.16;
      ring.style.transform = 'translate(' + rx.toFixed(2) + 'px,' + ry.toFixed(2) + 'px)';
      requestAnimationFrame(loop);
    })();
    document.addEventListener('pointerover', function(e){
      var t = e.target.closest && e.target.closest('a, button, [role="button"]');
      ring.classList.toggle('on', !!t);
    });
    document.documentElement.addEventListener('mouseleave', function(){
      dot.style.opacity = ring.style.opacity = '0';
    });
    document.documentElement.addEventListener('mouseenter', function(){
      if(shown) dot.style.opacity = ring.style.opacity = '1';
    });
  }
}

/* ---------- magnetic elements ---------- */
if(fine && !reduced){
  document.querySelectorAll('[data-magnetic]').forEach(function(el){
    el.addEventListener('pointermove', function(e){
      var r = el.getBoundingClientRect();
      var dx = (e.clientX - r.left - r.width / 2) * 0.25;
      var dy = (e.clientY - r.top - r.height / 2) * 0.4;
      el.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)';
    });
    el.addEventListener('pointerleave', function(){
      el.style.transform = '';
    });
  });
}
})();
