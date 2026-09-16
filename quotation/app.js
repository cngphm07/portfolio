'use strict';

/* ================= helpers ================= */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = n => Math.round(Math.abs(n) < 1e-9 ? 0 : n).toLocaleString('en-US');
const fmtM = n => ((n || 0) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 }) + 'M';
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function nowISO() { return `${todayYmd()}T${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`; }
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(2);
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}
// Nhận "2000000", "2,000,000", "2.000.000", "2tr", "15m", "500k"
function parseMoney(str) {
  if (typeof str === 'number') return Math.round(str);
  let s = String(str ?? '').trim().toLowerCase().replace(/[,\s]/g, '');
  if (!s) return 0;
  const m = s.match(/^([\d.]*)(tr|m|k)?$/);
  if (!m) return 0;
  let digits = m[1], mult = 1;
  if (m[2] === 'tr' || m[2] === 'm') mult = 1e6;
  else if (m[2] === 'k') mult = 1e3;
  else digits = digits.replace(/\./g, ''); // không có hậu tố => dấu chấm là phân cách nghìn
  const n = parseFloat(digits);
  return isNaN(n) ? 0 : Math.round(n * mult);
}

let toastTimer = null;
function toast(msg, cls) {
  const t = $('#toast');
  t.textContent = msg;
  t.className = 'toast' + (cls ? ' ' + cls : '');
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2200);
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); }
  catch (e) {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (e2) {}
    ta.remove();
  }
  toast('Đã copy vào clipboard');
}

/* ================= chi phí theo dòng (line items) ================= */
const CATS = [
  ['nhanSu', 'Nhân sự'],
  ['thietBi', 'Thiết bị'],
  ['logistic', 'Logistic'],
  ['post', 'Post production'],
];
// sinh các dòng chi phí mặc định từ thông số job + đơn giá mặc định
// auto = key đồng bộ: sửa thông số QUAY/DỰNG hoặc đơn giá mặc định → dòng này tự cập nhật
function generateCosts(spec, rates) {
  const it = (label, qty, price, auto) => ({ id: uid(), label, qty: Math.max(0, num(qty)), price: Math.max(0, num(price)), auto });
  const items = {
    nhanSu: [it('Nhân sự quay (ekip)', spec.days, rates.personnel, 'personnel')],
    thietBi: [it(`Camera (${spec.cameras} máy)`, spec.days, spec.cameras * rates.camera, 'camera')],
    logistic: [], // di chuyển nhập ở ô riêng
    post: [
      it(`Dựng video dài (${spec.minutes} phút)`, 1, spec.minutes * rates.minute, 'minutes'),
      it('Dựng short', spec.shorts, rates.short, 'shorts'),
    ],
  };
  if (spec.sound) items.thietBi.push(it('Âm thanh', spec.days, rates.sound, 'sound'));
  if (spec.drone) items.thietBi.push(it('Flycam', spec.days, rates.drone, 'drone'));
  return items;
}
// đồng bộ các dòng AUTO theo thông số QUAY/DỰNG + đơn giá mặc định (bỏ qua dòng đã sửa tay)
function syncAutoCosts() {
  const c = S.calc, r = S.settings.rates;
  const find = (cat, key) => (c.costs[cat] || []).find(it => it.auto === key);
  const upd = (cat, key, patch) => { const it = find(cat, key); if (it) Object.assign(it, patch); };
  upd('nhanSu', 'personnel', { label: 'Nhân sự quay (ekip)', qty: c.days, price: r.personnel });
  upd('thietBi', 'camera', { label: `Camera (${c.cameras} máy)`, qty: c.days, price: c.cameras * r.camera });
  upd('thietBi', 'sound', { label: 'Âm thanh', qty: c.days, price: r.sound });
  upd('thietBi', 'drone', { label: 'Flycam', qty: c.days, price: r.drone });
  upd('post', 'minutes', { label: `Dựng video dài (${c.minutes} phút)`, qty: 1, price: c.minutes * r.minute });
  upd('post', 'shorts', { label: 'Dựng short', qty: c.shorts, price: r.short });
  const toggle = (key, label, on, price) => {
    const arr = c.costs.thietBi;
    const idx = arr.findIndex(it => it.auto === key);
    if (on && idx === -1) arr.push({ id: uid(), label, qty: c.days, price, auto: key });
    if (!on && idx !== -1) arr.splice(idx, 1);
  };
  toggle('sound', 'Âm thanh', c.sound, r.sound);
  toggle('drone', 'Flycam', c.drone, r.drone);
}
// đảm bảo calc.costs luôn đúng shape; dữ liệu cũ (trước auto-sync) được sinh lại 1 lần
function ensureCalcCosts(st) {
  const c = st.calc;
  if (!c.costs || !c.costs.nhanSu || c.costsVersion !== 6) {
    c.costs = c.archMode ? generateArchCosts(c.arch) : generateCosts(c, st.settings.rates);
    c.costsVersion = 6;
    return;
  }
  CATS.forEach(([cat]) => {
    if (!Array.isArray(c.costs[cat])) c.costs[cat] = [];
    c.costs[cat] = c.costs[cat].filter(it => it && typeof it === 'object').map(it => ({
      id: it.id || uid(), label: String(it.label || ''), qty: num(it.qty), price: num(it.price),
      min: it.min || undefined, auto: it.auto || undefined,
    }));
  });
}
const DEFAULT_RATE_FOR_CAT = { nhanSu: 'personnel', thietBi: 'camera', logistic: 'travel', post: 'minute' };

/* ---- công thức Architecture: phòng × 600K (min 5tr) + máy thêm 3,5tr + phỏng vấn 2,5tr ---- */
const ARCH = { perRoom: 600000, minBase: 5000000, extraCam: 3500000, interview: 2500000 };
// thành tiền của 1 dòng (hỗ trợ mức tối thiểu min)
const itemAmount = it => (it && it.min) ? Math.max(it.qty * it.price, it.min) : (it ? it.qty * it.price : 0);

function generateArchCosts(a) {
  const items = { nhanSu: [], thietBi: [], logistic: [], post: [] };
  items.nhanSu.push({ id: uid(), label: `Quay kiến trúc (${a.rooms} phòng, min 5tr)`, qty: Math.max(0, num(a.rooms)), price: ARCH.perRoom, min: ARCH.minBase, auto: 'archBase' });
  if (a.cams > 0) items.thietBi.push({ id: uid(), label: `Máy quay thêm (${a.cams} máy)`, qty: a.cams, price: ARCH.extraCam, auto: 'archCams' });
  if (a.interview) items.nhanSu.push({ id: uid(), label: 'Phỏng vấn', qty: 1, price: ARCH.interview, auto: 'archInterview' });
  if (a.extra > 0) items.logistic.push({ id: uid(), label: 'Phụ thu khác', qty: 1, price: a.extra, auto: 'archExtra' });
  return items;
}
// đồng bộ các dòng AUTO của công thức kiến trúc theo panel nhập
function syncArchCosts() {
  const a = S.calc.arch;
  const upsert = (cat, key, keep, fields) => {
    const arr = S.calc.costs[cat];
    const idx = arr.findIndex(it => it.auto === key);
    if (!keep) { if (idx !== -1) arr.splice(idx, 1); return; }
    if (idx === -1) arr.push(Object.assign({ id: uid(), auto: key }, fields));
    else Object.assign(arr[idx], fields);
  };
  upsert('nhanSu', 'archBase', a.rooms > 0, { label: `Quay kiến trúc (${a.rooms} phòng, min 5tr)`, qty: Math.max(0, num(a.rooms)), price: ARCH.perRoom, min: ARCH.minBase });
  upsert('thietBi', 'archCams', a.cams > 0, { label: `Máy quay thêm (${a.cams} máy)`, qty: a.cams, price: ARCH.extraCam });
  upsert('nhanSu', 'archInterview', a.interview, { label: 'Phỏng vấn', qty: 1, price: ARCH.interview });
  upsert('logistic', 'archExtra', a.extra > 0, { label: 'Phụ thu khác', qty: 1, price: a.extra });
}

/* ================= state ================= */
const LS_KEY = 'oddpig_baogia_v1';

const DEFAULT_STATE = () => ({
  settings: {
    margin: 40,          // margin mặc định (%)
    minMargin: 30,       // margin tối thiểu (%)
    floorDiscount: 10,   // giá sàn = giá đề xuất × (1 - floorDiscount%)
    rates: {
      personnel: 2000000, // nhân sự / ngày
      camera: 200000,     // mỗi camera / ngày
      sound: 200000,      // âm thanh / ngày
      drone: 200000,      // flycam / ngày
      travel: 500000,     // di chuyển / ngày
      minute: 800000,     // dựng video dài / phút
      short: 100000       // dựng 1 short
    },
    jobTypes: [
      { name: 'TVC',                preset: { days: 2, cameras: 3, sound: true,  drone: true,  minutes: 1,  shorts: 5 } },
      { name: 'Social Content',     preset: { days: 1, cameras: 1, sound: false, drone: false, minutes: 3,  shorts: 30 } },
      { name: 'Marketing Campaign', preset: { days: 3, cameras: 3, sound: true,  drone: true,  minutes: 10, shorts: 30 } },
      { name: 'Architecture',       preset: { days: 2, cameras: 3, sound: true,  drone: true,  minutes: 5,  shorts: 20 }, formula: 'arch' },
      { name: 'House Tour',         preset: { days: 1, cameras: 2, sound: true,  drone: true,  minutes: 8,  shorts: 15 } },
      { name: 'Interview',          preset: { days: 1, cameras: 2, sound: true,  drone: false, minutes: 10, shorts: 10 } }
    ],
    jobTypesVersion: 3,
    sheet: { url: '', token: '' }
  },
  calc: {
    jobType: 'Architecture',
    days: 2, cameras: 3, sound: true, drone: true, minutes: 5, shorts: 20,
    margin: 40, offerRaw: '',
    archMode: true,
    arch: { rooms: 8, cams: 0, interview: false, extra: 0 },
    discount: 0, invoice: false, move: 0, stay: 0
  },
  projects: [],
  ui: { view: 'quote', currentProject: null }
});

let S = null;

function migrate(st) {
  const d = DEFAULT_STATE();
  st.settings = Object.assign({}, d.settings, st.settings);
  st.settings.rates = Object.assign({}, d.settings.rates, st.settings.rates || {});
  st.settings.sheet = Object.assign({ url: '', token: '' }, st.settings.sheet || {});
  if (!Array.isArray(st.settings.jobTypes)) st.settings.jobTypes = d.settings.jobTypes;
  if (!st.settings.jobTypesVersion || st.settings.jobTypesVersion < 2) {
    const have = new Set(st.settings.jobTypes.map(j => j.name));
    d.settings.jobTypes.forEach(j => { if (!have.has(j.name)) st.settings.jobTypes.push(j); });
    st.settings.jobTypesVersion = 2;
  }
  if (st.settings.jobTypesVersion < 3) {
    const archJt = st.settings.jobTypes.find(j => j.name === 'Architecture');
    if (archJt) archJt.formula = 'arch';
    st.settings.jobTypesVersion = 3;
  }
  st.calc = Object.assign({}, d.calc, st.calc || {});
  if (!st.calc.arch) st.calc.arch = { rooms: 8, cams: 0, interview: false, extra: 0 };
  if (typeof st.calc.archMode !== 'boolean') st.calc.archMode = st.calc.jobType === 'Architecture';
  st.ui = Object.assign({}, d.ui, st.ui || {});
  if (!Array.isArray(st.projects)) st.projects = [];
  ensureCalcCosts(st);
  return st;
}

function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) S = JSON.parse(raw);
  } catch (e) { S = null; }
  if (!S || typeof S !== 'object' || !S.settings) { S = DEFAULT_STATE(); ensureCalcCosts(S); seedSample(); return; }
  migrate(S);
  ensureCalcCosts(S);
}

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); } catch (e) {}
}

/* ================= dữ liệu mẫu ================= */
function seedSample() {
  if (S.projects.some(p => p.id === 'sample-abc')) return;
  const mk = (label, date, done, extra) => ({ id: uid(), label, date: date || '', done: !!done, extra: !!extra });
  S.projects.push({
    id: 'sample-abc',
    name: 'ABC Showroom',
    client: 'ABC Group',
    status: 'active',
    createdAt: '2026-08-25T09:00',
    contract: 32000000,
    actualCost: null,
    originalScope: {
      contract: 32000000,
      committedDays: 4,
      deliverables: ['Timelapse', 'Video chính', 'Photos'],
      fromQuote: false,
      frozenAt: '2026-08-25T09:00'
    },
    payments: [
      { id: uid(), label: 'Deposit 50%', amount: 16000000, paid: true,  date: '2026-08-26' },
      { id: uid(), label: 'Final 50%',   amount: 16000000, paid: false, date: '' }
    ],
    shootDays: [
      mk('Day 1', '2026-09-01', true), mk('Day 2', '2026-09-02', true),
      mk('Day 3', '2026-09-03', true), mk('Day 4', '2026-09-04', true),
      mk('Day 5', '2026-09-05', true, true)
    ],
    deliverables: [
      { id: uid(), label: 'Timelapse',   done: true },
      { id: uid(), label: 'Video chính', done: true },
      { id: uid(), label: 'Photos',      done: false },
      { id: uid(), label: 'Interview',   done: true }
    ],
    extras: [
      { id: uid(), label: 'Quay interview riêng',     amount: 2000000, approved: true, date: '2026-09-08' },
      { id: uid(), label: 'Đi lại địa điểm đợt 2',    amount: 500000,  approved: true, date: '2026-09-10' }
    ],
    timeline: [
      { date: '2026-08-25T09:00', kind: 'scope', text: 'Tạo dự án — hợp đồng 32,000,000 ₫, cam kết 4 ngày quay' },
      { date: '2026-08-26T10:30', kind: 'info',  text: 'Nhận thanh toán: Deposit 50% — 16,000,000 ₫' },
      { date: '2026-09-01T18:00', kind: 'info',  text: 'Hoàn thành Day 1' },
      { date: '2026-09-02T18:00', kind: 'info',  text: 'Hoàn thành Day 2' },
      { date: '2026-09-03T18:00', kind: 'info',  text: 'Hoàn thành Day 3' },
      { date: '2026-09-04T18:00', kind: 'info',  text: 'Hoàn thành Day 4' },
      { date: '2026-09-05T20:00', kind: 'scope', text: 'Khách yêu cầu thêm Day 5 — EXTRA (ngoài 4 ngày cam kết)' },
      { date: '2026-09-08T14:00', kind: 'scope', text: 'Thêm extra: Quay interview riêng +2,000,000 ₫' },
      { date: '2026-09-08T14:05', kind: 'scope', text: 'Thêm deliverable: Interview' },
      { date: '2026-09-10T09:30', kind: 'scope', text: 'Thêm extra: Đi lại địa điểm đợt 2 +500,000 ₫' }
    ]
  });
  save();
}

/* ================= calculator ================= */
function computeQuote() {
  const c = S.calc;
  const sum = cat => (c.costs[cat] || []).reduce((s, it) => s + itemAmount(it), 0);
  const nhanSu = sum('nhanSu'), thietBi = sum('thietBi'), logistic = sum('logistic'), post = sum('post');
  const move = num(c.move), stay = num(c.stay);
  const cost = nhanSu + thietBi + logistic + post + move + stay;
  const proposed = cost / (1 - c.margin / 100);
  const afterDiscount = proposed * (1 - (c.discount || 0) / 100);
  const vat = c.invoice ? afterDiscount * 0.2 : 0;
  const total = afterDiscount + vat;
  // tiền vốn (công thức kiến trúc): giá cơ bản + máy quay phụ + di chuyển + lưu trú
  const archBaseIt = c.archMode ? ((c.costs.nhanSu || []).find(it => it.auto === 'archBase') || null) : null;
  const archCamsIt = c.archMode ? ((c.costs.thietBi || []).find(it => it.auto === 'archCams') || null) : null;
  const archBase = itemAmount(archBaseIt);
  const archCams = itemAmount(archCamsIt);
  const von = archBase + archCams + move + stay;
  const profit = total - von;
  const floor = proposed * (1 - S.settings.floorDiscount / 100);
  const floorMargin = floor > 0 ? (floor - cost) / floor * 100 : 0;
  return { nhanSu, thietBi, logistic, post, move, stay, cost, proposed, afterDiscount, vat, total, archBase, archCams, von, profit, floor, floorMargin };
}

function readQuoteInputs() {
  const c = S.calc;
  c.jobType = $('#c_job').value.trim();
  c.days = Math.max(0, num($('#c_days').value));
  c.cameras = Math.max(0, num($('#c_cameras').value));
  c.sound = $('#c_sound').checked;
  c.drone = $('#c_drone').checked;
  c.minutes = Math.max(0, num($('#c_minutes').value));
  c.shorts = Math.max(0, num($('#c_shorts').value));
  c.margin = clamp(num($('#c_margin').value) || S.settings.margin, 1, 95);
  c.discount = clamp(num($('#c_discount').value), 0, 90);
  c.invoice = $('#c_invoice').checked;
  c.move = parseMoney($('#c_move').value);
  c.stay = parseMoney($('#c_stay').value);
  // đơn giá chỉnh trực tiếp trong calculator
  const r = S.settings.rates;
  r.personnel = parseMoney($('#r_personnel').value);
  r.camera = parseMoney($('#r_camera').value);
  r.sound = parseMoney($('#r_sound').value);
  r.drone = parseMoney($('#r_drone').value);
  r.travel = parseMoney($('#r_travel').value);
  r.minute = parseMoney($('#r_minute').value);
  r.short = parseMoney($('#r_short').value);
}

function fillQuoteInputs() {
  const c = S.calc, r = S.settings.rates;
  $('#c_job').value = c.jobType;
  $('#c_days').value = c.days; $('#c_cameras').value = c.cameras;
  $('#c_sound').checked = c.sound; $('#c_drone').checked = c.drone;
  $('#c_minutes').value = c.minutes; $('#c_shorts').value = c.shorts;
  $('#c_margin').value = c.margin;
  $('#r_personnel').value = fmt(r.personnel); $('#r_camera').value = fmt(r.camera);
  $('#r_sound').value = fmt(r.sound); $('#r_drone').value = fmt(r.drone);
  $('#r_travel').value = fmt(r.travel); $('#r_minute').value = fmt(r.minute);
  $('#r_short').value = fmt(r.short);
  $('#n_offer').value = c.offerRaw || '';
  $$('#jobChips .chip').forEach(ch => ch.classList.toggle('active', ch.dataset.name === c.jobType));
  // chế độ công thức kiến trúc: ẩn QUAY/DỰNG + đơn giá, hiện panel riêng
  $('#archPanel').hidden = !c.archMode;
  $('#specSections').hidden = !!c.archMode;
  $('#ratesPanel').hidden = !!c.archMode;
  $('#vonBlock').hidden = !c.archMode;
  $('#a_rooms').value = c.arch.rooms;
  $('#a_cams').value = c.arch.cams;
  $('#a_interview').checked = c.arch.interview;
  $('#a_extra').value = c.arch.extra ? fmt(c.arch.extra) : '';
  $('#a_days').value = c.days;
  $('#c_discount').value = c.discount || 0;
  $('#c_invoice').checked = !!c.invoice;
  $('#c_move').value = c.move ? fmt(c.move) : '';
  $('#c_stay').value = c.stay ? fmt(c.stay) : '';
  renderCostDetail();
}

function refreshQuote() {
  const q = computeQuote(), c = S.calc;
  $('#o_nhanSu').textContent = fmt(q.nhanSu);
  $('#o_thietBi').textContent = fmt(q.thietBi);
  $('#o_logistic').textContent = fmt(q.logistic);
  $('#o_post').textContent = fmt(q.post);
  $('#o_cost').textContent = fmtM(q.cost);
  $('#o_proposed').textContent = fmtM(q.proposed);
  $('#o_proposedFull').textContent = fmt(q.proposed) + ' ₫';
  $('#o_floor').textContent = fmtM(q.floor);
  $('#o_floorFull').textContent = fmt(q.floor) + ' ₫';
  $('#o_floorMargin').textContent = `· margin ${q.floorMargin.toFixed(1)}%`;
  $('#o_afterDisc').textContent = fmtM(q.afterDiscount);
  $('#o_afterDiscFull').textContent = fmt(q.afterDiscount) + ' ₫';
  $('#o_vat').textContent = c.invoice ? '+' + fmtM(q.vat) : '0';
  $('#o_vatFull').textContent = c.invoice ? 'đã cộng VAT 20%' : 'không xuất hoá đơn';
  $('#o_vatNote').textContent = c.invoice ? '+20%' : '— tắt';
  $('#o_total').textContent = fmtM(q.total);
  $('#o_totalFull').textContent = fmt(q.total) + ' ₫';
  $('#o_base').textContent = fmtM(q.cost);
  $('#o_baseFull').textContent = fmt(q.cost) + ' ₫';
  $('#o_von').textContent = fmtM(q.von);
  $('#o_vonFull').textContent = fmt(q.von) + ' ₫';
  const pEl = $('#o_profit');
  pEl.textContent = (q.profit >= 0 ? '+' : '') + fmtM(q.profit);
  pEl.className = q.profit >= 0 ? 'good' : 'bad';
  $('#o_profitFull').textContent = fmt(q.profit) + ' ₫';
  $('#o_profitPct').textContent = q.total > 0 ? (q.profit / q.total * 100).toFixed(1) + '% tổng tiền' : '—';
  renderNeg();
  save();
}

function buildSuggestions(q, offer) {
  const list = [];
  CATS.forEach(([cat, catName]) => {
    (S.calc.costs[cat] || []).forEach(it => {
      const amt = itemAmount(it);
      if (amt > 0) list.push({ key: `del:${cat}:${it.id}`, label: `Bỏ "${it.label || 'hạng mục'}" (${catName})`, save: amt });
      if (it.qty > 1) {
        const save = amt - itemAmount(Object.assign({}, it, { qty: it.qty - 1 }));
        if (save > 0) list.push({ key: `cut:${cat}:${it.id}`, label: `Bớt 1 × "${it.label || 'hạng mục'}"`, save });
      }
    });
  });
  if (!list.length) return '<div class="neg-line">Chưa có hạng mục nào để cắt — thêm dòng ở phần Chi phí chi tiết.</div>';
  list.sort((a, b) => b.save - a.save);
  return list.slice(0, 8).map(it => {
    const newCost = Math.max(0, q.cost - it.save);
    const m = offer > 0 ? (offer - newCost) / offer * 100 : 0;
    const ok = m >= S.settings.minMargin;
    return `<div class="sug ${ok ? 'ok' : ''}">
      <span>${esc(it.label)}</span>
      <span class="sug-save">−${fmt(it.save)} ₫ → margin ${m.toFixed(1)}%</span>
      <button class="btn sm" data-act="apply-cut" data-cut="${it.key}">Áp dụng</button>
    </div>`;
  }).join('');
}

function renderNeg() {
  const out = $('#negOut');
  const offer = parseMoney($('#n_offer').value);
  S.calc.offerRaw = $('#n_offer').value;
  if (!offer) {
    out.innerHTML = '<span class="muted">Nhập giá khách trả để kiểm tra margin &amp; nhận gợi ý giảm scope.</span>';
    return;
  }
  const q = computeQuote();
  const min = S.settings.minMargin;
  const margin = offer > 0 ? (offer - q.cost) / offer * 100 : 0;
  const ok = margin >= min;
  let html = `<div class="neg-verdict ${ok ? 'ok' : 'bad'}"><span class="dot" aria-hidden="true"></span>Margin còn <b>${margin.toFixed(1)}%</b> tại ${fmt(offer)} ₫</div>`;
  html += `<div class="neg-line">Lãi gộp: <b>${fmt(offer - q.cost)} ₫</b> · Cost hiện tại: <b>${fmt(q.cost)} ₫</b> · Margin tối thiểu: <b>${min}%</b></div>`;
  if (ok) {
    html += `<div class="neg-line ok">Đạt margin tối thiểu — có thể cân nhắc chốt.</div>`;
  } else {
    const maxCost = offer * (1 - min / 100);
    const cut = q.cost - maxCost;
    const minPrice = q.cost / (1 - min / 100);
    html += `<div class="neg-line">Không đạt mức margin tối thiểu ${min}%.</div>
      <div class="neg-line">Cost tối đa ở giá này: <b>${fmt(maxCost)} ₫</b> → cần giảm cost <b>${fmt(Math.max(0, cut))} ₫</b></div>
      <div class="neg-line">Hoặc giá tối thiểu để giữ margin ${min}%: <b>${fmt(minPrice)} ₫</b></div>
      <div class="neg-sub">Đề xuất giảm scope thay vì giảm giá:</div>
      ${buildSuggestions(q, offer)}`;
  }
  out.innerHTML = html;
}

function applyCut(key) {
  const [op, cat, id] = key.split(':');
  const arr = S.calc.costs[cat] || [];
  const it = arr.find(x => x.id === id);
  if (!it) return;
  if (op === 'del') {
    S.calc.costs[cat] = arr.filter(x => x.id !== id);
  } else {
    it.qty = Math.max(0, it.qty - 1);
    delete it.auto; // cắt tay bằng gợi ý cũng tắt auto
  }
  renderCostDetail();
  refreshQuote();
  toast('Đã áp dụng — kiểm tra margin mới');
}

function quoteText(q) {
  const c = S.calc;
  const pad = (label, val) => label + ' '.repeat(Math.max(1, 15 - label.length)) + val;
  const sec = (name, items) => [
    `— ${name.toUpperCase()}`,
    ...items.map(it => `  ${it.label || '(hạng mục)'}: ${fmt(it.qty)} x ${fmt(it.price)} = ${fmt(itemAmount(it))}`),
  ];
  return [
    `LOẠI JOB: ${c.jobType || '—'}`,
    `QUAY: ${c.days} ngày · ${c.cameras} camera · âm thanh ${c.sound ? '✓' : '✗'} · flycam ${c.drone ? '✓' : '✗'}`,
    `DỰNG: ${c.minutes} phút video dài · ${c.shorts} short`,
    ``,
    `CHI PHÍ`,
    ...sec('Nhân sự', c.costs.nhanSu),
    ...sec('Thiết bị', c.costs.thietBi),
    ...sec('Logistic', c.costs.logistic),
    ...sec('Post production', c.costs.post),
    `────────────────`,
    pad('COST:', fmt(q.cost)),
    pad('MARGIN:', c.margin + '%'),
    pad('GIÁ BÁN ĐỀ XUẤT:', fmt(q.proposed) + ` (${fmtM(q.proposed)})`),
    pad('GIÁ SÀN:', fmt(q.floor) + ` (${fmtM(q.floor)})`),
    pad('GIẢM GIÁ:', (c.discount || 0) + '%'),
    pad('SAU GIẢM GIÁ:', fmt(q.afterDiscount) + ` (${fmtM(q.afterDiscount)})`),
    pad('HOÁ ĐƠN:', c.invoice ? 'CÓ (+VAT 20%)' : 'KHÔNG'),
    pad('TỔNG TIỀN:', fmt(q.total) + ` (${fmtM(q.total)})`),
    ...(c.archMode ? [
      pad('TỔNG CƠ BẢN:', fmt(q.cost) + ` (${fmtM(q.cost)})`),
      pad('TIỀN VỐN:', fmt(q.von) + ` (${fmtM(q.von)})`),
      pad('LỢI NHUẬN:', fmt(q.profit) + ` (${fmtM(q.profit)})`),
    ] : []),
  ].join('\n');
}

/* ================= Google Sheet (Apps Script) ================= */
function projectSheetPayload(p) {
  const total = projectTotal(p);
  return {
    name: p.name,
    client: p.client || '',
    status: p.status,
    createdAt: p.createdAt,
    contract: p.contract || 0,
    extrasApproved: extrasApprovedTotal(p),
    paid: paidTotal(p),
    actualCost: p.actualCost || 0,
    actualMargin: p.actualCost > 0 ? (total - p.actualCost) / total * 100 : null,
    payments: p.payments.map(x => [x.label, x.amount || 0, x.paid ? 'ĐÃ NHẬN' : 'CHƯA', x.date || '']),
    days: p.shootDays.map(d => [d.label, d.date || '', d.extra ? 'EXTRA' : 'CAM KẾT', d.done ? 'XONG' : 'CHƯA']),
    deliverables: p.deliverables.map(d => [d.label, d.done ? 'XONG' : 'CHƯA']),
    extras: p.extras.map(x => [x.label, x.amount || 0, x.approved ? 'ĐÃ DUYỆT' : 'CHƯA DUYỆT', x.date || '']),
    timeline: p.timeline.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(t => [t.date, t.kind === 'scope' ? 'SCOPE' : '·', t.text]),
    changes: p.timeline.filter(t => t.kind === 'scope').sort((a, b) => String(b.date).localeCompare(String(a.date)))
      .map(t => [t.date, t.text])
  };
}

async function pushToSheet(p) {
  const cfg = S.settings.sheet || {};
  if (!cfg.url) return { ok: false, error: 'not-configured' };
  p.sheetStatus = 'pending';
  save();
  try {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      redirect: 'follow',
      body: JSON.stringify({
        token: cfg.token || '',
        action: p.sheetId ? 'sync' : 'create',
        spreadsheetId: p.sheetId || undefined,
        project: projectSheetPayload(p)
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Phản hồi không hợp lệ');
    p.sheetId = data.spreadsheetId;
    p.sheetUrl = data.url;
    p.sheetStatus = 'ok';
    p.sheetSyncedAt = nowISO();
    delete p.sheetError;
  } catch (err) {
    p.sheetStatus = 'error';
    p.sheetError = String(err.message || err);
  }
  save();
  return { ok: p.sheetStatus === 'ok' };
}

function sheetBtn(p) {
  if (p.sheetStatus === 'pending') return `<button class="btn sm" disabled style="opacity:.5">Đang tạo sheet...</button>`;
  if (p.sheetUrl) {
    return `<a class="btn sm" href="${esc(p.sheetUrl)}" target="_blank" rel="noopener">Google Sheet ↗</a>
      <button class="btn sm" data-act="sync-sheet">Sync sheet</button>`;
  }
  const cfg = S.settings.sheet || {};
  const label = st => st === 'error' ? 'Tạo sheet (lỗi — thử lại)' : '+ Google Sheet';
  if (!cfg.url) {
    return `<button class="btn sm" data-act="sync-sheet" title="Chưa cấu hình Apps Script URL — vào tab Cài đặt">${label(p.sheetStatus)}</button>`;
  }
  return `<button class="btn sm" data-act="sync-sheet">${label(p.sheetStatus)}</button>`;
}

function renderCostDetail() {
  const host = $('#costDetail');
  if (!host) return;
  host.innerHTML = CATS.map(([cat, name]) => {
    const items = S.calc.costs[cat] || [];
    const sub = items.reduce((s, it) => s + itemAmount(it), 0);
    return `<div class="cat">
      <div class="cat-head"><span class="cat-name mono">${name}</span><b class="cat-sub mono">${fmt(sub)}</b></div>
      <div class="cat-cols mono"><span>HẠNG MỤC</span><span>SL</span><span>ĐƠN GIÁ</span><span>THÀNH TIỀN</span><span></span></div>
      ${items.map(it => `<div class="item-row">
        <input class="it-label ${it.auto ? 'it-auto' : ''}" data-act="ci-label" data-cat="${cat}" data-id="${it.id}" value="${esc(it.label)}" placeholder="Hạng mục..." ${it.auto ? `title="AUTO — đồng bộ với thông số Quay/Dựng và đơn giá mặc định"` : ''}>
        <input class="it-qty" type="number" min="0" step="any" data-act="ci-qty" data-cat="${cat}" data-id="${it.id}" value="${it.qty}">
        <input class="it-price money" data-act="ci-price" data-cat="${cat}" data-id="${it.id}" value="${it.price ? fmt(it.price) : ''}" placeholder="0">
        <span class="it-amt">${fmt(itemAmount(it))}</span>
        <button class="icon" data-act="ci-del" data-cat="${cat}" data-id="${it.id}" title="Xóa dòng">✕</button>
      </div>`).join('')}
      <button class="btn sm" data-act="ci-add" data-cat="${cat}" style="margin-top:.55rem">+ Dòng</button>
    </div>`;
  }).join('');
}

/* ================= projects ================= */
const currentProject = () => S.projects.find(p => p.id === S.ui.currentProject) || null;
const extrasApprovedTotal = p => p.extras.filter(e => e.approved).reduce((s, e) => s + (e.amount || 0), 0);
const projectTotal = p => (p.contract || 0) + extrasApprovedTotal(p);
const paidTotal = p => p.payments.filter(x => x.paid).reduce((s, x) => s + (x.amount || 0), 0);

function logEvent(p, text) { p.timeline.push({ date: nowISO(), kind: 'info', text }); }
function logChange(p, text) { p.timeline.push({ date: nowISO(), kind: 'scope', text }); }

function renderProjects() {
  const grid = $('#projectGrid');
  if (!S.projects.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">CHƯA CÓ DỰ ÁN NÀO<br>ẤN "+ TẠO DỰ ÁN" HOẶC TẠO TỪ TAB BÁO GIÁ</div>`;
    return;
  }
  grid.innerHTML = S.projects.map(p => {
    const total = projectTotal(p), paid = paidTotal(p);
    const pct = total ? Math.round(paid / total * 100) : 0;
    const daysDone = p.shootDays.filter(d => d.done).length;
    const extraDays = p.shootDays.filter(d => d.extra).length;
    const extrasN = p.extras.length;
    return `<div class="pcard" data-act="open-project" data-id="${p.id}">
      <div class="pcard-top"><b>${esc(p.name)}</b><span class="badge ${p.status}">${p.status === 'done' ? 'HOÀN THÀNH' : 'ĐANG CHẠY'}</span></div>
      <div class="pcard-client">${esc(p.client || '—')}</div>
      <div class="pcard-num">${fmtM(total)} <span class="muted">· đã thu ${pct}%</span></div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="pcard-meta muted">Quay ${daysDone}/${p.shootDays.length} ngày${extraDays ? ` · ${extraDays} EXTRA` : ''}${extrasN ? ` · ${extrasN} extra` : ''}</div>
    </div>`;
  }).join('');
}

function renderDetail() {
  const p = currentProject();
  if (!p) { showList(); return; }
  const os = p.originalScope || {};
  const committed = os.committedDays ?? p.shootDays.length;
  const extras = extrasApprovedTotal(p);
  const total = projectTotal(p);
  const paid = paidTotal(p);
  const remain = total - paid;
  const actualMargin = p.actualCost > 0 ? (total - p.actualCost) / total * 100 : null;
  const nChanges = p.timeline.filter(t => t.kind === 'scope').length;

  const payRow = x => `<div class="prow">
    <input class="plabel" data-act="pay-label" data-id="${x.id}" value="${esc(x.label)}">
    <input class="money" data-act="pay-amount" data-id="${x.id}" value="${fmt(x.amount)}">
    <label class="chk"><input type="checkbox" data-act="pay-paid" data-id="${x.id}" ${x.paid ? 'checked' : ''}> Đã nhận</label>
    <input type="date" data-act="pay-date" data-id="${x.id}" value="${x.date || ''}">
    <button class="icon" data-act="pay-del" data-id="${x.id}" title="Xóa">✕</button>
  </div>`;

  const dayRow = d => `<div class="prow ${d.done ? 'done' : ''}">
    <span class="dlabel">${esc(d.label)} ${d.extra ? '<span class="badge extra">EXTRA</span>' : ''}</span>
    <label class="chk"><input type="checkbox" data-act="day-done" data-id="${d.id}" ${d.done ? 'checked' : ''}> Xong</label>
    <input type="date" data-act="day-date" data-id="${d.id}" value="${d.date || ''}">
    <button class="icon" data-act="day-del" data-id="${d.id}" title="Xóa">✕</button>
  </div>`;

  const delRow = d => `<div class="prow">
    <label class="chk" style="flex:1"><input type="checkbox" data-act="del-done" data-id="${d.id}" ${d.done ? 'checked' : ''}> <span class="dlabel" style="${d.done ? 'text-decoration:line-through;color:var(--muted)' : ''}">${esc(d.label)}</span></label>
    <button class="icon" data-act="del-del" data-id="${d.id}" title="Xóa">✕</button>
  </div>`;

  const extraRow = x => `<div class="prow">
    <input class="plabel" data-act="extra-label" data-id="${x.id}" value="${esc(x.label)}">
    <input class="money" data-act="extra-amount" data-id="${x.id}" value="${fmt(x.amount)}">
    <label class="chk"><input type="checkbox" data-act="extra-approved" data-id="${x.id}" ${x.approved ? 'checked' : ''}> Duyệt</label>
    <input type="date" data-act="extra-date" data-id="${x.id}" value="${x.date || ''}">
    <button class="icon" data-act="extra-del" data-id="${x.id}" title="Xóa">✕</button>
  </div>`;

  const tlSorted = p.timeline.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const tlRow = t => `<div class="tl ${t.kind}">
    <span class="tl-date">${fmtDateTime(t.date)}</span>
    <span class="tl-kind ${t.kind}">${t.kind === 'scope' ? 'SCOPE' : '·'}</span>
    <span>${esc(t.text)}</span>
  </div>`;

  $('#projDetail').innerHTML = `
    <button class="btn ghost sm" data-act="back-list">← Danh sách dự án</button>
    <div class="dhead">
      <div>
        <input class="dname" data-act="p-name" value="${esc(p.name)}">
        <input class="dclient" data-act="p-client" value="${esc(p.client || '')}" placeholder="Khách hàng">
      </div>
      <div class="dhead-actions">
        ${sheetBtn(p)}
        <button class="btn sm" data-act="toggle-status">${p.status === 'done' ? 'Mở lại' : 'Hoàn thành'}</button>
        <button class="btn sm" data-act="show-original">Original Scope</button>
        <button class="btn sm" data-act="show-changes">Change Log (${nChanges})</button>
        <button class="btn danger sm" data-act="del-project">Xóa</button>
      </div>
    </div>

    <div class="tiles">
      <div class="tile"><span>Hợp đồng</span><input class="money" data-act="p-contract" value="${fmt(p.contract)}"></div>
      <div class="tile"><span>Extra đã duyệt</span><b>${fmtM(extras)}</b></div>
      <div class="tile big"><span>Tổng giá trị</span><b>${fmtM(total)}</b><small>${fmt(total)} ₫</small></div>
      <div class="tile"><span>Đã thu</span><b class="good">${fmtM(paid)}</b><small>${total ? Math.round(paid / total * 100) : 0}%</small></div>
      <div class="tile"><span>Còn lại</span><b>${fmtM(remain)}</b></div>
    </div>

    <div class="dgrid">
      <div class="card">
        <div class="sec-head"><span class="sec-num mono">01</span><span class="sec-rule"></span><span class="sec-title mono">THANH TOÁN</span></div>
        ${p.payments.map(payRow).join('') || '<div class="muted">Chưa có khoản thanh toán nào.</div>'}
        <button class="btn ghost sm" data-act="add-pay" style="margin-top:10px">+ Thêm khoản</button>
        <div class="actualrow">Chi phí thực tế
          <input class="money" data-act="p-actualcost" value="${p.actualCost ? fmt(p.actualCost) : ''}" placeholder="0">
          ${actualMargin != null ? `→ margin thực <b class="${actualMargin >= S.settings.minMargin ? 'good' : 'bad'}">${actualMargin.toFixed(1)}%</b>` : '<span class="muted">(nhập để xem margin thực)</span>'}
        </div>
      </div>

      <div class="card">
        <div class="sec-head"><span class="sec-num mono">02</span><span class="sec-rule"></span><span class="sec-title mono">LỊCH QUAY</span><span class="sec-count mono">${committed} NGÀY CAM KẾT</span></div>
        ${p.shootDays.map(dayRow).join('') || '<div class="muted">Chưa có ngày quay nào.</div>'}
        <button class="btn ghost sm" data-act="add-day" style="margin-top:10px">+ Thêm ngày quay</button>
      </div>

      <div class="card">
        <div class="sec-head"><span class="sec-num mono">03</span><span class="sec-rule"></span><span class="sec-title mono">DELIVERABLE</span></div>
        ${p.deliverables.map(delRow).join('') || '<div class="muted">Chưa có deliverable nào.</div>'}
        <div class="addrow"><input id="newDel" placeholder="Thêm deliverable..."><button class="btn ghost sm" data-act="add-del">+</button></div>
      </div>

      <div class="card">
        <div class="sec-head"><span class="sec-num mono">04</span><span class="sec-rule"></span><span class="sec-title mono">CHI PHÍ PHÁT SINH</span><span class="sec-count mono">EXTRA</span></div>
        ${p.extras.map(extraRow).join('') || '<div class="muted">Chưa có extra nào.</div>'}
        <div class="addrow"><input id="newExtraLabel" placeholder="Nội dung..."><input id="newExtraAmount" class="money" style="width:110px" placeholder="2tr"><button class="btn ghost sm" data-act="add-extra">+</button></div>
      </div>

      <div class="card wide">
        <div class="sec-head"><span class="sec-num mono">05</span><span class="sec-rule"></span><span class="sec-title mono">TIMELINE</span></div>
        ${tlSorted.map(tlRow).join('') || '<div class="muted">Chưa có gì.</div>'}
        <div class="addrow"><input id="newNote" placeholder="Ghi chú thêm vào timeline..."><button class="btn ghost sm" data-act="add-note">+</button></div>
      </div>
    </div>`;

  $('#projList').hidden = true;
  $('#projDetail').hidden = false;
}

function showList() {
  S.ui.currentProject = null;
  $('#projDetail').hidden = true;
  $('#projList').hidden = false;
  renderProjects();
  save();
}

function openProject(id) {
  S.ui.currentProject = id;
  renderDetail();
  save();
  window.scrollTo(0, 0);
}

function createProject(opts) {
  const now = nowISO();
  const committed = Math.max(0, Math.round(opts.committedDays || 0));
  const contract = opts.contract || 0;
  const half = Math.round(contract / 2);
  const p = {
    id: uid(),
    name: opts.name || 'Dự án mới',
    client: opts.client || '',
    status: 'active',
    createdAt: now,
    contract,
    actualCost: null,
    originalScope: {
      contract,
      committedDays: committed,
      deliverables: opts.deliverables.slice(),
      fromQuote: !!opts.fromQuote,
      breakdown: opts.breakdown || null,
      quote: opts.quote || null,
      proposed: opts.proposed || null,
      floor: opts.floor || null,
      margin: opts.margin || null,
      config: opts.config || null,
      frozenAt: now
    },
    payments: contract > 0 ? [
      { id: uid(), label: 'Deposit 50%', amount: half, paid: false, date: '' },
      { id: uid(), label: 'Final 50%', amount: contract - half, paid: false, date: '' }
    ] : [],
    shootDays: Array.from({ length: committed }, (_, i) => ({ id: uid(), label: `Day ${i + 1}`, date: '', done: false, extra: false })),
    deliverables: opts.deliverables.map(l => ({ id: uid(), label: l, done: false })),
    extras: [],
    timeline: [{ date: now, kind: 'scope', text: `Tạo dự án — hợp đồng ${fmtM(contract)}, cam kết ${committed} ngày quay` }]
  };
  S.projects.unshift(p);
  save();
  switchView('projects');
  openProject(p.id);
  toast('Đã tạo dự án: ' + p.name);
  // tự tạo Google Sheet trong Drive (nếu đã cấu hình Apps Script)
  pushToSheet(p).then(res => {
    if (S.ui.currentProject === p.id) renderDetail();
    if (!res.ok && p.sheetStatus === 'error') toast('Tạo Google Sheet lỗi: ' + p.sheetError, 'bad');
  });
  return p;
}

/* ================= modals ================= */
function openModal(html) { $('#modalPanel').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }

function modalNewProject() {
  openModal(`<h3>Tạo dự án</h3>
    <div class="frow"><label>Tên dự án *</label><input id="m_name" class="widein" placeholder="vd: ABC Showroom"></div>
    <div class="frow"><label>Khách hàng</label><input id="m_client" class="widein"></div>
    <div class="frow"><label>Giá hợp đồng</label><input id="m_contract" class="money" placeholder="32tr"></div>
    <div class="frow"><label>Số ngày quay cam kết</label><input id="m_days" type="number" min="0" value="1"></div>
    <div class="frow"><label>Deliverables (phân cách bằng dấu phẩy)</label><input id="m_dels" class="widein" value="Video chính, Shorts, Ảnh"></div>
    <div class="modal-actions">
      <button class="btn ghost" data-act="modal-close">Hủy</button>
      <button class="btn primary" data-act="create-project">Tạo dự án</button>
    </div>`);
  $('#m_name').focus();
}

function modalFromQuote() {
  const q = computeQuote();
  const c = S.calc;
  const ddmm = new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  openModal(`<h3>Tạo dự án từ báo giá</h3>
    <div class="frow"><label>Tên dự án *</label><input id="m_name" class="widein" value="${esc(c.jobType + ' — ' + ddmm)}"></div>
    <div class="frow"><label>Khách hàng</label><input id="m_client" class="widein"></div>
    <div class="frow"><label>Giá chốt hợp đồng</label><input id="m_price" class="money" value="${fmt(Math.round(q.total))}"></div>
    <div class="neg-line">Tổng thanh toán (sau giảm giá${q.vat ? ' + VAT 20%' : ''}): <b>${fmtM(q.total)}</b> · Giá đề xuất gốc: <b>${fmtM(q.proposed)}</b> · Giá sàn: <b>${fmtM(q.floor)}</b> — có thể sửa giá chốt.</div>
    <div class="modal-actions">
      <button class="btn ghost" data-act="modal-close">Hủy</button>
      <button class="btn primary" data-act="create-from-quote">Tạo dự án</button>
    </div>`);
  $('#m_client').focus();
}

function doCreateFromQuote() {
  const name = $('#m_name').value.trim();
  if (!name) { toast('Cần nhập tên dự án', 'bad'); return; }
  const price = parseMoney($('#m_price').value);
  if (!(price > 0)) { toast('Giá hợp đồng phải > 0', 'bad'); return; }
  const q = computeQuote();
  const c = S.calc;
  const dels = [`Video dài ~${c.minutes} phút`, `${c.shorts} video short`];
  if (c.sound) dels.push('Thu âm thanh');
  if (c.drone) dels.push('Footage flycam');
  createProject({
    name,
    client: $('#m_client').value.trim(),
    contract: price,
    committedDays: c.days,
    deliverables: dels,
    fromQuote: true,
    breakdown: { nhanSu: q.nhanSu, thietBi: q.thietBi, logistic: q.logistic, post: q.post, total: q.cost, items: JSON.parse(JSON.stringify(S.calc.costs)) },
    proposed: q.proposed, floor: q.floor, margin: c.margin,
    quote: { move: q.move, stay: q.stay, discount: c.discount || 0, invoice: !!c.invoice, vat: q.vat, afterDiscount: q.afterDiscount, total: q.total, von: q.von, profit: q.profit, archMode: !!c.archMode },
    config: { days: c.days, cameras: c.cameras, sound: c.sound, drone: c.drone, minutes: c.minutes, shorts: c.shorts }
  });
  closeModal();
}

function doCreateProject() {
  const name = $('#m_name').value.trim();
  if (!name) { toast('Cần nhập tên dự án', 'bad'); return; }
  const dels = $('#m_dels').value.split(',').map(s => s.trim()).filter(Boolean);
  createProject({
    name,
    client: $('#m_client').value.trim(),
    contract: parseMoney($('#m_contract').value),
    committedDays: num($('#m_days').value),
    deliverables: dels.length ? dels : ['Video chính']
  });
  closeModal();
}

function modalOriginal(p) {
  const os = p.originalScope || {};
  const bd = os.breakdown;
  const cfg = os.config;
  let html = `<h3>Original Scope — ${esc(p.name)}</h3>
    <div class="neg-line">Chốt lúc: <b>${fmtDateTime(os.frozenAt || p.createdAt)}</b> — đây là những gì khách mua ban đầu.</div>
    <div class="os-item"><span>Hợp đồng</span><b>${fmt(os.contract || 0)} ₫</b></div>
    <div class="os-item"><span>Ngày quay cam kết</span><b>${os.committedDays ?? '?'}</b></div>
    <div style="margin-top:10px"><span class="muted">Deliverables ban đầu:</span>
      <ul class="os-list">${(os.deliverables || []).map(d => `<li>${esc(d)}</li>`).join('') || '<li class="muted">—</li>'}</ul>
    </div>`;
  if (cfg) {
    html += `<div class="os-item"><span>Cấu hình quay</span><b style="font-family:inherit;font-weight:500">${cfg.days} ngày · ${cfg.cameras} camera · âm thanh ${cfg.sound ? '✓' : '✗'} · flycam ${cfg.drone ? '✓' : '✗'}</b></div>`;
  }
  if (bd) {
    html += `<div class="neg-sub">Cost breakdown ban đầu</div>`;
    const cats = [['Nhân sự', bd.nhanSu], ['Thiết bị', bd.thietBi], ['Logistic', bd.logistic], ['Post production', bd.post]];
    cats.forEach(([name, v]) => {
      html += `<div class="os-item"><span>${name}</span><b>${fmt(v || 0)} ₫</b></div>`;
    });
    html += `<div class="os-item"><span>COST</span><b>${fmt(bd.total)} ₫</b></div>
      <div class="os-item"><span>Giá đề xuất / margin</span><b>${fmtM(os.proposed || 0)} / ${os.margin || '?'}%</b></div>`;
    if (bd.items) {
      const catNames = Object.fromEntries(CATS);
      CATS.forEach(([cat]) => {
        const arr = bd.items[cat] || [];
        if (arr.length) {
          html += `<div class="neg-line" style="margin-top:8px"><b>${esc(catNames[cat] || cat)}</b></div>
            <ul class="os-list">${arr.map(it => `<li>${esc(it.label || '(hạng mục)')} — ${fmt(it.qty)} × ${fmt(it.price)} = ${fmt(itemAmount(it))} ₫</li>`).join('')}</ul>`;
        }
      });
    }
  }
  if (os.quote) {
    const qt = os.quote;
    html += `<div class="neg-sub">Giảm giá &amp; hoá đơn lúc chốt</div>
      <div class="os-item"><span>Di chuyển / lưu trú</span><b>${fmt(qt.move || 0)} / ${fmt(qt.stay || 0)} ₫</b></div>
      <div class="os-item"><span>Giảm giá</span><b>${qt.discount || 0}%</b></div>
      <div class="os-item"><span>Hoá đơn</span><b style="font-family:inherit;font-weight:500">${qt.invoice ? 'CÓ (+VAT 20%)' : 'KHÔNG'}</b></div>
      <div class="os-item"><span>Sau giảm giá</span><b>${fmt(qt.afterDiscount || 0)} ₫</b></div>
      <div class="os-item"><span>TỔNG TIỀN</span><b>${fmt(qt.total || 0)} ₫</b></div>`;
    if (qt.archMode) {
      html += `<div class="os-item"><span>TIỀN VỐN</span><b>${fmt(qt.von || 0)} ₫</b></div>
        <div class="os-item"><span>LỢI NHUẬN</span><b>${fmt(qt.profit || 0)} ₫</b></div>`;
    }
  }
  html += `<div class="modal-actions"><button class="btn ghost" data-act="modal-close">Đóng</button></div>`;
  openModal(html);
}

function modalChanges(p) {
  const list = p.timeline.filter(t => t.kind === 'scope').sort((a, b) => String(b.date).localeCompare(String(a.date)));
  openModal(`<h3>Change Log — ${esc(p.name)}</h3>
    <div class="neg-line">Lịch sử thay đổi scope so với hợp đồng ban đầu.</div>
    ${list.length ? list.map(t => `<div class="chg"><span class="chg-date">${fmtDateTime(t.date)}</span><span>${esc(t.text)}</span></div>`).join('')
      : '<div class="muted">Chưa có thay đổi scope nào.</div>'}
    <div class="modal-actions"><button class="btn ghost" data-act="modal-close">Đóng</button></div>`);
}

/* ================= settings ================= */
function renderSettings() {
  const st = S.settings;
  $('#view-settings').innerHTML = `
    <div class="view-head">
      <h1 class="display">CÀI ĐẶT</h1>
      <span class="kicker mono">MARGIN · PRESET · DỮ LIỆU</span>
    </div>
    <div class="set-grid">
      <div class="card">
        <div class="sec-head"><span class="sec-num mono">01</span><span class="sec-rule"></span><span class="sec-title mono">MARGIN &amp; GIÁ</span></div>
        <div class="frow"><label>Margin mặc định (job mới)</label><span class="inl"><input id="s_margin" type="number" min="1" max="95" value="${st.margin}"> <em>%</em></span></div>
        <div class="frow"><label>Margin tối thiểu (cảnh báo trả giá)</label><span class="inl"><input id="s_min" type="number" min="1" max="95" value="${st.minMargin}"> <em>%</em></span></div>
        <div class="frow"><label>Giá sàn = giá đề xuất × (1 − x)</label><span class="inl"><input id="s_floor" type="number" min="0" max="50" value="${st.floorDiscount}"> <em>%</em></span></div>
        <div class="neg-line">Công thức: Giá bán = Cost ÷ (1 − margin) · Giá sàn = Giá bán × (1 − ${st.floorDiscount}%)</div>
      </div>
      <div class="card set-wide">
        <div class="sec-head"><span class="sec-num mono">02</span><span class="sec-rule"></span><span class="sec-title mono">LOẠI JOB &amp; PRESET</span><span class="sec-count mono">${st.jobTypes.length} LOẠI</span></div>
        <div class="presetlist">
          <div class="preset-row head"><span>Loại job</span><span>Ngày</span><span>Cam</span><span>ÂT</span><span>FC</span><span>Phút</span><span>Short</span><span></span></div>
          ${st.jobTypes.map(j => `<div class="preset-row">
            <input data-act="jt-name" data-name="${esc(j.name)}" value="${esc(j.name)}">
            <input type="number" min="0" data-act="jt-days" data-name="${esc(j.name)}" value="${j.preset.days}">
            <input type="number" min="0" data-act="jt-cameras" data-name="${esc(j.name)}" value="${j.preset.cameras}">
            <input type="checkbox" data-act="jt-sound" data-name="${esc(j.name)}" ${j.preset.sound ? 'checked' : ''} title="Âm thanh">
            <input type="checkbox" data-act="jt-drone" data-name="${esc(j.name)}" ${j.preset.drone ? 'checked' : ''} title="Flycam">
            <input type="number" min="0" data-act="jt-minutes" data-name="${esc(j.name)}" value="${j.preset.minutes}">
            <input type="number" min="0" data-act="jt-shorts" data-name="${esc(j.name)}" value="${j.preset.shorts}">
            <button class="icon" data-act="del-jobtype" data-name="${esc(j.name)}" title="Xóa loại job">✕</button>
          </div>`).join('')}
        </div>
        <button class="btn ghost sm" data-act="add-jobtype" style="margin-top:10px">+ Thêm loại job</button>
        <div class="neg-line" style="margin-top:8px">Ở tab Báo giá có thể gõ thẳng tên loại job tùy ý (TVC, Marketing Campaign...) — preset chỉ để điền nhanh số liệu.</div>
      </div>
      <div class="card set-wide">
        <div class="sec-head"><span class="sec-num mono">03</span><span class="sec-rule"></span><span class="sec-title mono">GOOGLE SHEET &amp; DRIVE</span></div>
        <div class="frow"><label>Apps Script URL (/exec)</label><span class="inl"><input data-act="sheet-url" style="width:320px;text-align:left;font-size:.72rem" placeholder="https://script.google.com/macros/s/.../exec" value="${esc(st.sheet.url)}"></span></div>
        <div class="frow"><label>Token bí mật</label><span class="inl"><input data-act="sheet-token" type="password" style="width:220px;text-align:left" placeholder="trùng SECRET trong Code.gs" value="${esc(st.sheet.token)}"></span></div>
        <div class="neg-line">Khi tạo dự án mới, tool sẽ tự tạo 1 Google Sheet đúng tên dự án trong thư mục Drive của bạn (tổng quan, thanh toán, lịch quay, deliverable, extra, change log). Setup 3 phút: xem file <b>google-apps-script/Code.gs</b> trong thư mục tool.</div>
        <div class="setbtns">
          <button class="btn" data-act="sheet-test">Kiểm tra kết nối</button>
        </div>
      </div>
      <div class="card set-wide">
        <div class="sec-head"><span class="sec-num mono">04</span><span class="sec-rule"></span><span class="sec-title mono">DỮ LIỆU</span></div>
        <div class="neg-line">Toàn bộ dữ liệu lưu trong trình duyệt này (localStorage). Hãy export backup định kỳ, hoặc trước khi xóa dữ liệu trình duyệt.</div>
        <div class="setbtns">
          <button class="btn" data-act="export">Export backup ↓</button>
          <button class="btn" data-act="import-btn">Import backup ↑</button>
          <button class="btn" data-act="seed-sample">Nạp dự án mẫu</button>
          <button class="btn danger" data-act="clear-data">Xóa toàn bộ dữ liệu</button>
          <input type="file" id="importFile" hidden accept=".json,application/json">
        </div>
      </div>
    </div>`;
}

/* ================= view switching ================= */
function switchView(v) {
  S.ui.view = v;
  ['quote', 'projects', 'settings'].forEach(name => {
    $('#view-' + name).hidden = name !== v;
  });
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === v));
  if (v === 'projects') renderProjects();
  if (v === 'settings') renderSettings();
  if (v === 'quote') refreshQuote();
  save();
}

/* ================= events ================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  const p = currentProject();
  const findRow = arr => arr.find(x => x.id === id);

  switch (act) {
    case 'tab': switchView(el.dataset.view); break;
    case 'job': {
      const jt = S.settings.jobTypes.find(j => j.name === el.dataset.name);
      if (jt) {
        Object.assign(S.calc, { jobType: jt.name }, jt.preset);
        S.calc.archMode = jt.formula === 'arch';
        S.calc.costs = S.calc.archMode ? generateArchCosts(S.calc.arch) : generateCosts(S.calc, S.settings.rates);
        fillQuoteInputs(); refreshQuote();
      }
      break;
    }
    case 'copy-quote': copyText(quoteText(computeQuote())); break;
    case 'quote-to-project': modalFromQuote(); break;
    case 'neg-check': renderNeg(); break;
    case 'apply-cut': applyCut(el.dataset.cut); break;
    case 'ci-add': {
      const cat = el.dataset.cat;
      if (!S.calc.costs[cat]) break;
      S.calc.costs[cat].push({ id: uid(), label: '', qty: 1, price: S.settings.rates[DEFAULT_RATE_FOR_CAT[cat]] || 0 });
      renderCostDetail(); refreshQuote();
      break;
    }
    case 'ci-del': {
      const { cat, id } = el.dataset;
      S.calc.costs[cat] = (S.calc.costs[cat] || []).filter(x => x.id !== id);
      renderCostDetail(); refreshQuote();
      break;
    }

    case 'new-project': modalNewProject(); break;
    case 'create-project': doCreateProject(); break;
    case 'create-from-quote': doCreateFromQuote(); break;
    case 'add-jobtype': {
      let n = 0, name = 'Loại mới';
      while (S.settings.jobTypes.some(j => j.name === name)) name = `Loại mới ${++n + 1}`;
      S.settings.jobTypes.push({ name, preset: { days: 1, cameras: 1, sound: false, drone: false, minutes: 1, shorts: 5 } });
      save(); renderSettings(); refreshChips();
      break;
    }
    case 'del-jobtype': {
      const nm = el.dataset.name;
      if (!nm || !confirm(`Xóa loại job "${nm}"?`)) break;
      S.settings.jobTypes = S.settings.jobTypes.filter(j => j.name !== nm);
      if (S.calc.jobType === nm) S.calc.jobType = S.settings.jobTypes[0] ? S.settings.jobTypes[0].name : '';
      save(); renderSettings(); refreshChips(); fillQuoteInputs();
      break;
    }
    case 'open-project': openProject(el.dataset.id); break;
    case 'back-list': showList(); break;
    case 'modal-close': closeModal(); break;

    case 'show-original': if (p) modalOriginal(p); break;
    case 'show-changes': if (p) modalChanges(p); break;
    case 'sync-sheet': {
      if (!p) break;
      const cfg = S.settings.sheet || {};
      if (!cfg.url) { toast('Cấu hình Apps Script URL trong tab Cài đặt trước', 'bad'); switchView('settings'); break; }
      toast('Đang đồng bộ Google Sheet...');
      pushToSheet(p).then(res => {
        if (S.ui.currentProject === p.id) renderDetail();
        toast(res.ok ? 'Google Sheet đã sẵn sàng' : 'Lỗi: ' + (p.sheetError || 'không rõ'), res.ok ? undefined : 'bad');
      });
      break;
    }
    case 'sheet-test': {
      const cfg = S.settings.sheet || {};
      if (!cfg.url) { toast('Chưa nhập Apps Script URL', 'bad'); break; }
      toast('Đang kiểm tra kết nối...');
      fetch(cfg.url + (cfg.url.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(cfg.token || ''))
        .then(r => r.json())
        .then(d => toast(d.ok ? 'Kết nối OK — Apps Script đang chạy' : 'Lỗi: ' + (d.error || 'không rõ'), d.ok ? undefined : 'bad'))
        .catch(() => toast('Không gọi được URL — kiểm tra lại link /exec', 'bad'));
      break;
    }
    case 'toggle-status':
      if (p) {
        p.status = p.status === 'done' ? 'active' : 'done';
        logEvent(p, p.status === 'done' ? 'Chuyển trạng thái: HOÀN THÀNH' : 'Mở lại dự án');
        save(); renderDetail(); renderProjects();
      }
      break;
    case 'del-project':
      if (p && confirm(`Xóa dự án "${p.name}"? Không thể hoàn tác.`)) {
        S.projects = S.projects.filter(x => x.id !== p.id);
        save(); showList(); toast('Đã xóa dự án');
      }
      break;

    /* payments */
    case 'add-pay':
      if (p) {
        p.payments.push({ id: uid(), label: `Khoản ${p.payments.length + 1}`, amount: 0, paid: false, date: '' });
        logEvent(p, 'Thêm khoản thanh toán');
        save(); renderDetail();
      }
      break;
    case 'pay-del':
      if (p) { const x = findRow(p.payments); if (x && confirm(`Xóa khoản "${x.label}"?`)) { p.payments = p.payments.filter(y => y.id !== id); logEvent(p, `Xóa khoản thanh toán: ${x.label}`); save(); renderDetail(); } }
      break;

    /* shoot days */
    case 'add-day':
      if (p) {
        const os = p.originalScope || {};
        const committed = os.committedDays ?? p.shootDays.length;
        const n = p.shootDays.length + 1;
        const extra = n > committed;
        p.shootDays.push({ id: uid(), label: `Day ${n}`, date: '', done: false, extra });
        if (extra) logChange(p, `Thêm ngày quay EXTRA: Day ${n} (ngoài ${committed} ngày cam kết)`);
        else logChange(p, `Thêm ngày quay: Day ${n}`);
        save(); renderDetail();
      }
      break;
    case 'day-del':
      if (p) {
        const d = findRow(p.shootDays);
        if (d && confirm(`Xóa ${d.label}?`)) {
          const os = p.originalScope || {};
          const committed = os.committedDays ?? p.shootDays.length;
          const idx = p.shootDays.indexOf(d);
          if (idx < committed) logChange(p, `Bỏ ngày quay cam kết: ${d.label}`);
          else logEvent(p, `Xóa ${d.label}`);
          p.shootDays = p.shootDays.filter(y => y.id !== id);
          save(); renderDetail();
        }
      }
      break;

    /* deliverables */
    case 'add-del':
      if (p) {
        const inp = $('#newDel');
        const label = inp.value.trim();
        if (!label) { toast('Nhập tên deliverable', 'bad'); break; }
        p.deliverables.push({ id: uid(), label, done: false });
        logChange(p, `Thêm deliverable: ${label}`);
        save(); renderDetail();
      }
      break;
    case 'del-del':
      if (p) {
        const d = findRow(p.deliverables);
        if (d && confirm(`Xóa deliverable "${d.label}"?`)) {
          logChange(p, `Bỏ deliverable: ${d.label}`);
          p.deliverables = p.deliverables.filter(y => y.id !== id);
          save(); renderDetail();
        }
      }
      break;

    /* extras */
    case 'add-extra':
      if (p) {
        const label = $('#newExtraLabel').value.trim();
        const amount = parseMoney($('#newExtraAmount').value);
        if (!label) { toast('Nhập nội dung extra', 'bad'); break; }
        if (!(amount > 0)) { toast('Nhập số tiền (vd: 2tr)', 'bad'); break; }
        p.extras.push({ id: uid(), label, amount, approved: true, date: todayYmd() });
        logChange(p, `Thêm extra: ${label} +${fmt(amount)} ₫`);
        save(); renderDetail();
      }
      break;
    case 'extra-del':
      if (p) {
        const x = findRow(p.extras);
        if (x && confirm(`Xóa extra "${x.label}"?`)) {
          logChange(p, `Bỏ extra: ${x.label} (−${fmt(x.amount)} ₫)`);
          p.extras = p.extras.filter(y => y.id !== id);
          save(); renderDetail();
        }
      }
      break;

    /* timeline note */
    case 'add-note':
      if (p) {
        const inp = $('#newNote');
        const text = inp.value.trim();
        if (!text) break;
        logEvent(p, 'Ghi chú: ' + text);
        save(); renderDetail();
      }
      break;

    /* settings */
    case 'export': {
      const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `oddpig-backup-${todayYmd()}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Đã export backup');
      break;
    }
    case 'import-btn': $('#importFile').click(); break;
    case 'seed-sample':
      S.projects = S.projects.filter(x => x.id !== 'sample-abc');
      seedSample();
      renderProjects();
      toast('Đã nạp dự án mẫu ABC Showroom');
      break;
    case 'clear-data':
      if (confirm('Xóa TOÀN BỘ dữ liệu (dự án, báo giá)? Không thể hoàn tác.') &&
          confirm('Chắc chắn chứ? Hãy export backup trước nếu cần.')) {
        try { localStorage.removeItem(LS_KEY); } catch (e) {}
        S = DEFAULT_STATE();
        save(); renderAll(); switchView('quote');
        toast('Đã xóa toàn bộ dữ liệu');
      }
      break;
  }
});

/* change events: checkboxes, dates, text edits (kích hoạt khi blur) */
document.addEventListener('change', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const act = el.dataset.act;
  const id = el.dataset.id;
  if (act === 's_margin') { S.settings.margin = clamp(num(el.value) || 40, 1, 95); save(); return; }
  if (act === 's_min') { S.settings.minMargin = clamp(num(el.value) || 30, 1, 95); save(); refreshQuote(); return; }
  if (act === 's_floor') { S.settings.floorDiscount = clamp(num(el.value) || 10, 0, 50); save(); refreshQuote(); return; }
  if (act === 'sheet-url') { S.settings.sheet.url = el.value.trim(); save(); return; }
  if (act === 'sheet-token') { S.settings.sheet.token = el.value.trim(); save(); return; }
  if (act.startsWith('jt-')) {
    const oldName = el.dataset.name;
    const jt = S.settings.jobTypes.find(j => j.name === oldName);
    if (!jt) return;
    if (act === 'jt-name') {
      const nn = el.value.trim();
      if (nn && nn !== oldName && !S.settings.jobTypes.some(j => j.name === nn)) {
        jt.name = nn;
        if (S.calc.jobType === oldName) S.calc.jobType = nn;
        refreshChips();
      } else { el.value = jt.name; }
    } else if (act === 'jt-days') jt.preset.days = Math.max(0, num(el.value));
    else if (act === 'jt-cameras') jt.preset.cameras = Math.max(0, num(el.value));
    else if (act === 'jt-sound') jt.preset.sound = el.checked;
    else if (act === 'jt-drone') jt.preset.drone = el.checked;
    else if (act === 'jt-minutes') jt.preset.minutes = Math.max(0, num(el.value));
    else if (act === 'jt-shorts') jt.preset.shorts = Math.max(0, num(el.value));
    save();
    return;
  }
  const p = currentProject();
  if (!p) return;
  const findRow = arr => arr.find(x => x.id === id);
  switch (act) {
    case 'p-name': p.name = el.value.trim() || p.name; save(); break;
    case 'p-client': p.client = el.value.trim(); save(); break;
    case 'p-contract': {
      const v = parseMoney(el.value);
      const old = p.contract;
      if (v > 0 && v !== old) {
        p.contract = v;
        logChange(p, `Hợp đồng thay đổi: ${fmtM(old)} → ${fmtM(v)}`);
        save(); renderDetail();
      } else { el.value = fmt(p.contract); }
      break;
    }
    case 'p-actualcost': {
      p.actualCost = parseMoney(el.value);
      save(); renderDetail();
      break;
    }
    case 'pay-label': { const x = findRow(p.payments); if (x) { x.label = el.value; save(); } break; }
    case 'pay-amount': { const x = findRow(p.payments); if (x) { x.amount = parseMoney(el.value); save(); } break; }
    case 'pay-date': { const x = findRow(p.payments); if (x) { x.date = el.value; save(); } break; }
    case 'pay-paid': {
      const x = findRow(p.payments);
      if (x) {
        x.paid = el.checked;
        if (x.paid) { if (!x.date) x.date = todayYmd(); logEvent(p, `Nhận thanh toán: ${x.label} — ${fmt(x.amount)} ₫`); }
        else logEvent(p, `Bỏ đánh dấu đã nhận: ${x.label}`);
        save(); renderDetail();
      }
      break;
    }
    case 'day-done': {
      const d = findRow(p.shootDays);
      if (d) {
        d.done = el.checked;
        logEvent(p, d.done ? `Hoàn thành ${d.label}${d.extra ? ' (EXTRA)' : ''}` : `Mở lại ${d.label}`);
        if (d.done && !d.date) d.date = todayYmd();
        save(); renderDetail();
      }
      break;
    }
    case 'day-date': { const d = findRow(p.shootDays); if (d) { d.date = el.value; save(); } break; }
    case 'del-done': {
      const d = findRow(p.deliverables);
      if (d) {
        d.done = el.checked;
        logEvent(p, d.done ? `Hoàn thành deliverable: ${d.label}` : `Mở lại deliverable: ${d.label}`);
        save(); renderDetail();
      }
      break;
    }
    case 'extra-label': { const x = findRow(p.extras); if (x) { x.label = el.value; save(); } break; }
    case 'extra-amount': { const x = findRow(p.extras); if (x) { x.amount = parseMoney(el.value); save(); } break; }
    case 'extra-date': { const x = findRow(p.extras); if (x) { x.date = el.value; save(); } break; }
    case 'extra-approved': {
      const x = findRow(p.extras);
      if (x) {
        x.approved = el.checked;
        logEvent(p, `Extra "${x.label}" ${x.approved ? 'được duyệt' : 'chưa duyệt'}`);
        save(); renderDetail();
      }
      break;
    }
  }
});

/* import file */
document.addEventListener('change', e => {
  if (e.target.id !== 'importFile' || !e.target.files || !e.target.files[0]) return;
  const f = e.target.files[0];
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || !d.settings || !Array.isArray(d.projects)) throw new Error('bad');
      d.ui = { view: 'quote', currentProject: null };
      S = migrate(d);
      save(); renderAll(); switchView('projects');
      toast('Đã import backup');
    } catch (err) { toast('File backup không hợp lệ', 'bad'); }
  };
  rd.readAsText(f);
  e.target.value = '';
});

/* quote inputs: live */
document.addEventListener('input', e => {
  const el = e.target;
  const id = el.id || '';
  const specIds = ['c_days', 'c_cameras', 'c_sound', 'c_drone', 'c_minutes', 'c_shorts'];
  if (specIds.includes(id) || id.startsWith('r_')) {
    // thông số QUAY/DỰNG hoặc đơn giá mặc định thay đổi → dòng AUTO tự cập nhật
    readQuoteInputs();
    syncAutoCosts();
    renderCostDetail();
    refreshQuote();
  } else if (id === 'c_job' || id === 'c_margin' || id === 'c_discount' || id === 'c_move' || id === 'c_stay' || id === 'c_invoice') {
    readQuoteInputs();
    refreshQuote();
  } else if (id === 'n_offer') {
    renderNeg(); save();
  } else if (id === 's_margin' || id === 's_min' || id === 's_floor') {
    S.settings.margin = clamp(num($('#s_margin').value) || 40, 1, 95);
    S.settings.minMargin = clamp(num($('#s_min').value) || 30, 1, 95);
    S.settings.floorDiscount = clamp(num($('#s_floor').value) || 10, 0, 50);
    save();
  } else if (id === 'a_rooms' || id === 'a_cams' || id === 'a_extra' || id === 'a_interview') {
    // panel công thức kiến trúc — chỉ có tác dụng ở chế độ kiến trúc
    if (!S.calc.archMode) return;
    const a = S.calc.arch;
    if (id === 'a_rooms') a.rooms = Math.max(0, num(el.value));
    if (id === 'a_cams') a.cams = Math.max(0, Math.round(num(el.value)));
    if (id === 'a_extra') a.extra = parseMoney(el.value);
    if (id === 'a_interview') a.interview = el.checked;
    syncArchCosts();
    renderCostDetail();
    refreshQuote();
  } else if (id === 'a_days') {
    S.calc.days = Math.max(0, num(el.value));
    refreshQuote();
  } else if (el.classList && el.classList.contains('it-label')) {
    setCostItem(el, it => { it.label = el.value; });
  } else if (el.classList && el.classList.contains('it-qty')) {
    setCostItem(el, it => { it.qty = Math.max(0, num(el.value)); });
  } else if (el.classList && el.classList.contains('it-price')) {
    setCostItem(el, it => { it.price = parseMoney(el.value); });
  }
});

// cập nhật 1 dòng chi phí từ input + refresh số tiền/subtotal mà không rebuild (giữ focus khi gõ)
// sửa tay dòng nào thì dòng đó tắt auto (không bị đồng bộ ghi đè)
function setCostItem(el, apply) {
  const it = (S.calc.costs[el.dataset.cat] || []).find(x => x.id === el.dataset.id);
  if (!it) return;
  apply(it);
  delete it.auto;
  delete it.min;
  el.classList.remove('it-auto');
  const row = el.closest('.item-row');
  if (row) row.querySelector('.it-amt').textContent = fmt(itemAmount(it));
  const catBlock = el.closest('.cat');
  if (catBlock) catBlock.querySelector('.cat-sub').textContent = fmt(
    S.calc.costs[el.dataset.cat].reduce((s, x) => s + itemAmount(x), 0));
  refreshQuote();
}

/* money inputs: format lại khi rời ô */
document.addEventListener('focusout', e => {
  const el = e.target;
  if (el.classList && el.classList.contains('money') && el.id !== 'n_offer') {
    const v = parseMoney(el.value);
    el.value = v ? fmt(v) : '';
  }
});

/* Enter trong các dòng thêm mới */
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  const inp = e.target;
  if (inp instanceof HTMLInputElement && inp.closest('.addrow')) {
    const btn = inp.closest('.addrow').querySelector('button');
    if (btn) btn.click();
  }
  if (inp instanceof HTMLInputElement && (inp.id === 'm_name' || inp.id === 'm_price')) {
    const btn = $('#modalPanel').querySelector('.btn.primary');
    if (btn) btn.click();
  }
});

/* click nền modal để đóng */
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });

/* ================= init ================= */
function refreshChips() {
  $('#jobChips').innerHTML = S.settings.jobTypes.map(j =>
    `<button class="chip ${j.name === S.calc.jobType ? 'active' : ''}" data-act="job" data-name="${esc(j.name)}">${esc(j.name)}</button>`).join('');
}

function renderAll() {
  refreshChips();
  fillQuoteInputs();
  refreshQuote();
  renderProjects();
  renderSettings();
  if (S.ui.currentProject && S.projects.some(p => p.id === S.ui.currentProject)) {
    $('#projList').hidden = true;
    renderDetail();
  } else {
    showList();
  }
}

load();
renderAll();
switchView(S.ui.view && ['quote', 'projects', 'settings'].includes(S.ui.view) ? S.ui.view : 'quote');

/* timecode header — giống portfolio */
function tickTC() {
  const el = document.getElementById('tcClock');
  if (!el) return;
  const d = new Date();
  const p = n => String(n).padStart(2, '0');
  el.textContent = `TC ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}:${p(Math.floor(d.getMilliseconds() / 40))}`;
}
setInterval(tickTC, 40);
tickTC();
