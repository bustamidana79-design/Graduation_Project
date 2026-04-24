create table if not exists public.ai_recommendation (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  score numeric(5,4) not null,
  recommendation text not null check (recommendation in ('approve', 'reject', 'review')),
  reason text,
  risk text check (risk in ('low', 'medium', 'high')),
  checked_at timestamptz default now(),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (application_id)
);

create index if not exists ai_recommendation_application_idx
  on public.ai_recommendation (application_id);
