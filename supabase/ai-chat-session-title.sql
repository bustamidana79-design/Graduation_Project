alter table public.ai_chat_sessions add column if not exists title text;
alter table public.ai_chat_sessions add column if not exists updated_at timestamp default now();
