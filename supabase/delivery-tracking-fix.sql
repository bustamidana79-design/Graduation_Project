create extension if not exists pgcrypto;

create table if not exists public.delivery_tracking (
  id uuid primary key default gen_random_uuid(),
  delivery_order_id uuid not null references public.delivery_orders(id) on delete cascade,
  status text not null,
  description text,
  location text,
  created_at timestamp default now()
);

alter table public.delivery_tracking add column if not exists delivery_order_id uuid references public.delivery_orders(id) on delete cascade;
alter table public.delivery_tracking add column if not exists status text;
alter table public.delivery_tracking add column if not exists description text;
alter table public.delivery_tracking add column if not exists location text;
alter table public.delivery_tracking add column if not exists created_at timestamp default now();

create index if not exists delivery_tracking_delivery_order_created_idx
on public.delivery_tracking (delivery_order_id, created_at);

alter table public.delivery_tracking enable row level security;

drop policy if exists delivery_tracking_participants_select on public.delivery_tracking;
create policy delivery_tracking_participants_select
on public.delivery_tracking for select
using (
  exists (
    select 1 from public.delivery_orders d
    join public.orders o on o.id = d.order_id
    where d.id = delivery_tracking.delivery_order_id
      and (
        d.shipping_company_id = auth.uid()
        or o.buyer_id = auth.uid()
        or o.supplier_id = auth.uid()
      )
  )
);

drop policy if exists delivery_tracking_company_insert on public.delivery_tracking;
create policy delivery_tracking_company_insert
on public.delivery_tracking for insert
with check (
  exists (
    select 1 from public.delivery_orders d
    join public.orders o on o.id = d.order_id
    where d.id = delivery_tracking.delivery_order_id
      and (d.shipping_company_id = auth.uid() or o.buyer_id = auth.uid())
  )
);

notify pgrst, 'reload schema';
