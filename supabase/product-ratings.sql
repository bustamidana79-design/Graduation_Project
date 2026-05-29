alter table public.products add column if not exists rating_average numeric default 0;
alter table public.products add column if not exists rating_count integer default 0;

update public.products
set
  rating_average = coalesce(rating_average, 0),
  rating_count = coalesce(rating_count, 0);
