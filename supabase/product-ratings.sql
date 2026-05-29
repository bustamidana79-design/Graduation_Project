alter table public.products add column if not exists rating_average numeric default 0;
alter table public.products add column if not exists rating_count integer default 0;

create table if not exists public.product_ratings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (product_id, user_id)
);

create index if not exists product_ratings_product_idx
  on public.product_ratings (product_id);

update public.products
set
  rating_average = coalesce(rating_average, 0),
  rating_count = coalesce(rating_count, 0);
