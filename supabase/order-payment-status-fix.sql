do $$
declare
  constraint_record record;
begin
  for constraint_record in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint if exists %I', constraint_record.conname);
  end loop;
end $$;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending_payment',
    'pending',
    'paid',
    'confirmed',
    'processing',
    'shipped',
    'delivered',
    'cancelled'
  ));
