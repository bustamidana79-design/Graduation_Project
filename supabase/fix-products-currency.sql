-- Fix for: Could not find the 'currency' column of 'products' in the schema cache.
-- Run this in the Supabase SQL Editor, then retry creating/updating a product.

alter table public.products
  add column if not exists currency text default 'ILS';

update public.products
set currency = 'ILS'
where currency is null;

alter table public.products
  alter column currency set default 'ILS';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.products'::regclass
      and conname = 'products_currency_check'
  ) then
    alter table public.products
      add constraint products_currency_check
      check (currency in ('ILS', 'USD', 'JOD'));
  end if;
end $$;

notify pgrst, 'reload schema';
