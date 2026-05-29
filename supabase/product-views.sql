create table if not exists public.product_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists product_views_user_id_idx on public.product_views(user_id);
create index if not exists product_views_product_id_idx on public.product_views(product_id);
create index if not exists product_views_created_at_idx on public.product_views(created_at desc);

alter table public.product_views enable row level security;

drop policy if exists product_views_owner_insert on public.product_views;
create policy product_views_owner_insert
on public.product_views for insert
with check (user_id = auth.uid());

drop policy if exists product_views_owner_select on public.product_views;
create policy product_views_owner_select
on public.product_views for select
using (user_id = auth.uid());

drop policy if exists product_views_owner_delete on public.product_views;
create policy product_views_owner_delete
on public.product_views for delete
using (user_id = auth.uid());
