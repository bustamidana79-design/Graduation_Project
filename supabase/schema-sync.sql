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
alter table public.profiles add column if not exists area text;
alter table public.profiles add column if not exists village text;
alter table public.profiles add column if not exists preferred_currency text default 'ILS';
alter table public.profiles add column if not exists email_verified boolean default false;
alter table public.profiles add column if not exists is_active boolean default true;
alter table public.profiles add column if not exists created_at timestamp default now();
alter table public.profiles add column if not exists updated_at timestamp default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and conname = 'profiles_preferred_currency_check'
  ) then
    alter table public.profiles
      add constraint profiles_preferred_currency_check
      check (preferred_currency in ('ILS', 'USD', 'JOD'));
  end if;
end $$;

alter table public.products add column if not exists currency text default 'ILS';
alter table public.products add column if not exists category text;
alter table public.supplier_profiles add column if not exists shipping_company_id uuid;
alter table public.orders add column if not exists currency text default 'ILS';
alter table public.orders add column if not exists phone text;
alter table public.orders add column if not exists country text;
alter table public.orders add column if not exists city text;
alter table public.orders add column if not exists area text;
alter table public.orders add column if not exists address_text text;
alter table public.orders add column if not exists postal_code text;
alter table public.orders add column if not exists shipping_company_id uuid references auth.users(id) on delete set null;
alter table public.orders add column if not exists shipping_cost numeric default 0;
alter table public.orders add column if not exists is_international boolean default false;
alter table public.orders add column if not exists customer_type text;
alter table public.orders add column if not exists national_id text;
alter table public.orders add column if not exists passport_number text;
alter table public.orders add column if not exists notes text;
alter table public.order_items add column if not exists currency text default 'ILS';
alter table public.order_items add column if not exists total_price numeric default 0;
alter table public.order_items add column if not exists line_total numeric default 0;
alter table public.payments add column if not exists currency text default 'ILS';
alter table public.payments add column if not exists payment_provider text default 'taler';
alter table public.payments add column if not exists payment_method text default 'taler';
alter table public.payments add column if not exists payment_status text default 'pending';
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists payment_url text;

update public.order_items
set total_price = coalesce(total_price, line_total, unit_price * quantity, 0)
where total_price is null;

update public.order_items
set line_total = coalesce(line_total, total_price, unit_price * quantity, 0)
where line_total is null;

update public.payments
set payment_provider = coalesce(payment_provider, 'taler')
where payment_provider is null;

update public.payments
set payment_method = coalesce(payment_method, payment_provider, 'taler')
where payment_method is null;

update public.payments
set payment_status = coalesce(payment_status, 'pending')
where payment_status is null;

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_payment_method_check'
  ) then
    alter table public.payments drop constraint payments_payment_method_check;
  end if;

  alter table public.payments
    add constraint payments_payment_method_check
    check (payment_method in ('taler', 'cash', 'card', 'credit_card', 'paypal', 'stripe', 'bank_transfer')) not valid;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.shipping_company_profiles'::regclass
      and conname = 'shipping_company_profiles_user_id_key'
  ) then
    alter table public.shipping_company_profiles
      add constraint shipping_company_profiles_user_id_key unique (user_id);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.supplier_profiles'::regclass
      and conname = 'supplier_profiles_shipping_company_id_fkey'
  ) then
    alter table public.supplier_profiles
      add constraint supplier_profiles_shipping_company_id_fkey
      foreign key (shipping_company_id) references public.shipping_company_profiles(user_id)
      on delete set null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'shipping_company_profiles'
      and column_name = 'delivery_cities'
      and udt_name = '_text'
  ) then
    update public.shipping_company_profiles
    set delivery_cities = array_replace(
      array_replace(
        array_replace(
          array_replace(
            array_replace(
              array_replace(
                array_replace(
                  array_replace(
                    array_replace(
                      array_replace(delivery_cities, 'Nablus', 'Ù†Ø§Ø¨Ù„Ø³'),
                      'Ramallah', 'Ø±Ø§Ù… Ø§Ù„Ù„Ù‡'
                    ),
                    'Hebron', 'Ø§Ù„Ø®Ù„ÙŠÙ„'
                  ),
                  'Jerusalem', 'Ø§Ù„Ù‚Ø¯Ø³'
                ),
                'Bethlehem', 'Ø¨ÙŠØª Ù„Ø­Ù…'
              ),
              'Jenin', 'Ø¬Ù†ÙŠÙ†'
            ),
            'Tulkarm', 'Ø·ÙˆÙ„ÙƒØ±Ù…'
          ),
          'Qalqilya', 'Ù‚Ù„Ù‚ÙŠÙ„ÙŠØ©'
        ),
        'Jericho', 'Ø£Ø±ÙŠØ­Ø§'
      ),
      'Gaza', 'ØºØ²Ø©'
    )
    where delivery_cities is not null;
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'shipping_company_profiles'
  ) then
    insert into public.shipping_company_profiles (
      user_id,
      company_name,
      delivery_scope,
      delivery_cities,
      avg_delivery_time,
      license_no
    )
    select
      p.id,
      coalesce(nullif(p.full_name, ''), 'Ø´Ø±ÙƒØ© Ø´Ø­Ù†'),
      'local',
      array_remove(array[p.city], null),
      'ØºÙŠØ± Ù…Ø­Ø¯Ø¯',
      'ØºÙŠØ± Ù…ØªÙˆÙØ±'
    from public.profiles p
    where p.account_type = 'delivery'
      and not exists (
        select 1
        from public.shipping_company_profiles scp
        where scp.user_id = p.id
      );
  end if;
end $$;
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists payment_url text;
alter table public.delivery_orders add column if not exists status text default 'picked_up';
alter table public.delivery_orders add column if not exists shipping_fee numeric default 0;
alter table public.delivery_orders add column if not exists avg_delivery_time text;

update public.order_items
set total_price = coalesce(total_price, line_total, unit_price * quantity, 0)
where total_price is null
  and unit_price is not null
  and quantity is not null;

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

create table if not exists public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  shipping_company_id uuid not null references public.shipping_company_profiles(user_id) on delete cascade,
  city text not null,
  area text not null,
  price numeric(12,2) not null check (price >= 0),
  created_at timestamp default now()
);

update public.shipping_rates
set area = ''
where area is null;

alter table public.shipping_rates
alter column area set not null;

create index if not exists shipping_rates_company_city_area_idx
on public.shipping_rates (shipping_company_id, city, area);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'shipping_address_id'
  ) then
    alter table public.orders alter column shipping_address_id drop not null;
  end if;
end $$;

create table if not exists public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  city text not null,
  street_address text not null,
  phone text,
  notes text,
  is_default boolean default false,
  created_at timestamp default now()
);

alter table public.addresses add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.addresses add column if not exists city text;
alter table public.addresses add column if not exists street_address text;
alter table public.addresses add column if not exists phone text;
alter table public.addresses add column if not exists notes text;
alter table public.addresses add column if not exists is_default boolean default false;
alter table public.addresses add column if not exists created_at timestamp default now();

-- Make PostgREST/Supabase refresh its schema cache after newly added columns.
notify pgrst, 'reload schema';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_currency_check'
  ) then
    alter table public.products
      add constraint products_currency_check
      check (currency in ('ILS', 'USD', 'JOD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.orders'::regclass
      and conname = 'orders_currency_check'
  ) then
    alter table public.orders
      add constraint orders_currency_check
      check (currency in ('ILS', 'USD', 'JOD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.order_items'::regclass
      and conname = 'order_items_currency_check'
  ) then
    alter table public.order_items
      add constraint order_items_currency_check
      check (currency in ('ILS', 'USD', 'JOD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.payments'::regclass
      and conname = 'payments_currency_check'
  ) then
    alter table public.payments
      add constraint payments_currency_check
      check (currency in ('ILS', 'USD', 'JOD'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.delivery_orders'::regclass
      and conname = 'delivery_orders_status_check'
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_status_check
      check (status in ('picked_up', 'in_transit', 'out_for_delivery', 'delivered'));
  end if;
end $$;

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

alter table public.upgrade_requests
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists status text not null default 'pending',
  add column if not exists request_json jsonb not null default '{}'::jsonb,
  add column if not exists admin_note text,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

create index if not exists upgrade_requests_user_created_idx
  on public.upgrade_requests (user_id, created_at desc);

create index if not exists upgrade_requests_status_created_idx
  on public.upgrade_requests (status, created_at desc);

-- ---------------------------------------------------------------------------
-- Daily personalized dashboard tips.
-- One stable tip per user per day, generated from profile and activity.
-- ---------------------------------------------------------------------------
create table if not exists public.daily_user_tips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tip_date date not null default current_date,
  account_type text not null,
  title text not null,
  body text not null,
  action_label text not null,
  action_href text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  source jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  unique (user_id, tip_date)
);

alter table public.daily_user_tips
  add column if not exists user_id uuid references public.profiles(id) on delete cascade,
  add column if not exists tip_date date not null default current_date,
  add column if not exists account_type text not null default 'merchant',
  add column if not exists title text not null default '',
  add column if not exists body text not null default '',
  add column if not exists action_label text not null default '',
  add column if not exists action_href text not null default '',
  add column if not exists priority text not null default 'medium',
  add column if not exists source jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default timezone('utc'::text, now());

create unique index if not exists daily_user_tips_user_date_idx
  on public.daily_user_tips (user_id, tip_date);

-- ---------------------------------------------------------------------------
-- AI chatbot sessions/messages.
-- Each user type gets its own assistant memory stream.
-- ---------------------------------------------------------------------------
create table if not exists public.ai_chat_sessions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references auth.users(id) on delete cascade,
  user_type text default 'supplier' check (user_type in ('supplier', 'merchant', 'delivery', 'supporter', 'admin')),
  title text,
  created_at timestamp default now(),
  updated_at timestamp default now()
);

create table if not exists public.ai_chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.ai_chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  message text not null,
  created_at timestamp default now()
);

alter table public.ai_chat_sessions add column if not exists user_type text default 'supplier';
alter table public.ai_chat_sessions add column if not exists title text;
alter table public.ai_chat_sessions add column if not exists updated_at timestamp default now();

create index if not exists ai_chat_sessions_profile_type_created_idx
on public.ai_chat_sessions (profile_id, user_type, created_at desc);

create index if not exists ai_chat_messages_session_created_idx
on public.ai_chat_messages (session_id, created_at);

-- ---------------------------------------------------------------------------
-- Notifications.
-- Used by support tickets, product moderation, orders, and realtime alerts.
-- ---------------------------------------------------------------------------
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

do $$
begin
  if exists (
    select 1 from pg_publication where pubname = 'supabase_realtime'
  ) and not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Customer support center.
-- Admin moderation actions, like product deletion, open a support ticket here.
-- ---------------------------------------------------------------------------
create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'pending')),
  user_role text not null,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  last_sender_type text not null default 'user' check (last_sender_type in ('user', 'admin')),
  ai_summary text,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create table if not exists public.ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_type text not null check (sender_type in ('user', 'admin')),
  message text not null,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists support_tickets_user_role_created_idx
  on public.support_tickets (user_id, user_role, created_at desc);

create index if not exists ticket_messages_ticket_created_idx
  on public.ticket_messages (ticket_id, created_at);

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
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies aligned with profiles.id.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.applications enable row level security;
alter table public.ai_recommendation enable row level security;
alter table public.verification_files enable row level security;
alter table public.admin_reviews enable row level security;
alter table public.profile_roles enable row level security;
alter table public.supplier_profiles enable row level security;
alter table public.shipping_company_profiles enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.upgrade_requests enable row level security;
alter table public.daily_user_tips enable row level security;
alter table public.ai_chat_sessions enable row level security;
alter table public.ai_chat_messages enable row level security;
alter table public.notifications enable row level security;
alter table public.support_tickets enable row level security;
alter table public.ticket_messages enable row level security;

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

drop policy if exists addresses_owner_all on public.addresses;
create policy addresses_owner_all
on public.addresses for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

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

drop policy if exists supplier_profiles_owner_or_admin_all on public.supplier_profiles;
create policy supplier_profiles_owner_or_admin_all
on public.supplier_profiles for all
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists shipping_company_profiles_read_authenticated on public.shipping_company_profiles;
create policy shipping_company_profiles_read_authenticated
on public.shipping_company_profiles for select
using (true);

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

drop policy if exists daily_user_tips_select_own_or_admin on public.daily_user_tips;
create policy daily_user_tips_select_own_or_admin
on public.daily_user_tips for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists daily_user_tips_insert_own_or_admin on public.daily_user_tips;
create policy daily_user_tips_insert_own_or_admin
on public.daily_user_tips for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists daily_user_tips_update_own_or_admin on public.daily_user_tips;
create policy daily_user_tips_update_own_or_admin
on public.daily_user_tips for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists ai_chat_sessions_select_own_or_admin on public.ai_chat_sessions;
create policy ai_chat_sessions_select_own_or_admin
on public.ai_chat_sessions for select
using (auth.uid() = profile_id or public.is_admin());

drop policy if exists ai_chat_sessions_insert_own_or_admin on public.ai_chat_sessions;
create policy ai_chat_sessions_insert_own_or_admin
on public.ai_chat_sessions for insert
with check (auth.uid() = profile_id or public.is_admin());

drop policy if exists ai_chat_sessions_update_own_or_admin on public.ai_chat_sessions;
create policy ai_chat_sessions_update_own_or_admin
on public.ai_chat_sessions for update
using (auth.uid() = profile_id or public.is_admin())
with check (auth.uid() = profile_id or public.is_admin());

drop policy if exists ai_chat_messages_select_own_or_admin on public.ai_chat_messages;
create policy ai_chat_messages_select_own_or_admin
on public.ai_chat_messages for select
using (
  public.is_admin()
  or exists (
    select 1 from public.ai_chat_sessions s
    where s.id = session_id and s.profile_id = auth.uid()
  )
);

drop policy if exists ai_chat_messages_insert_own_or_admin on public.ai_chat_messages;
create policy ai_chat_messages_insert_own_or_admin
on public.ai_chat_messages for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.ai_chat_sessions s
    where s.id = session_id and s.profile_id = auth.uid()
  )
);

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
with check (user_id = auth.uid() or public.is_admin());

drop policy if exists support_tickets_select_own_or_admin on public.support_tickets;
create policy support_tickets_select_own_or_admin
on public.support_tickets for select
using (auth.uid() = user_id or public.is_admin());

drop policy if exists support_tickets_insert_own_or_admin on public.support_tickets;
create policy support_tickets_insert_own_or_admin
on public.support_tickets for insert
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists support_tickets_update_own_or_admin on public.support_tickets;
create policy support_tickets_update_own_or_admin
on public.support_tickets for update
using (auth.uid() = user_id or public.is_admin())
with check (auth.uid() = user_id or public.is_admin());

drop policy if exists ticket_messages_select_related_or_admin on public.ticket_messages;
create policy ticket_messages_select_related_or_admin
on public.ticket_messages for select
using (
  public.is_admin()
  or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
);

drop policy if exists ticket_messages_insert_related_or_admin on public.ticket_messages;
create policy ticket_messages_insert_related_or_admin
on public.ticket_messages for insert
with check (
  public.is_admin()
  or exists (
    select 1 from public.support_tickets t
    where t.id = ticket_id and t.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Order/delivery RLS helpers.
-- These avoid recursive policy checks between orders and delivery_orders.
-- ---------------------------------------------------------------------------
create or replace function public.can_access_order(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and (
        o.buyer_id = auth.uid()
        or o.supplier_id = auth.uid()
        or exists (
          select 1
          from public.delivery_orders d
          where d.order_id = o.id
            and d.shipping_company_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_order_buyer(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and o.buyer_id = auth.uid()
  );
$$;

create or replace function public.can_access_delivery_order(target_delivery_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.delivery_orders d
    join public.orders o on o.id = d.order_id
    where d.id = target_delivery_order_id
      and (
        d.shipping_company_id = auth.uid()
        or o.buyer_id = auth.uid()
        or o.supplier_id = auth.uid()
      )
  );
$$;

drop policy if exists orders_participants_select on public.orders;
create policy orders_participants_select
on public.orders for select
using (public.can_access_order(id));

drop policy if exists order_items_participants_select on public.order_items;
create policy order_items_participants_select
on public.order_items for select
using (public.can_access_order(order_id));

drop policy if exists order_items_buyer_insert on public.order_items;
create policy order_items_buyer_insert
on public.order_items for insert
with check (public.is_order_buyer(order_id));

drop policy if exists delivery_orders_participants_select on public.delivery_orders;
create policy delivery_orders_participants_select
on public.delivery_orders for select
using (public.can_access_delivery_order(id));

drop policy if exists delivery_orders_buyer_insert on public.delivery_orders;
create policy delivery_orders_buyer_insert
on public.delivery_orders for insert
with check (public.is_order_buyer(order_id));

drop policy if exists delivery_tracking_participants_select on public.delivery_tracking;
create policy delivery_tracking_participants_select
on public.delivery_tracking for select
using (public.can_access_delivery_order(delivery_order_id));

drop policy if exists delivery_tracking_company_insert on public.delivery_tracking;
create policy delivery_tracking_company_insert
on public.delivery_tracking for insert
with check (public.can_access_delivery_order(delivery_order_id));

notify pgrst, 'reload schema';
