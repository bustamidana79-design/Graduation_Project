create extension if not exists pgcrypto;

create table if not exists public.investments (
  id uuid primary key default gen_random_uuid(),
  supporter_id uuid not null references public.profiles(id) on delete cascade,
  small_business_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null default 0 check (amount >= 0),
  currency text not null default 'ILS' check (currency in ('ILS', 'USD', 'JOD')),
  investment_type text not null default 'funding'
    check (investment_type in ('funding', 'partnership', 'mentorship', 'services', 'other')),
  expected_return numeric check (expected_return is null or expected_return >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.investments
  add column if not exists supporter_id uuid references public.profiles(id) on delete cascade,
  add column if not exists small_business_id uuid references public.profiles(id) on delete cascade,
  add column if not exists project_owner_id uuid references public.profiles(id) on delete cascade,
  add column if not exists amount numeric not null default 0,
  add column if not exists currency text not null default 'ILS',
  add column if not exists investment_type text not null default 'funding',
  add column if not exists expected_return numeric,
  add column if not exists status text not null default 'pending',
  add column if not exists notes text,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now()),
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investments'
      and column_name = 'investor_id'
  ) then
    update public.investments
    set supporter_id = coalesce(supporter_id, investor_id)
    where supporter_id is null;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'investments'
      and column_name = 'project_id'
  ) then
    update public.investments
    set small_business_id = coalesce(small_business_id, project_id)
    where small_business_id is null;
  end if;

  update public.investments
  set project_owner_id = coalesce(project_owner_id, small_business_id)
  where project_owner_id is null
    and small_business_id is not null;

  update public.investments
  set small_business_id = coalesce(small_business_id, project_owner_id)
  where small_business_id is null
    and project_owner_id is not null;
end $$;

alter table public.investments
  alter column amount set default 0,
  alter column currency set default 'ILS',
  alter column investment_type set default 'funding',
  alter column status set default 'pending',
  alter column created_at set default timezone('utc'::text, now()),
  alter column updated_at set default timezone('utc'::text, now());

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.investments'::regclass
      and conname = 'investments_amount_check'
  ) then
    alter table public.investments
      add constraint investments_amount_check check (amount >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.investments'::regclass
      and conname = 'investments_currency_check'
  ) then
    alter table public.investments
      add constraint investments_currency_check check (currency in ('ILS', 'USD', 'JOD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.investments'::regclass
      and conname = 'investments_investment_type_check'
  ) then
    alter table public.investments
      add constraint investments_investment_type_check
      check (investment_type in ('funding', 'partnership', 'mentorship', 'services', 'other'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.investments'::regclass
      and conname = 'investments_expected_return_check'
  ) then
    alter table public.investments
      add constraint investments_expected_return_check
      check (expected_return is null or expected_return >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.investments'::regclass
      and conname = 'investments_status_check'
  ) then
    alter table public.investments
      add constraint investments_status_check
      check (status in ('pending', 'active', 'completed', 'cancelled'));
  end if;
end $$;

create index if not exists investments_supporter_created_idx
  on public.investments (supporter_id, created_at desc);

create index if not exists investments_small_business_created_idx
  on public.investments (small_business_id, created_at desc);

create index if not exists investments_project_owner_created_idx
  on public.investments (project_owner_id, created_at desc);

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

create or replace function public.set_investments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists investments_set_updated_at on public.investments;
create trigger investments_set_updated_at
before update on public.investments
for each row execute function public.set_investments_updated_at();

alter table public.investments enable row level security;

drop policy if exists investments_select_participants_or_admin on public.investments;
create policy investments_select_participants_or_admin
on public.investments for select
using (
  auth.uid() = supporter_id
  or auth.uid() = small_business_id
  or auth.uid() = project_owner_id
  or public.is_admin()
);

drop policy if exists investments_supporter_insert on public.investments;
create policy investments_supporter_insert
on public.investments for insert
with check (
  auth.uid() = supporter_id
  and exists (
    select 1
    from public.profiles p
    where p.id = supporter_id
      and p.account_type = 'supporter'
      and p.status = 'approved'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = small_business_id
      and p.account_type = 'small_business'
      and p.status = 'approved'
  )
  and (project_owner_id is null or project_owner_id = small_business_id)
);

drop policy if exists investments_supporter_update on public.investments;
create policy investments_supporter_update
on public.investments for update
using (auth.uid() = supporter_id or public.is_admin())
with check (auth.uid() = supporter_id or public.is_admin());

drop policy if exists investments_small_business_status_update on public.investments;
create policy investments_small_business_status_update
on public.investments for update
using (auth.uid() = small_business_id or auth.uid() = project_owner_id or public.is_admin())
with check (auth.uid() = small_business_id or auth.uid() = project_owner_id or public.is_admin());

notify pgrst, 'reload schema';
