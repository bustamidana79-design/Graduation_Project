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
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists direct_messages_conversation_idx
  on public.direct_messages (conversation_id, created_at);

alter table public.direct_conversations enable row level security;
alter table public.direct_messages enable row level security;

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
