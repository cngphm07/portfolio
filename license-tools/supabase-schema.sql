-- ============================================================
-- LICENSE-TOOLS — Schema cho Supabase (chạy 1 lần trong SQL Editor)
-- ============================================================

-- 1) Bảng lưu tài khoản. Mỗi user chỉ nhìn thấy dữ liệu của mình (RLS).
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  username text   not null,
  password text   not null default '',
  service  text   not null default '',
  package  text   not null default '',
  registered_at date,
  expires_at    date not null,
  note     text   not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists accounts_user_id_idx on public.accounts(user_id);

alter table public.accounts enable row level security;

-- Quyền truy cập cho role authenticated (RLS vẫn chặn: mỗi user chỉ thấy data của mình)
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.accounts to authenticated;

drop policy if exists "own_rows_only" on public.accounts;
create policy "own_rows_only"
  on public.accounts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2) Bảng cấu hình nội bộ (client KHÔNG đọc/sửa được vì không có policy)
create table if not exists public.app_settings (
  key   text primary key,
  value text not null
);
insert into public.app_settings (key, value) values ('signup_mode', 'open')
  on conflict (key) do nothing;

alter table public.app_settings enable row level security;

-- 3) Kiểm soát đăng ký: open = ai cũng đăng ký được;
--    first_only = chỉ user đầu tiên; closed = chặn hẳn.
create or replace function public.signup_allowed() returns trigger as $$
declare mode text; n int;
begin
  select value into mode from public.app_settings where key = 'signup_mode';
  if mode is null then mode := 'first_only'; end if;
  if mode = 'open' then return new; end if;
  select count(*) into n from auth.users;
  if mode = 'first_only' and n = 0 then return new; end if;
  raise exception 'Signup is closed';
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  before insert on auth.users
  for each row execute function public.signup_allowed();

-- 4) Tự động cập nhật updated_at
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists accounts_touch on public.accounts;
create trigger accounts_touch before update on public.accounts
  for each row execute function public.touch_updated_at();
