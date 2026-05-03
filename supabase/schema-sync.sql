-- Schema sync for the current application code.
-- Run this in Supabase SQL Editor with an owner/service role.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- profiles: the code uses profiles.id as the auth user id.
-- If an older schema has profiles.user_id, migrate it to profiles.id.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id'
  ) and not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    alter table public.profiles rename column user_id to id;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id'
  ) then
    alter table public.profiles add column id uuid;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'user_id'
  ) then
    update public.profiles set id = coalesce(id, user_id) where id is null;
  end if;
end $$;

alter table public.profiles alter column id set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'p'
  ) then
    alter table public.profiles add constraint profiles_pkey primary key (id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_id_fkey'
  ) then
    alter table public.profiles
      add constraint profiles_id_fkey foreign key (id) references auth.users(id) on delete cascade;
  end if;
end $$;

alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists email_verified boolean default false;
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists created_at timestamp default now();
alter table public.profiles add column if not exists updated_at timestamp default now();

-- ---------------------------------------------------------------------------
-- applications: AI cache columns used by register/admin applications pages.
-- ---------------------------------------------------------------------------
alter table public.applications add column if not exists ai_score numeric;
alter table public.applications add column if not exists ai_recommendation text;
alter table public.applications add column if not exists ai_reason text;
alter table public.applications add column if not exists ai_risk text;
alter table public.applications add column if not exists ai_checked boolean default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_ai_recommendation_check'
  ) then
    alter table public.applications
      add constraint applications_ai_recommendation_check
      check (ai_recommendation is null or ai_recommendation in ('approve', 'review', 'reject'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.applications'::regclass
      and conname = 'applications_ai_risk_check'
  ) then
    alter table public.applications
      add constraint applications_ai_risk_check
      check (ai_risk is null or ai_risk in ('low', 'medium', 'high'));
  end if;
end $$;

-- Admin dashboard currently reads this table for counts.
create table if not exists public.upgrade_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  status text default 'pending' check (status in ('pending', 'approved', 'rejected')),
  request_json jsonb,
  admin_note text,
  reviewed_at timestamp,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamp default now()
);

-- ---------------------------------------------------------------------------
-- Helper for RLS policies.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- RLS policies aligned with profiles.id.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.ai_recommendation enable row level security;
alter table public.verification_files enable row level security;
alter table public.admin_reviews enable row level security;
alter table public.profile_roles enable row level security;
alter table public.upgrade_requests enable row level security;

drop policy if exists profiles_select_own_public_or_admin on public.profiles;
create policy profiles_select_own_public_or_admin
on public.profiles for select
using (auth.uid() = id or status = 'approved' or public.is_admin());

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles for insert
with check (auth.uid() = id or public.is_admin());

drop policy if exists profiles_update_own_or_admin on public.profiles;
create policy profiles_update_own_or_admin
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

drop policy if exists applications_select_own_or_admin on public.applications;
create policy applications_select_own_or_admin
on public.applications for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists applications_insert_own on public.applications;
create policy applications_insert_own
on public.applications for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists applications_update_own_ai_or_admin on public.applications;
create policy applications_update_own_ai_or_admin
on public.applications for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists ai_recommendation_select_related_or_admin on public.ai_recommendation;
create policy ai_recommendation_select_related_or_admin
on public.ai_recommendation for select
using (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists ai_recommendation_insert_related_or_admin on public.ai_recommendation;
create policy ai_recommendation_insert_related_or_admin
on public.ai_recommendation for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists ai_recommendation_update_related_or_admin on public.ai_recommendation;
create policy ai_recommendation_update_related_or_admin
on public.ai_recommendation for update
using (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists admin_reviews_admin_all on public.admin_reviews;
create policy admin_reviews_admin_all
on public.admin_reviews for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists verification_files_select_related_or_admin on public.verification_files;
create policy verification_files_select_related_or_admin
on public.verification_files for select
using (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists verification_files_insert_related_or_admin on public.verification_files;
create policy verification_files_insert_related_or_admin
on public.verification_files for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.applications a
    where a.id = application_id and a.user_id = auth.uid()
  )
);

drop policy if exists profile_roles_select_own_or_admin on public.profile_roles;
create policy profile_roles_select_own_or_admin
on public.profile_roles for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists profile_roles_admin_write on public.profile_roles;
create policy profile_roles_admin_write
on public.profile_roles for all
using (public.is_admin())
with check (public.is_admin());

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
