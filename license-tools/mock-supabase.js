// Mock Supabase client — chỉ dùng để chạy thử (demo offline) khi chưa cấu hình Supabase.
// Giả lập đúng diện tích API mà app.js sử dụng: auth + from('accounts') CRUD.
// Dữ liệu lưu trong localStorage của trình duyệt — KHÔNG dùng trong production.
'use strict';
(function () {
  const LS_USERS = 'lt-mock-users';
  const LS_SESSION = 'lt-mock-session';
  const LS_DATA = 'lt-mock-data';

  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  const delay = (v) => new Promise(res => setTimeout(() => res(v), 80));

  class MockQuery {
    constructor(db, userId) { this.db = db; this.userId = userId; this.op = null; this.filters = []; this._order = null; this._single = false; }
    select() { this.op = this.op || 'select'; return this; }
    insert(rows) { this.op = 'insert'; this.payload = rows; return this; }
    update(row) { this.op = 'update'; this.payload = row; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(col, val) { this.filters.push([col, val]); return this; }
    order(col, opts) { this._order = [col, !opts || opts.ascending !== false]; return this; }
    single() { this._single = true; return this; }
    then(resolve, reject) {
      return delay().then(() => {
        try { resolve(this._exec()); } catch (e) { reject(e); }
      });
    }
    _exec() {
      const all = read(LS_DATA, {});
      const rows = all[this.userId] || [];
      const match = r => this.filters.every(([c, v]) => r[c] === v);
      if (this.op === 'select') {
        let out = rows.filter(match);
        if (this._order) {
          const [col, asc] = this._order;
          out.sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
        }
        return { data: this._single ? out[0] ?? null : out, error: this._single && !out.length ? { message: 'Row not found' } : null };
      }
      if (this.op === 'insert') {
        const arr = Array.isArray(this.payload) ? this.payload : [this.payload];
        const created = arr.map(p => Object.assign({ id: uid(), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, p));
        all[this.userId] = rows.concat(created);
        write(LS_DATA, all);
        return { data: this._single ? created[0] : created, error: null };
      }
      if (this.op === 'update') {
        let updated = null;
        all[this.userId] = rows.map(r => {
          if (!match(r)) return r;
          updated = Object.assign({}, r, this.payload, { updated_at: new Date().toISOString() });
          return updated;
        });
        write(LS_DATA, all);
        return { data: this._single ? updated : updated ? [updated] : [], error: null };
      }
      if (this.op === 'delete') {
        const removed = rows.filter(match);
        all[this.userId] = rows.filter(r => !match(r));
        write(LS_DATA, all);
        return { data: removed, error: null };
      }
      return { data: null, error: { message: 'Unknown op' } };
    }
  }

  class MockSupabase {
    constructor() { this._listeners = []; }
    _emit(event, session) { this._listeners.forEach(cb => { try { cb(event, session); } catch (e) {} }); }
    from(table) { return new MockQuery(table, this._currentUserId()); }
    _currentUserId() { const s = read(LS_SESSION, null); return s ? s.user.id : null; }
    auth = {
      getSession: async () => ({ data: { session: read(LS_SESSION, null) }, error: null }),
      signUp: async ({ email, password }) => {
        const users = read(LS_USERS, []);
        if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) return { data: null, error: { message: 'User already registered' } };
        const user = { id: uid(), email };
        users.push({ id: user.id, email, password });
        write(LS_USERS, users);
        const session = { user };
        write(LS_SESSION, session);
        this._emit('SIGNED_IN', session);
        return { data: { user, session }, error: null };
      },
      signInWithPassword: async ({ email, password }) => {
        const users = read(LS_USERS, []);
        const u = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!u) return { data: null, error: { message: 'Invalid login credentials' } };
        const session = { user: { id: u.id, email: u.email } };
        write(LS_SESSION, session);
        this._emit('SIGNED_IN', session);
        return { data: { user: session.user, session }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem(LS_SESSION);
        this._emit('SIGNED_OUT', null);
        return { error: null };
      },
      onAuthStateChange: (cb) => { this._listeners.push(cb); return { data: { subscription: { unsubscribe() {} } } }; }
    };
  }

  window.MockSupabase = MockSupabase;
})();
