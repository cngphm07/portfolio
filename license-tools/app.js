'use strict';
(() => {
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  /* ---------- Cấu hình / client ---------- */
  const cfg = window.LT_CONFIG || {};
  const MOCK = !(cfg.supabaseUrl && cfg.supabaseAnonKey);
  let sb = null;

  let user = null;          // {id, email}
  let accounts = [];        // camelCase objects
  const revealed = new Set();
  let currentLookup = null;
  let lookupRevealed = false;
  let busy = false;

  const COMMON_SERVICES = ['Adobe','Google','Claude','ChatGPT','OpenAI','Canva','Microsoft','Netflix','Spotify','YouTube Premium','TikTok','CapCut','Fshare','Viettel','VNPT','FPT Play','Grammarly','Envato'];

  /* ---------- Ưu tiên hiển thị (lưu theo thiết bị) ---------- */
  const PREFS_KEY = 'lt-prefs.v1';
  let prefs = { threshold: 7, sort: 'expiryAsc', status: 'all', service: '' };
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')); } catch (e) {}
  const savePrefs = () => { try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch (e) {} };
  const ui = { q: '', status: prefs.status, service: prefs.service || '', sort: prefs.sort, threshold: prefs.threshold };

  /* ---------- Dịch lỗi thường gặp sang tiếng Việt ---------- */
  const ERR_VI = [
    ['Invalid login credentials', 'Email hoặc mật khẩu không đúng.'],
    ['User already registered', 'Email này đã được dùng để đăng ký.'],
    ['Signup is closed', 'Đăng ký đã bị khóa — hệ thống chỉ cho phép 1 tài khoản quản trị.'],
    ['Signups not allowed', 'Đăng ký đang bị tắt trong Supabase Dashboard — bật "Allow new users to sign up" trong Authentication → Sign In / Providers.'],
    ['Email not confirmed', 'Email chưa được xác nhận — hãy kiểm tra hộp thư.'],
    ['invalid format', 'Địa chỉ email không hợp lệ.'],
    ['at least 6 characters', 'Mật khẩu phải có ít nhất 6 ký tự.'],
    ['Failed to fetch', 'Mất kết nối mạng — kiểm tra internet rồi thử lại.']
  ];
  const viErr = e => {
    const m = (e && (e.message || e.error_description)) || String(e || 'Có lỗi xảy ra');
    for (const [k, v] of ERR_VI) if (m.includes(k)) return v;
    return m;
  };

  /* ---------- Ngày tháng / trạng thái ---------- */
  const parseD = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const toISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const fmtD = s => { const d = parseD(s); return d ? d.toLocaleDateString('vi-VN') : '—'; };
  const addMonths = (iso, m) => { const d = parseD(iso); d.setMonth(d.getMonth() + m); return toISO(d); };
  const daysLeft = a => { const d = parseD(a.expiresAt); return d ? Math.round((d - today0()) / 864e5) : null; };
  function statusOf(a) {
    const n = daysLeft(a);
    if (n === null) return { key: 'none', label: 'Không rõ', txt: '' };
    if (n < 0) return { key: 'expired', label: 'Đã hết hạn', txt: 'Quá hạn ' + (-n) + ' ngày' };
    if (n === 0) return { key: 'soon', label: 'Hết hạn hôm nay', txt: 'Hết hạn hôm nay' };
    if (n <= ui.threshold) return { key: 'soon', label: 'Sắp hết hạn', txt: 'Còn ' + n + ' ngày' };
    return { key: 'active', label: 'Còn hạn', txt: 'Còn ' + n + ' ngày' };
  }
  const ST_LABEL = { active: 'Còn hạn', soon: 'Sắp hết hạn', expired: 'Đã hết hạn', none: 'Không rõ' };

  /* ---------- Chuyển đổi dòng DB ---------- */
  const fromRow = r => ({
    id: r.id,
    username: r.username || '',
    password: r.password || '',
    service: r.service || '',
    package: r.package || '',
    registeredAt: r.registered_at || '',
    expiresAt: r.expires_at || '',
    note: r.note || '',
    createdAt: r.created_at || ''
  });
  const toRow = a => ({
    username: a.username,
    password: a.password,
    service: a.service || '',
    package: a.package || '',
    registered_at: a.registeredAt || null,
    expires_at: a.expiresAt,
    note: a.note || ''
  });

  /* ---------- Khởi động ---------- */
  async function boot() {
    $('#fSort').value = ui.sort;
    $('#fThreshold').value = String(ui.threshold);
    if (MOCK) {
      $('#demoBadge').hidden = false;
      sb = new window.MockSupabase();
    } else if (!window.supabase) {
      showAuth();
      showFormErr('#liErr', 'Không tải được thư viện Supabase — kiểm tra mạng rồi tải lại trang.');
      return;
    } else {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
    }

    wireAuth();
    wirePWA();

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) enterApp(session.user);
      else showAuth();
    } catch (e) { showAuth(); }
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_IN' && session && !user) enterApp(session.user);
    });
  }

  /* ---------- Đăng nhập / đăng ký ---------- */
  function showAuth() {
    $('#appView').hidden = true;
    $('#authView').hidden = false;
  }
  function enterApp(u) {
    user = { id: u.id, email: u.email || '' };
    $('#authView').hidden = true;
    $('#appView').hidden = false;
    $('#userEmail').textContent = user.email;
    render();
    loadAll();
  }
  function showFormErr(sel, msg) { const el = $(sel); el.textContent = msg; el.hidden = !msg; }
  function setAForm(f) {
    document.querySelectorAll('.atab').forEach(b => b.classList.toggle('active', b.dataset.atab === f));
    $('#loginForm').hidden = f !== 'login';
    $('#registerForm').hidden = f !== 'register';
  }
  function wireAuth() {
    document.querySelectorAll('.atab').forEach(b => b.addEventListener('click', () => setAForm(b.dataset.atab)));
    $('#loginForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const email = $('#liEmail').value.trim(), password = $('#liPass').value;
      if (!email || !password) { showFormErr('#liErr', 'Nhập email và mật khẩu.'); return; }
      busy = true;
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { showFormErr('#liErr', viErr(error)); return; }
        $('#liPass').value = '';
        if (data.session) enterApp(data.session.user);
      } finally { busy = false; }
    });
    $('#registerForm').addEventListener('submit', async e => {
      e.preventDefault();
      if (busy) return;
      const email = $('#rgEmail').value.trim(), p1 = $('#rgPass').value, p2 = $('#rgPass2').value;
      if (!email) { showFormErr('#rgErr', 'Nhập email.'); return; }
      if (p1.length < 6) { showFormErr('#rgErr', 'Mật khẩu phải có ít nhất 6 ký tự.'); return; }
      if (p1 !== p2) { showFormErr('#rgErr', 'Hai lần nhập mật khẩu không giống nhau.'); return; }
      busy = true;
      try {
        const { data, error } = await sb.auth.signUp({ email, password: p1 });
        if (error) { showFormErr('#rgErr', viErr(error)); return; }
        if (data.session && data.session.user) { enterApp(data.session.user); return; }
        const ok = $('#rgErr');
        ok.className = 'form-ok';
        ok.hidden = false;
        ok.textContent = 'Đã tạo tài khoản. Nếu hệ thống yêu cầu xác nhận, hãy kiểm tra email rồi quay lại đăng nhập.';
      } finally { busy = false; }
    });
  }

  /* ---------- Tải dữ liệu ---------- */
  async function loadAll() {
    try {
      const { data, error } = await sb.from('accounts').select('*');
      if (error) { toast('⚠️ ' + viErr(error)); return; }
      accounts = (data || []).map(fromRow);
      render();
    } catch (e) { toast('⚠️ ' + viErr(e)); }
  }

  /* ---------- Hiển thị ---------- */
  function render() { renderPills(); renderCards(); renderLists(); }

  function renderPills() {
    // pill loại tài khoản
    const svcCounts = new Map();
    accounts.forEach(a => {
      const k = (a.service || '').trim() || 'Khác';
      svcCounts.set(k, (svcCounts.get(k) || 0) + 1);
    });
    const svcs = [...svcCounts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'vi'));
    let html = '<span class="filter-label">Loại</span>' +
      pillBtn('', 'Tất cả', accounts.length, ui.service === '');
    svcs.forEach(([name, n]) => { html += pillBtn(name, name, n, ui.service === name); });
    $('#svcPills').innerHTML = html;

    // pill trạng thái
    let act = 0, soon = 0, exp = 0;
    accounts.forEach(a => { const k = statusOf(a).key; if (k === 'active') act++; else if (k === 'soon') soon++; else if (k === 'expired') exp++; });
    const dot = k => '<span class="sdot" style="background:var(--' + (k === 'active' ? 'green' : k === 'soon' ? 'yellow' : 'red') + ')"></span>';
    $('#stPills').innerHTML = '<span class="filter-label">Trạng thái</span>' +
      pillBtn('', 'Tất cả', accounts.length, ui.status === 'all', true) +
      pillBtn('active', ST_LABEL.active, act, ui.status === 'active', true) +
      pillBtn('soon', ST_LABEL.soon, soon, ui.status === 'soon', true) +
      pillBtn('expired', ST_LABEL.expired, exp, ui.status === 'expired', true);
  }
  function pillBtn(value, label, count, active, withDot) {
    return '<button class="filter-btn' + (active ? ' active' : '') + '" data-value="' + esc(value) + '">' +
      (withDot && value ? dotHtml(value) : '') + esc(label) +
      '<span class="count">' + count + '</span></button>';
  }
  const dotHtml = k => '<span class="sdot" style="background:var(--' + (k === 'active' ? 'green' : k === 'soon' ? 'yellow' : 'red') + ')"></span>';

  function renderCount() {
    $('#secCount').textContent = visibleAccounts().length + ' / ' + accounts.length;
  }

  function visibleAccounts() {
    let list = [...accounts];
    if (ui.service) list = list.filter(a => ((a.service || '').trim() || 'Khác') === ui.service);
    const q = ui.q.trim().toLowerCase();
    if (q) list = list.filter(a => [a.username, a.service, a.package, a.note].some(v => (v || '').toLowerCase().includes(q)));
    if (ui.status !== 'all') list = list.filter(a => statusOf(a).key === ui.status);
    const cmp = {
      expiryAsc:  (a, b) => (parseD(a.expiresAt)?.getTime() ?? Infinity) - (parseD(b.expiresAt)?.getTime() ?? Infinity),
      expiryDesc: (a, b) => (parseD(b.expiresAt)?.getTime() ?? -Infinity) - (parseD(a.expiresAt)?.getTime() ?? -Infinity),
      nameAsc:    (a, b) => a.username.localeCompare(b.username, 'vi'),
      newest:     (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
    }[ui.sort];
    return list.sort(cmp);
  }

  function renderCards() {
    renderCount();
    const list = visibleAccounts();
    const grid = $('#grid'), empty = $('#empty');
    grid.hidden = list.length === 0;
    empty.hidden = list.length > 0;
    if (!list.length) {
      empty.innerHTML = accounts.length === 0
        ? '<span class="big">📭</span>Chưa có tài khoản nào — bấm "＋ Thêm tài khoản" để bắt đầu'
        : '<span class="big">🔍</span>Không có tài khoản nào phù hợp bộ lọc hiện tại';
      return;
    }
    grid.innerHTML = list.map(a => {
      const st = statusOf(a);
      const pwText = revealed.has(a.id) ? esc(a.password) : '•'.repeat(Math.min(12, Math.max(4, a.password.length)));
      return '<article class="acc-card st-' + st.key + '" data-id="' + a.id + '">' +
        '<div class="ac-top">' +
          '<span class="ac-tag">' + esc(a.service || '—') + '</span>' +
          '<span class="ac-status st-' + st.key + '">' + dotHtml(st.key) + st.label + '</span>' +
        '</div>' +
        '<h3 class="ac-user" title="Bấm để sao chép tên đăng nhập">' + esc(a.username) + '</h3>' +
        (a.note ? '<p class="ac-note">' + esc(a.note) + '</p>' : '') +
        '<div class="pwdcell"><code class="pw">' + pwText + '</code>' +
          '<button class="iconbtn" data-act="reveal" title="Hiện/Ẩn mật khẩu">👁</button>' +
          '<button class="iconbtn" data-act="copypw" title="Sao chép mật khẩu">📋</button></div>' +
        '<dl class="ac-meta">' +
          '<div><dt>Gói</dt><dd>' + esc(a.package || '—') + '</dd></div>' +
          '<div><dt>Đăng ký</dt><dd class="mono-date">' + fmtD(a.registeredAt) + '</dd></div>' +
          '<div><dt>Hết hạn</dt><dd class="mono-date"><b>' + fmtD(a.expiresAt) + '</b></dd></div>' +
          '<div><dt>Còn lại</dt><dd class="mono-date">' + esc(st.txt || '—') + '</dd></div>' +
        '</dl>' +
        '<div class="ac-foot">' +
          '<span class="ac-days d-' + st.key + '">' + esc(st.txt || st.label) + '</span>' +
          '<span class="ac-acts">' +
            '<button class="iconbtn" data-act="edit" title="Sửa">✏️</button>' +
            '<button class="iconbtn danger" data-act="del" title="Xóa">🗑️</button>' +
          '</span>' +
        '</div>' +
        '</article>';
    }).join('');
  }

  function renderLists() {
    const svcs = [...new Set(COMMON_SERVICES.concat(accounts.map(a => a.service).filter(Boolean)))];
    $('#svcList').innerHTML = svcs.map(s => '<option value="' + esc(s) + '">').join('');
    const pkgs = [...new Set(accounts.map(a => (a.package || '').trim()).filter(Boolean))];
    $('#pkgList').innerHTML = pkgs.map(p => '<option value="' + esc(p) + '">').join('');
  }

  /* ---------- Sự kiện lưới thẻ ---------- */
  $('#grid').addEventListener('click', async e => {
    const card = e.target.closest('.acc-card[data-id]');
    if (!card) return;
    const acc = accounts.find(x => x.id === card.dataset.id);
    if (!acc) return;
    const btn = e.target.closest('button[data-act]');
    if (!btn) { if (e.target.closest('.ac-user')) copyText(acc.username); return; }
    const act = btn.dataset.act;
    if (act === 'reveal') { revealed.has(acc.id) ? revealed.delete(acc.id) : revealed.add(acc.id); renderCards(); }
    else if (act === 'copypw') copyText(acc.password);
    else if (act === 'edit') openDialog(acc);
    else if (act === 'del') {
      if (!confirm('Xóa tài khoản "' + acc.username + '"?\nHành động này không thể hoàn tác.')) return;
      busyOn(btn);
      const { error } = await sb.from('accounts').delete().eq('id', acc.id);
      busyOff(btn);
      if (error) { toast('⚠️ ' + viErr(error)); return; }
      accounts = accounts.filter(x => x.id !== acc.id);
      render(); toast('Đã xóa tài khoản "' + acc.username + '"');
    }
  });

  /* ---------- Bộ lọc ---------- */
  $('#q').addEventListener('input', e => { ui.q = e.target.value; renderCards(); });
  $('#svcPills').addEventListener('click', e => {
    const b = e.target.closest('.filter-btn');
    if (!b) return;
    ui.service = b.dataset.value;
    prefs.service = ui.service; savePrefs();
    renderPills(); renderCards();
  });
  $('#stPills').addEventListener('click', e => {
    const b = e.target.closest('.filter-btn');
    if (!b) return;
    ui.status = b.dataset.value || 'all';
    prefs.status = ui.status; savePrefs();
    renderPills(); renderCards();
  });
  $('#fSort').addEventListener('change', e => { ui.sort = e.target.value; prefs.sort = ui.sort; savePrefs(); renderCards(); });
  $('#fThreshold').addEventListener('change', e => { ui.threshold = +e.target.value; prefs.threshold = ui.threshold; savePrefs(); render(); });
  $('#btnRefresh').addEventListener('click', () => { toast('Đang làm mới…'); loadAll(); });

  /* ---------- Tab ---------- */
  function switchTab(name) {
    document.querySelectorAll('.tabbtn').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    $('#tab-manage').hidden = name !== 'manage';
    $('#tab-lookup').hidden = name !== 'lookup';
    if (name === 'lookup') setTimeout(() => $('#lkInput').focus(), 60);
  }
  document.querySelectorAll('.tabbtn').forEach(t => t.addEventListener('click', () => switchTab(t.dataset.tab)));

  /* ---------- Đăng xuất ---------- */
  $('#btnLogout').addEventListener('click', async () => {
    await sb.auth.signOut();
    user = null; accounts = []; revealed.clear();
    showAuth();
  });

  /* ---------- Dialog thêm / sửa ---------- */
  const dlg = $('#dlg');
  function openDialog(acc) {
    $('#dlgTitle').textContent = acc ? 'Sửa tài khoản' : 'Thêm tài khoản';
    $('#fId').value = acc ? acc.id : '';
    $('#fUser').value = acc ? acc.username : '';
    $('#fPass').value = acc ? acc.password : '';
    $('#fPass').type = 'password';
    $('#fService').value = acc ? (acc.service || '') : '';
    $('#fPkg').value = acc ? (acc.package || '') : '';
    $('#fReg').value = acc ? (acc.registeredAt || '') : toISO(new Date());
    $('#fExp').value = acc ? (acc.expiresAt || '') : '';
    $('#fNote').value = acc ? (acc.note || '') : '';
    renderLists();
    dlg.showModal();
    setTimeout(() => $('#fUser').focus(), 60);
  }
  $('#btnAdd').addEventListener('click', () => openDialog(null));
  $('#dlgCancel').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
  $('#fPassToggle').addEventListener('click', () => {
    const p = $('#fPass');
    p.type = p.type === 'password' ? 'text' : 'password';
  });
  document.querySelectorAll('.quick button').forEach(b => b.addEventListener('click', () => {
    const base = $('#fReg').value || toISO(new Date());
    $('#fExp').value = addMonths(base, +b.dataset.m);
  }));

  $('#form').addEventListener('submit', async e => {
    e.preventDefault();
    if (busy) return;
    const id = $('#fId').value;
    const username = $('#fUser').value.trim();
    const expiresAt = $('#fExp').value;
    if (!username || !expiresAt) { toast('⚠️ Vui lòng nhập tên tài khoản và ngày hết hạn'); return; }
    const dup = accounts.find(a => a.username.trim().toLowerCase() === username.toLowerCase() && a.id !== id);
    if (dup) { toast('⚠️ Tài khoản "' + username + '" đã tồn tại — hãy sửa tài khoản cũ thay vì thêm mới'); return; }
    const data = {
      username,
      password: $('#fPass').value,
      service: $('#fService').value.trim(),
      package: $('#fPkg').value.trim(),
      registeredAt: $('#fReg').value,
      expiresAt,
      note: $('#fNote').value.trim()
    };
    const btn = $('#btnSave');
    busyOn(btn);
    try {
      if (id) {
        const { data: row, error } = await sb.from('accounts').update(toRow(data)).eq('id', id).select().single();
        if (error) { toast('⚠️ ' + viErr(error)); return; }
        accounts = accounts.map(a => a.id === id ? fromRow(row) : a);
        toast('✅ Đã cập nhật "' + username + '"');
      } else {
        const { data: row, error } = await sb.from('accounts').insert([toRow(data)]).select().single();
        if (error) { toast('⚠️ ' + viErr(error)); return; }
        accounts.push(fromRow(row));
        toast('✅ Đã thêm "' + username + '"');
      }
      render();
      dlg.close();
    } catch (err) {
      toast('⚠️ ' + viErr(err));
    } finally { busyOff(btn); }
  });

  /* ---------- Tra cứu chính xác ---------- */
  function doLookup() {
    const q = $('#lkInput').value.trim().toLowerCase();
    const box = $('#lkResult');
    if (!q) { toast('Nhập tên tài khoản cần tra cứu'); return; }
    lookupRevealed = false;
    currentLookup = accounts.find(a => a.username.trim().toLowerCase() === q) || null;
    if (!currentLookup) {
      const sugg = accounts.filter(a => a.username.toLowerCase().includes(q)).slice(0, 6);
      box.innerHTML = '<div class="result none"><p>❌ Không tìm thấy tài khoản <b>"' + esc(q) + '"</b> trong danh sách.</p>' +
        (sugg.length ? '<p>Có phải bạn muốn tìm: ' +
          sugg.map(a => '<button class="linkbtn" data-u="' + esc(a.username) + '">' + esc(a.username) + '</button>').join(', ') + '</p>' : '') +
        '</div>';
      return;
    }
    const a = currentLookup;
    const st = statusOf(a);
    const pwText = '•'.repeat(Math.min(12, Math.max(4, a.password.length)));
    box.innerHTML = '<div class="result">' +
      '<div class="r-head"><h3>' + esc(a.username) + '</h3>' +
        (a.service ? '<span class="r-tag">' + esc(a.service) + '</span>' : '') +
        '<span class="ac-status st-' + st.key + '">' + dotHtml(st.key) + st.label + '</span>' +
      '</div>' +
      '<div class="r-row"><span>Mật khẩu</span><div class="pwdcell"><code class="pw" id="lkPw">' + pwText + '</code>' +
        '<button class="iconbtn" data-act="reveal" title="Hiện/Ẩn mật khẩu">👁</button>' +
        '<button class="iconbtn" data-act="copypw" title="Sao chép mật khẩu">📋</button></div></div>' +
      '<div class="r-row"><span>Loại</span><b>' + esc(a.service || '—') + '</b></div>' +
      '<div class="r-row"><span>Gói</span><b>' + esc(a.package || '—') + '</b></div>' +
      '<div class="r-row"><span>Đăng ký</span><b class="mono-date">' + fmtD(a.registeredAt) + '</b></div>' +
      '<div class="r-row"><span>Hết hạn</span><b class="mono-date">' + fmtD(a.expiresAt) + '</b></div>' +
      '<div class="r-row"><span>Tình trạng</span><b>' + esc(st.txt || st.label) + '</b></div>' +
      (a.note ? '<div class="r-row"><span>Ghi chú</span><b>' + esc(a.note) + '</b></div>' : '') +
      '<div class="r-actions">' +
        '<button class="btn" data-act="copyuser">📋 Copy tên đăng nhập</button>' +
        '<button class="btn primary" data-act="edit">✏️ Sửa tài khoản này</button>' +
      '</div></div>';
  }
  $('#lkBtn').addEventListener('click', doLookup);
  $('#lkInput').addEventListener('keydown', e => { if (e.key === 'Enter') doLookup(); });
  $('#lkResult').addEventListener('click', e => {
    const lb = e.target.closest('.linkbtn');
    if (lb) { $('#lkInput').value = lb.dataset.u; doLookup(); return; }
    if (!currentLookup) return;
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'reveal') {
      lookupRevealed = !lookupRevealed;
      $('#lkPw').textContent = lookupRevealed ? currentLookup.password
        : '•'.repeat(Math.min(12, Math.max(4, currentLookup.password.length)));
    }
    else if (act === 'copypw') copyText(currentLookup.password);
    else if (act === 'copyuser') copyText(currentLookup.username);
    else if (act === 'edit') openDialog(currentLookup);
  });

  /* ---------- Xuất / nhập ---------- */
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };
  function downloadBlob(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
  const exportShape = a => ({ username: a.username, password: a.password, service: a.service, package: a.package, registeredAt: a.registeredAt, expiresAt: a.expiresAt, note: a.note });
  $('#dataMenu').addEventListener('click', e => { if (e.target.closest('button')) $('#dataMenu').removeAttribute('open'); });
  $('#btnExportJson').addEventListener('click', () => {
    if (!accounts.length) { toast('Chưa có tài khoản nào để xuất'); return; }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), accounts: accounts.map(exportShape) }, null, 2)], { type: 'application/json' });
    downloadBlob(blob, 'tai-khoan-backup-' + stamp() + '.json');
    toast('Đã tải file sao lưu JSON');
  });
  $('#btnExportCsv').addEventListener('click', () => {
    if (!accounts.length) { toast('Chưa có tài khoản nào để xuất'); return; }
    const rows = [['Tên tài khoản', 'Mật khẩu', 'Loại', 'Gói đăng ký', 'Ngày đăng ký', 'Ngày hết hạn', 'Trạng thái', 'Ghi chú']];
    visibleAccounts().forEach(a => rows.push([a.username, a.password, a.service, a.package, fmtD(a.registeredAt), fmtD(a.expiresAt), statusOf(a).label, a.note]));
    const csv = '\uFEFF' + rows.map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'tai-khoan-' + stamp() + '.csv');
    toast('Đã tải file CSV (mở được bằng Excel)');
  });
  $('#btnImport').addEventListener('click', () => $('#fileImport').click());
  $('#fileImport').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file || !user) return;
    let arr = null;
    try {
      const data = JSON.parse(await file.text());
      arr = Array.isArray(data) ? data : (Array.isArray(data.accounts) ? data.accounts : null);
    } catch (err) { toast('⚠️ File không đúng định dạng JSON'); return; }
    if (!arr) { toast('⚠️ File không đúng định dạng JSON đã xuất'); return; }
    const norm = it => {
      if (!it || typeof it !== 'object') return null;
      const u = String(it.username || '').trim();
      const ex = String(it.expiresAt || it.expires_at || '').trim();
      if (!u || !/^\d{4}-\d{2}-\d{2}$/.test(ex)) return null;
      const reg = String(it.registeredAt || it.registered_at || '').trim();
      return {
        username: u, password: String(it.password ?? ''), service: String(it.service ?? ''),
        package: String(it.package ?? ''), registered_at: /^\d{4}-\d{2}-\d{2}$/.test(reg) ? reg : null,
        expires_at: ex, note: String(it.note ?? '')
      };
    };
    const seen = new Set(accounts.map(a => a.username.trim().toLowerCase()));
    const rows = []; let skipped = 0;
    for (const it of arr) {
      const r = norm(it);
      if (!r) { skipped++; continue; }
      const k = r.username.toLowerCase();
      if (seen.has(k)) { skipped++; continue; }
      seen.add(k); rows.push(r);
    }
    if (!rows.length) { toast('Không có tài khoản mới nào để nhập' + (skipped ? ' (bỏ qua ' + skipped + ' mục trùng/không hợp lệ)' : '')); return; }
    const { data: inserted, error } = await sb.from('accounts').insert(rows).select();
    if (error) { toast('⚠️ ' + viErr(error)); return; }
    (inserted || []).forEach(r => accounts.push(fromRow(r)));
    render();
    toast('Đã nhập ' + (inserted ? inserted.length : 0) + ' tài khoản' + (skipped ? ' (bỏ qua ' + skipped + ' mục trùng/không hợp lệ)' : ''));
  });

  /* ---------- PWA / cài đặt ---------- */
  let deferredPrompt = null;
  const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function wirePWA() {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      deferredPrompt = e;
      if (!isStandalone()) $('#btnInstall').hidden = false;
    });
    $('#btnInstall').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try { await deferredPrompt.userChoice; } catch (e) {}
        deferredPrompt = null;
        $('#btnInstall').hidden = true;
      } else if (isIos()) {
        toast('Trên iPhone: bấm nút Chia sẻ (□↑) → chọn "Thêm vào Màn hình chính"', 5200);
      } else {
        toast('Trình duyệt này chưa hỗ trợ cài đặt — dùng Chrome/Edge hoặc Safari trên iPhone.');
      }
    });
    if (isStandalone()) $('#btnInstall').hidden = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && user) loadAll();
    });
  }

  /* ---------- Tiện ích ---------- */
  let toastTimer;
  function toast(msg, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms || 2600);
  }
  function busyOn(btn) { busy = true; if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = '⏳ Đang lưu…'; } }
  function busyOff(btn) { busy = false; if (btn) { btn.disabled = false; if (btn.dataset.orig) btn.textContent = btn.dataset.orig; } }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('📋 Đã sao chép'); }
    catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); toast('📋 Đã sao chép'); }
      catch (_) { toast('Không sao chép được — hãy copy thủ công'); }
      ta.remove();
    }
  }

  boot();
})();
