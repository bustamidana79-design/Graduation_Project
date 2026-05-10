-- Notifications schema hardening + RLS.
-- Run in Supabase SQL Editor. Realtime must also be enabled for this table.

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  notification_type text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default timezone('utc'::text, now())
);

alter table public.notifications add column if not exists notification_type text;
alter table public.notifications add column if not exists data jsonb not null default '{}'::jsonb;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists read_at timestamptz;
alter table public.notifications add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

create index if not exists notifications_user_created_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id)
  where is_read = false;

alter table public.notifications enable row level security;

drop policy if exists notifications_owner_select on public.notifications;
create policy notifications_owner_select
on public.notifications for select
using (user_id = auth.uid());

drop policy if exists notifications_owner_update on public.notifications;
create policy notifications_owner_update
on public.notifications for update
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_owner_insert on public.notifications;
create policy notifications_owner_insert
on public.notifications for insert
with check (user_id = auth.uid());

-- If realtime is not enabled yet, run this once with owner privileges:
-- alter publication supabase_realtime add table public.notifications;
-- alter publication supabase_realtime add table public.orders;
-- alter publication supabase_realtime add table public.delivery_orders;
-- alter publication supabase_realtime add table public.delivery_tracking;
