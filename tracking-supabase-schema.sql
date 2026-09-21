-- ============================================================
-- CNGPHM TRACKING HUB — Cloud Project Registry
-- Chạy MỘT LẦN trong Supabase SQL Editor của project:
-- https://kksnzaswotrgkrxxwfcm.supabase.co
-- ============================================================

-- 1. Registry dự án: metadata đồng bộ giữa mọi thiết bị cùng tài khoản.
create table if not exists public.tracking_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  title text not null default '',
  sheet_id text not null,
  sheet_url text not null,
  share_token uuid not null default gen_random_uuid() unique,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sheet_id)
);

create index if not exists tracking_projects_user_id_idx
  on public.tracking_projects(user_id);

create index if not exists tracking_projects_active_user_idx
  on public.tracking_projects(user_id)
  where deleted_at is null;

alter table public.tracking_projects enable row level security;

grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on table public.tracking_projects to authenticated;

-- Chủ tài khoản chỉ nhìn và quản lý các dự án của chính mình.
drop policy if exists "own_tracking_projects_only" on public.tracking_projects;
create policy "own_tracking_projects_only"
  on public.tracking_projects for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. Tự động cập nhật updated_at.
-- Hàm touch_updated_at đã có nếu bạn từng chạy schema license-tools;
-- create or replace giúp file này hoạt động độc lập.
create or replace function public.touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tracking_projects_touch on public.tracking_projects;
create trigger tracking_projects_touch
  before update on public.tracking_projects
  for each row execute function public.touch_updated_at();

-- 3. RPC dành cho link khách hàng.
-- Chỉ trả đúng metadata cần thiết của duy nhất một project được share;
-- không cấp anonymous SELECT trực tiếp vào table tracking_projects.
create or replace function public.get_shared_tracking_project(token uuid)
returns table (
  id uuid,
  name text,
  title text,
  sheet_id text,
  sheet_url text
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.name, p.title, p.sheet_id, p.sheet_url
  from public.tracking_projects p
  where p.share_token = token
    and p.deleted_at is null
  limit 1;
$$;

grant execute on function public.get_shared_tracking_project(uuid) to anon, authenticated;

-- 4. Cho phép upsert từ client theo (user_id, sheet_id).
-- Không cần thêm policy: owner-only RLS phía trên đã kiểm soát thao tác.
