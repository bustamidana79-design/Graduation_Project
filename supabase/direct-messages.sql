create extension if not exists pgcrypto;

create table if not exists public.direct_conversations (
  id uuid primary key default gen_random_uuid(),
  user_one_id uuid not null references public.profiles(id) on delete cascade,
  user_two_id uuid not null references public.profiles(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  last_sender_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now()),
  constraint direct_conversations_distinct_users check (user_one_id <> user_two_id)
);

create unique index if not exists direct_conversations_unique_pair_idx
  on public.direct_conversations (
    least(user_one_id::text, user_two_id::text),
    greatest(user_one_id::text, user_two_id::text)
  );

create index if not exists direct_conversations_user_one_idx
  on public.direct_conversations (user_one_id);

create index if not exists direct_conversations_user_two_idx
  on public.direct_conversations (user_two_id);

create table if not exists public.direct_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.direct_conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default timezone('utc'::text, now()),
  read_at timestamptz
);

alter table public.direct_messages
  add column if not exists read_at timestamptz;

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at);

create index if not exists direct_messages_unread_receiver_idx
  on public.direct_messages (receiver_id, conversation_id)
  where read_at is null;

alter table public.profiles enable row level security;
alter table public.applications enable row level security;
alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

drop policy if exists "authenticated users can read approved public profiles" on public.profiles;
create policy "authenticated users can read approved public profiles"
  on public.profiles
  for select
  using (
    auth.uid() = id
    or (
      auth.role() = 'authenticated'
      and status = 'approved'
      and account_type <> 'admin'
    )
    or exists (
      select 1
      from public.direct_conversations
      where (
        direct_conversations.user_one_id = auth.uid()
        and direct_conversations.user_two_id = profiles.id
      )
      or (
        direct_conversations.user_two_id = auth.uid()
        and direct_conversations.user_one_id = profiles.id
      )
    )
  );

drop policy if exists "users can create their own pending profile" on public.profiles;
create policy "users can create their own pending profile"
  on public.profiles
  for insert
  with check (
    auth.uid() = id
    and status = 'pending'
    and account_type <> 'admin'
  );

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and account_type <> 'admin'
  );

create or replace function public.create_profile_for_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    country,
    account_type,
    status
  )
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, nullif(new.raw_user_meta_data ->> 'email', '')),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'country', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'merchant'),
    'pending'
  )
  on conflict (id) do nothing;

  if new.raw_user_meta_data ? 'application_data_json' then
    insert into public.applications (
      user_id,
      account_type,
      data_json,
      proof_json,
      status
    )
    values (
      new.id,
      coalesce(nullif(new.raw_user_meta_data ->> 'account_type', ''), 'merchant'),
      new.raw_user_meta_data -> 'application_data_json',
      coalesce(new.raw_user_meta_data -> 'application_proof_json', '{}'::jsonb),
      'pending'
    );
  end if;

  return new;
end;
$$;

drop trigger if exists create_profile_after_auth_user_insert on auth.users;
create trigger create_profile_after_auth_user_insert
  after insert on auth.users
  for each row
  execute function public.create_profile_for_new_auth_user();

drop policy if exists "users can read their own applications" on public.applications;
create policy "users can read their own applications"
  on public.applications
  for select
  using (auth.uid() = user_id);

drop policy if exists "admins can read all applications" on public.applications;
create policy "admins can read all applications"
  on public.applications
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_type = 'admin'
    )
  );

drop policy if exists "users can create their own pending applications" on public.applications;
create policy "users can create their own pending applications"
  on public.applications
  for insert
  with check (
    auth.uid() = user_id
    and status = 'pending'
  );

drop policy if exists "admins can manage applications" on public.applications;
create policy "admins can manage applications"
  on public.applications
  for all
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_type = 'admin'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.account_type = 'admin'
    )
  );

insert into public.applications (
  user_id,
  account_type,
  data_json,
  proof_json,
  status
)
select
  users.id,
  coalesce(nullif(users.raw_user_meta_data ->> 'account_type', ''), 'merchant'),
  users.raw_user_meta_data -> 'application_data_json',
  coalesce(users.raw_user_meta_data -> 'application_proof_json', '{}'::jsonb),
  'pending'
from auth.users
where users.raw_user_meta_data ? 'application_data_json'
  and not exists (
    select 1
    from public.applications
    where applications.user_id = users.id
  );

drop policy if exists "authenticated users can read approved supplier profiles" on public.supplier_profiles;
create policy "authenticated users can read approved supplier profiles"
  on public.supplier_profiles
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = supplier_profiles.user_id
        and profiles.status = 'approved'
        and profiles.account_type <> 'admin'
    )
  );

drop policy if exists "authenticated users can read approved small business profiles" on public.small_business_profiles;
create policy "authenticated users can read approved small business profiles"
  on public.small_business_profiles
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = small_business_profiles.user_id
        and profiles.status = 'approved'
        and profiles.account_type <> 'admin'
    )
  );

drop policy if exists "authenticated users can read approved shipping profiles" on public.shipping_company_profiles;
create policy "authenticated users can read approved shipping profiles"
  on public.shipping_company_profiles
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = shipping_company_profiles.user_id
        and profiles.status = 'approved'
        and profiles.account_type <> 'admin'
    )
  );

drop policy if exists "authenticated users can read approved supporter profiles" on public.supporter_profiles;
create policy "authenticated users can read approved supporter profiles"
  on public.supporter_profiles
  for select
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles
      where profiles.id = supporter_profiles.user_id
        and profiles.status = 'approved'
        and profiles.account_type <> 'admin'
    )
  );

drop policy if exists "participants can view conversations" on public.direct_conversations;
create policy "participants can view conversations"
  on public.direct_conversations
  for select
  using (auth.uid() = user_one_id or auth.uid() = user_two_id);

drop policy if exists "participants can create conversations" on public.direct_conversations;
create policy "participants can create conversations"
  on public.direct_conversations
  for insert
  with check (auth.uid() = user_one_id or auth.uid() = user_two_id);

drop policy if exists "participants can update conversations" on public.direct_conversations;
create policy "participants can update conversations"
  on public.direct_conversations
  for update
  using (auth.uid() = user_one_id or auth.uid() = user_two_id)
  with check (auth.uid() = user_one_id or auth.uid() = user_two_id);

drop policy if exists "participants can view messages" on public.direct_messages;
create policy "participants can view messages"
  on public.direct_messages
  for select
  using (
    auth.uid() = sender_id
    or auth.uid() = receiver_id
    or exists (
      select 1
      from public.direct_conversations
      where direct_conversations.id = direct_messages.conversation_id
        and (direct_conversations.user_one_id = auth.uid() or direct_conversations.user_two_id = auth.uid())
    )
  );

drop policy if exists "participants can send messages" on public.direct_messages;
create policy "participants can send messages"
  on public.direct_messages
  for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1
      from public.direct_conversations
      where direct_conversations.id = direct_messages.conversation_id
        and (
          (direct_conversations.user_one_id = sender_id and direct_conversations.user_two_id = receiver_id)
          or
          (direct_conversations.user_one_id = receiver_id and direct_conversations.user_two_id = sender_id)
        )
    )
  );

drop policy if exists "receivers can mark messages as read" on public.direct_messages;
create policy "receivers can mark messages as read"
  on public.direct_messages
  for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
