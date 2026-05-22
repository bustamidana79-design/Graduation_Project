alter table public.payments add column if not exists payment_provider text default 'taler';
alter table public.payments add column if not exists payment_method text default 'taler';
alter table public.payments add column if not exists payment_status text default 'pending';
alter table public.payments add column if not exists provider_payment_id text;
alter table public.payments add column if not exists payment_url text;
alter table public.payments add column if not exists currency text default 'ILS';

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

alter table public.payments
alter column payment_provider set default 'taler';

alter table public.payments
alter column payment_method set default 'taler';

alter table public.payments
alter column payment_status set default 'pending';

notify pgrst, 'reload schema';
