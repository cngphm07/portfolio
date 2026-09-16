/* ============================================================
   GALLERY — filters, grid, lightbox (port of v1 behaviour)
   Same data contract: window.PORTFOLIO_DATA from /data.js
   ============================================================ */
(function(){
'use strict';

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
    card.innerHTML =
      (v.thumb ? '<div class="card-media"><img loading="lazy" decoding="async" src="' + v.thumb + '" alt=""></div>' : '<div class="card-media"></div>') +
      '<span class="card-tag mono">' + v.cat + '</span>' +
      '<span class="card-play" aria-hidden="true"></span>' +
      '<figcaption class="card-label">' + v.title + '</figcaption>';
    card.addEventListener('click', function(){ open(i); });
    card.addEventListener('keydown', function(e){
      if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(i); }
    });
    var img = card.querySelector('img');
    if(img){
      if(img.complete && img.naturalWidth > 0) img.classList.add('ld');
      else img.addEventListener('load', function(){ img.classList.add('ld'); });
    }
    frag.appendChild(card);
  });
  grid.innerHTML = '';
  grid.appendChild(frag);
  document.dispatchEvent(new CustomEvent('gallery:render'));
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
