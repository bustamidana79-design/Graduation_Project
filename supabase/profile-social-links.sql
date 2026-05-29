alter table public.profiles add column if not exists social_links jsonb default '{}'::jsonb;
