alter table public.ai_chat_sessions add column if not exists title text;
alter table public.ai_chat_sessions add column if not exists updated_at timestamp default now();

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.ai_chat_sessions'::regclass
      and conname = 'ai_chat_sessions_user_type_check'
  ) then
    alter table public.ai_chat_sessions drop constraint ai_chat_sessions_user_type_check;
  end if;

  alter table public.ai_chat_sessions
    add constraint ai_chat_sessions_user_type_check
    check (user_type in ('supplier', 'merchant', 'small_business', 'delivery', 'supporter', 'admin'));
end $$;

update public.ai_chat_sessions s
set user_type = 'small_business'
from public.profiles p
where s.profile_id = p.id
  and p.account_type = 'small_business'
  and s.user_type in ('supplier', 'merchant');
