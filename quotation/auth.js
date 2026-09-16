'use strict';
/* ============================================================
   ODD PIG QUOTATION — Auth gate (Supabase, dùng chung license-tools)
   - Cùng origin oddpig.io.vn → session chia sẻ với /license-tools/
   - file:// và localhost: bỏ qua (tool offline vẫn dùng được)
   ============================================================ */
(() => {
  const cfg = window.QA_CONFIG || {};
  const $ = s => document.querySelector(s);

  const BYPASS = location.protocol === 'file:' ||
    ['localhost', '127.0.0.1'].includes(location.hostname);

  let sb = null;

  const ERR_VI = [
    ['Invalid login credentials', 'Email hoặc mật khẩu không đúng.'],
    ['Email not confirmed', 'Email chưa được xác nhận — hãy kiểm tra hộp thư.'],
    ['invalid format', 'Địa chỉ email không hợp lệ.'],
    ['Failed to fetch', 'Mất kết nối mạng — kiểm tra internet rồi thử lại.']
  ];
  const viErr = e => {
    const m = (e && (e.message || e.error_description)) || String(e || 'Có lỗi xảy ra');
    for (const [k, v] of ERR_VI) if (m.includes(k)) return v;
    return m;
  };

  function showLogin() { const o = $('#authView'); if (o) o.hidden = false; }
  function hideLogin() { const o = $('#authView'); if (o) o.hidden = true; }
  function setUser(u) {
    const chip = $('#userChip');
    if (!chip) return;
    if (u) { chip.hidden = false; $('#userEmail').textContent = u.email || ''; }
    else chip.hidden = true;
  }
  function formErr(msg) { const el = $('#liErr'); el.textContent = msg || ''; el.hidden = !msg; }

  function wire() {
    const form = $('#loginForm');
    if (form) form.addEventListener('submit', async e => {
      e.preventDefault();
      if (!sb) return;
      const email = $('#liEmail').value.trim(), password = $('#liPass').value;
      if (!email || !password) { formErr('Nhập email và mật khẩu.'); return; }
      formErr('');
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true; btn.textContent = 'Đang đăng nhập...';
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) { formErr(viErr(error)); return; }
        $('#liPass').value = '';
        if (data.session && data.session.user) { setUser(data.session.user); hideLogin(); }
      } catch (err) { formErr(viErr(err)); }
      finally { btn.disabled = false; btn.textContent = 'Đăng nhập →'; }
    });
    const btnOut = $('#btnLogout');
    if (btnOut) btnOut.addEventListener('click', async () => {
      try { if (sb) await sb.auth.signOut(); } catch (e) {}
      setUser(null);
      showLogin();
    });
  }

  function loadSdk() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      s.onload = () => resolve(true);
      s.onerror = () => reject(new Error('sdk'));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    wire();
    if (BYPASS) return; // dùng local (file://, localhost) — không chặn
    try {
      await loadSdk();
    } catch (e) {
      formErr('Không tải được thư viện đăng nhập — kiểm tra mạng rồi tải lại trang.');
      showLogin();
      return;
    }
    try {
      sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
      const { data: { session } } = await sb.auth.getSession();
      if (session && session.user) { setUser(session.user); hideLogin(); }
      else showLogin();
      sb.auth.onAuthStateChange((ev, session) => {
        if (session && session.user) { setUser(session.user); hideLogin(); }
        else if (ev === 'SIGNED_OUT') { setUser(null); showLogin(); }
      });
    } catch (e) {
      formErr('Không kết nối được hệ thống đăng nhập — thử tải lại trang.');
      showLogin();
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
