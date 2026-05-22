create extension if not exists pgcrypto;

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  shipping_company_id uuid not null references public.shipping_company_profiles(user_id) on delete cascade,
  city text not null,
  area text not null,
  price numeric(12,2) not null check (price >= 0),
  created_at timestamp default now()
);

create index if not exists shipping_rates_company_city_area_idx
on public.shipping_rates (shipping_company_id, city, area);

alter table public.shipping_rates enable row level security;

drop policy if exists shipping_rates_read_authenticated on public.shipping_rates;
create policy shipping_rates_read_authenticated
on public.shipping_rates for select
using (auth.uid() is not null or public.is_admin());

drop policy if exists shipping_rates_company_insert on public.shipping_rates;
create policy shipping_rates_company_insert
on public.shipping_rates for insert
with check (shipping_company_id = auth.uid() or public.is_admin());

drop policy if exists shipping_rates_company_update on public.shipping_rates;
create policy shipping_rates_company_update
on public.shipping_rates for update
using (shipping_company_id = auth.uid() or public.is_admin())
with check (shipping_company_id = auth.uid() or public.is_admin());

notify pgrst, 'reload schema';
