-- Upgrade requests schema + RLS.
-- Run in Supabase SQL Editor with owner/service privileges.

create extension if not exists pgcrypto;

create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  request_json jsonb not null default '{}'::jsonb,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.upgrade_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'pending',
  add column if not exists request_json jsonb not null default '{}'::jsonb,
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.upgrade_requests'::regclass
      and conname = 'upgrade_requests_status_check'
  ) then
    alter table public.upgrade_requests
      add constraint upgrade_requests_status_check
      check (status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists upgrade_requests_user_created_idx
  on public.upgrade_requests (user_id, created_at desc);

create index if not exists upgrade_requests_status_created_idx
  on public.upgrade_requests (status, created_at desc);

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'admin'
  )
  or exists (
    select 1
    from public.profile_roles pr
    join public.roles r on r.id = pr.role_id
    where pr.user_id = auth.uid()
      and r.name = 'admin'
  );
$$;

alter table public.upgrade_requests enable row level security;

drop policy if exists upgrade_requests_select_own_or_admin on public.upgrade_requests;
create policy upgrade_requests_select_own_or_admin
on public.upgrade_requests for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists upgrade_requests_insert_own on public.upgrade_requests;
create policy upgrade_requests_insert_own
on public.upgrade_requests for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists upgrade_requests_admin_update on public.upgrade_requests;
create policy upgrade_requests_admin_update
on public.upgrade_requests for update
using (public.is_admin())
with check (public.is_admin());

notify pgrst, 'reload schema';
