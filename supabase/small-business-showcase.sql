create extension if not exists pgcrypto;

create table if not exists public.small_business_showcase_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  item_link text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists small_business_showcase_user_idx
  on public.small_business_showcase_items (user_id, created_at desc);

alter table public.small_business_showcase_items enable row level security;

drop policy if exists "showcase items are public to approved users" on public.small_business_showcase_items;
create policy "showcase items are public to approved users"
  on public.small_business_showcase_items
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = small_business_showcase_items.user_id
        and profiles.status = 'approved'
    )
  );

drop policy if exists "small business owners manage showcase items" on public.small_business_showcase_items;
create policy "small business owners manage showcase items"
  on public.small_business_showcase_items
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
