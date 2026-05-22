alter table public.order_items add column if not exists total_price numeric default 0;
alter table public.order_items add column if not exists line_total numeric default 0;

update public.order_items
set total_price = coalesce(total_price, line_total, unit_price * quantity, 0)
where total_price is null;

update public.order_items
set line_total = coalesce(line_total, total_price, unit_price * quantity, 0)
where line_total is null;

alter table public.order_items
alter column line_total set default 0;

notify pgrst, 'reload schema';
