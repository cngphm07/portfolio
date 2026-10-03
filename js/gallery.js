/* ============================================================
   GALLERY — filters, grid, lightbox (port of v1 behaviour)
   Same data contract: window.PORTFOLIO_DATA from /data.js
   ============================================================ */
(function(){
'use strict';

/* generated dot-poster for dark/missing thumbnails — each video gets a
   unique deterministic pattern (wave / rings / diagonal grid) drawn in
   brand colors, so a black first-frame never reads as an empty card */
function hashId(s){
  var h = 2166136261;
  for(var i = 0; i < s.length; i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
var posterCache = {};
function makePoster(id){
  var key = String(id);
  if(posterCache[key]) return posterCache[key];
  var w = 320, h = 180;
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var p = c.getContext('2d');
  if(!p) return '';
  var seed = hashId(key) || 1;
  function rnd(){ seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }
  function dot(x, y, r, col){ p.beginPath(); p.arc(x, y, r, 0, 6.283); p.fillStyle = col; p.fill(); }

  var gx = w * (.3 + rnd() * .4), gy = h * (.3 + rnd() * .4), gr = w * (.18 + rnd() * .12);
  var g = p.createRadialGradient(gx, gy, 0, gx, gy, gr);
  g.addColorStop(0, 'rgba(201,242,75,.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  p.fillStyle = g;
  p.fillRect(0, 0, w, h);

  var variant = Math.floor(rnd() * 3);
  if(variant === 0){
    /* wave rows */
    for(var r = 0; r < 7; r++){
      var by = h * (.14 + r * .12);
      for(var x = 6; x < w; x += 13){
        var y = by + Math.sin(x * .05 + r * 1.7) * 7;
        var lime = rnd() < .1;
        dot(x, y, lime ? 2.4 : 1.5, lime ? 'rgba(201,242,75,.9)' : 'rgba(255,255,255,' + (.4 + rnd() * .45).toFixed(2) + ')');
      }
    }
  }else if(variant === 1){
    /* concentric rings */
    var cx = w * (.4 + rnd() * .2), cy = h * (.42 + rnd() * .16);
    for(var ring = 1; ring <= 5; ring++){
      var rad = ring * 16 + 4, n = Math.floor(rad * 1.2);
      for(var k = 0; k < n; k++){
        var a = k / n * 6.283 + ring;
        var lime2 = rnd() < .12;
        dot(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad * .86, lime2 ? 2.4 : 1.4,
            lime2 ? 'rgba(201,242,75,.9)' : 'rgba(255,255,255,' + (.35 + rnd() * .4).toFixed(2) + ')');
      }
    }
  }else{
    /* diagonal dot grid */
    for(var yy = 8; yy < h; yy += 15){
      for(var xx = 8; xx < w; xx += 15){
        var ox = ((yy / 15) | 0) % 2 ? 7 : 0;
        var lime3 = rnd() < .09;
        dot(xx + ox, yy, lime3 ? 2.4 : 1.3, lime3 ? 'rgba(201,242,75,.85)' : 'rgba(255,255,255,' + (.3 + rnd() * .45).toFixed(2) + ')');
      }
    }
  }
  var url = c.toDataURL('image/png');
  posterCache[key] = url;
  return url;
}

var grid = document.getElementById('grid');
var filtersEl = document.getElementById('filters');
var subFiltersEl = document.getElementById('subFilters');
var lightbox = document.getElementById('lightbox');
var lbFrame = document.getElementById('lbFrame');
var lbTitle = document.getElementById('lbTitle');
var lbIdx = document.getElementById('lbIdx');
var lbStage = document.getElementById('lbStage');
var emptyNote = document.getElementById('emptyNote');
var secCount = document.getElementById('secCount');

if(typeof PORTFOLIO_DATA === 'undefined'){
  if(grid && grid.parentNode){
    var note = document.createElement('p');
    note.className = 'error-note mono';
    note.textContent = 'DATA UNAVAILABLE — /data.js could not be loaded.';
    grid.parentNode.insertBefore(note, grid);
  }
  return;
}

var cats = Object.keys(PORTFOLIO_DATA);
var hasGsap = !!(window.gsap);
var currentList = [];
var currentIdx = 0;

/* helpers for flat vs nested (subfolder) categories */
function isNested(cat){ return !Array.isArray(PORTFOLIO_DATA[cat]); }
function countOf(cat){
  return isNested(cat)
    ? Object.values(PORTFOLIO_DATA[cat]).reduce(function(s, a){ return s + a.length; }, 0)
    : PORTFOLIO_DATA[cat].length;
}
function flattenCat(cat){
  return isNested(cat)
    ? Object.entries(PORTFOLIO_DATA[cat]).flatMap(function(en){
        return en[1].map(function(v){ return Object.assign({}, v, { cat: en[0] }); });
      })
    : PORTFOLIO_DATA[cat].map(function(v){ return Object.assign({}, v, { cat: cat }); });
}

/* build filter buttons: priority categories first, then the rest, All last */
var priority = ['TVC', 'Corporate Film', 'Architecture Film', 'Architecture', 'Documentary Film'];
var orderedCats = priority.filter(function(c){ return cats.includes(c); })
  .concat(cats.filter(function(c){ return !priority.includes(c); }));

orderedCats.forEach(function(cat){
  var b = document.createElement('button');
  b.className = 'filter-btn';
  b.dataset.cat = cat;
  b.innerHTML = cat + '<span class="count">' + countOf(cat) + '</span>';
  filtersEl.appendChild(b);
});
var allBtn = document.createElement('button');
allBtn.className = 'filter-btn';
allBtn.dataset.cat = 'all';
allBtn.innerHTML = 'All<span class="count">' + orderedCats.reduce(function(s, c){ return s + countOf(c); }, 0) + '</span>';
filtersEl.appendChild(allBtn);

/* color / mono grid toggle — livelier resting thumbnails by default,
   full-grayscale cinematic look one click away (persisted) */
var colorOn = true;
try{ colorOn = localStorage.getItem('cngphmGridColor') !== '0'; }catch(e){}
var colorToggle = document.createElement('button');
colorToggle.type = 'button';
colorToggle.className = 'filter-btn color-toggle';
colorToggle.setAttribute('aria-pressed', String(colorOn));
colorToggle.innerHTML = '<span class="sw" aria-hidden="true"></span>COLOR';
function applyGridColor(){
  document.body.classList.toggle('grid-mono', !colorOn);
  colorToggle.classList.toggle('on', colorOn);
  colorToggle.setAttribute('aria-pressed', String(colorOn));
}
colorToggle.addEventListener('click', function(){
  colorOn = !colorOn;
  try{ localStorage.setItem('cngphmGridColor', colorOn ? '1' : '0'); }catch(e){}
  applyGridColor();
});
filtersEl.appendChild(colorToggle);
applyGridColor();

/* initial category from URL (?cat=&sub=) for shareable filtered views */
var params = new URLSearchParams(location.search);
var urlCat = params.get('cat');
var urlSub = params.get('sub');
var startCat = orderedCats.includes(urlCat) ? urlCat : 'TVC';

function setActive(list, btn){
  list.querySelectorAll('.filter-btn').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
}

function syncURL(cat, sub){
  var q = new URLSearchParams();
  if(cat && cat !== 'TVC') q.set('cat', cat);
  if(sub && sub !== 'all') q.set('sub', sub);
  var qs = q.toString();
  history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
}

function buildSubFilters(cat, activeSub){
  subFiltersEl.innerHTML = '';
  if(cat === 'all' || !isNested(cat)){ subFiltersEl.style.display = 'none'; return; }
  subFiltersEl.dataset.cat = cat;
  subFiltersEl.style.display = 'flex';
  var rows = [['all', 'All', countOf(cat)]].concat(
    Object.entries(PORTFOLIO_DATA[cat]).map(function(en){ return [en[0], en[0], en[1].length]; })
  );
  rows.forEach(function(r){
    var b = document.createElement('button');
    b.className = 'filter-btn';
    b.dataset.sub = r[0];
    b.innerHTML = r[1] + '<span class="count">' + r[2] + '</span>';
    if(r[0] === activeSub) b.classList.add('active');
    subFiltersEl.appendChild(b);
  });
}

function renderList(cat, sub){
  if(cat === 'all'){
    currentList = orderedCats.flatMap(flattenCat);
  }else if(sub && sub !== 'all' && isNested(cat) && PORTFOLIO_DATA[cat][sub]){
    currentList = PORTFOLIO_DATA[cat][sub].map(function(v){ return Object.assign({}, v, { cat: sub }); });
  }else{
    currentList = flattenCat(cat);
  }
  fillGrid();
  secCount.textContent = currentList.length + ' FILMS';
}

function setCat(cat, sub){
  setActive(filtersEl, filtersEl.querySelector('[data-cat="' + cat + '"]'));
  buildSubFilters(cat, sub || 'all');
  renderList(cat, sub);
  syncURL(cat, sub);
}

filtersEl.addEventListener('click', function(e){
  var btn = e.target.closest('.filter-btn');
  if(!btn) return;
  setCat(btn.dataset.cat, 'all');
});
subFiltersEl.addEventListener('click', function(e){
  var btn = e.target.closest('.filter-btn');
  if(!btn) return;
  setActive(subFiltersEl, btn);
  renderList(subFiltersEl.dataset.cat, btn.dataset.sub);
  syncURL(subFiltersEl.dataset.cat, btn.dataset.sub);
});

function fillGrid(){
  emptyNote.style.display = currentList.length ? 'none' : 'block';
  var frag = document.createDocumentFragment();
  currentList.forEach(function(v, i){
    var card = document.createElement('figure');
    card.className = 'card';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    card.dataset.cursor = 'PLAY';
    card.setAttribute('aria-label', 'Play: ' + v.title);
    var usePoster = !v.thumb || v.thumbDark;
    var src = usePoster ? makePoster(v.id || String(i)) : v.thumb;
    card.innerHTML =
      '<div class="card-media"><img loading="lazy" decoding="async" referrerpolicy="no-referrer" src="' + src + '" alt=""></div>' +
      '<span class="card-tag mono">' + v.cat + '</span>' +
      '<span class="card-play" aria-hidden="true"></span>' +
      '<figcaption class="card-label">' + v.title + '</figcaption>';
    card.addEventListener('click', function(){ open(i); });
    card.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(i); }
    });
    var img = card.querySelector('img');
    if(usePoster){
      /* generated dot-poster: always ready, keeps the dimmed play affordance */
      card.classList.add('no-thumb');
      img.classList.add('ld');
    }else{
      wireThumb(card, img, v);
    }
    frag.appendChild(card);
  });
  grid.innerHTML = '';
  grid.appendChild(frag);
  document.dispatchEvent(new CustomEvent('gallery:render'));
}

/* thumbnail lifecycle: fade in on load, retry on error (Drive rate-limits
   burst requests), designed fallback when the thumb never arrives */
function wireThumb(card, img, v){
  var tries = 0;
  function markLoaded(){
    card.classList.add('has-thumb');
    img.classList.add('ld');
  }
  img.addEventListener('load', markLoaded);
  img.addEventListener('error', function(){
    if(tries < 2){
      tries++;
      setTimeout(function(){
        img.src = v.thumb + (v.thumb.indexOf('?') > -1 ? '&' : '?') + 'r=' + tries;
      }, 900 * tries + Math.random() * 900);
    }else{
      card.classList.add('no-thumb');
      img.remove();
    }
  });
  if(img.complete && img.naturalWidth > 0) markLoaded();
}

/* ---------- lightbox ---------- */
function open(i){
  currentIdx = i;
  var v = currentList[i];
  lbFrame.src = 'https://drive.google.com/file/d/' + v.id + '/preview';
  lbTitle.textContent = v.title + ' — ' + v.cat;
  lbIdx.textContent = pad3(i + 1) + ' / ' + pad3(currentList.length);
  lightbox.classList.add('open');
  if(window.Motion) Motion.stop();
  else document.body.style.overflow = 'hidden';
  if(hasGsap){
    gsap.fromTo(lightbox, { opacity: 0 }, { opacity: 1, duration: .35, ease: 'power2.out' });
    gsap.fromTo(lbStage, { opacity: 0, y: 26, scale: .97 }, { opacity: 1, y: 0, scale: 1, duration: .6, ease: 'power3.out' });
  }
  document.getElementById('lbClose').focus({ preventScroll: true });
}
function close(){
  function done(){
    lightbox.classList.remove('open');
    lbFrame.removeAttribute('src');
    if(window.Motion) Motion.start();
    else document.body.style.overflow = '';
  }
  if(hasGsap){
    gsap.to(lbStage, { opacity: 0, y: 16, duration: .3, ease: 'power2.in' });
    gsap.to(lightbox, { opacity: 0, duration: .3, ease: 'power2.in', onComplete: done });
  }else done();
}
function pad3(n){ return String(n).padStart(3, '0'); }
function step(d){ open((currentIdx + d + currentList.length) % currentList.length); }

document.getElementById('lbClose').addEventListener('click', close);
document.getElementById('lbPrev').addEventListener('click', function(){ step(-1); });
document.getElementById('lbNext').addEventListener('click', function(){ step(1); });
lightbox.addEventListener('click', function(e){ if(e.target === lightbox) close(); });
document.addEventListener('keydown', function(e){
  if(!lightbox.classList.contains('open')) return;
  if(e.key === 'Escape') close();
  if(e.key === 'ArrowLeft') step(-1);
  if(e.key === 'ArrowRight') step(1);
});

/* ---------- boot ---------- */
setCat(startCat, startCat !== 'TVC' ? (urlSub && urlSub !== 'all' ? urlSub : 'all') : 'all');
})();
