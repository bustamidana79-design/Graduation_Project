-- Order flow RLS policies.
-- The application standard is auth.users.id across buyer_id, supplier_id,
-- shipping_company_id, user_id, and profiles.id.

alter table public.carts enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.addresses enable row level security;
alter table public.delivery_orders enable row level security;
alter table public.delivery_tracking enable row level security;
alter table public.payments enable row level security;
alter table public.transactions enable row level security;
alter table public.favorites enable row level security;

alter table public.delivery_orders add column if not exists status text default 'picked_up';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.delivery_orders'::regclass
      and conname = 'delivery_orders_status_check'
  ) then
    alter table public.delivery_orders
      add constraint delivery_orders_status_check
      check (status in ('picked_up', 'in_transit', 'out_for_delivery', 'delivered'));
  end if;
end $$;

-- RLS helper functions avoid recursive policy checks between orders,
-- delivery_orders, order_items, and delivery_tracking.
create or replace function public.can_access_order(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and (
        o.buyer_id = auth.uid()
        or o.supplier_id = auth.uid()
        or exists (
          select 1
          from public.delivery_orders d
          where d.order_id = o.id
            and d.shipping_company_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.is_order_buyer(target_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders o
    where o.id = target_order_id
      and o.buyer_id = auth.uid()
  );
$$;

create or replace function public.can_access_delivery_order(target_delivery_order_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.delivery_orders d
    join public.orders o on o.id = d.order_id
    where d.id = target_delivery_order_id
      and (
        d.shipping_company_id = auth.uid()
        or o.buyer_id = auth.uid()
        or o.supplier_id = auth.uid()
      )
  );
$$;

drop policy if exists carts_owner_all on public.carts;
create policy carts_owner_all
on public.carts for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists cart_items_owner_all on public.cart_items;
create policy cart_items_owner_all
on public.cart_items for all
using (
  exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.carts c
    where c.id = cart_items.cart_id
      and c.user_id = auth.uid()
  )
);

drop policy if exists addresses_owner_all on public.addresses;
create policy addresses_owner_all
on public.addresses for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists orders_participants_select on public.orders;
create policy orders_participants_select
on public.orders for select
using (public.can_access_order(id));

drop policy if exists orders_buyer_insert on public.orders;
create policy orders_buyer_insert
on public.orders for insert
with check (buyer_id = auth.uid());

drop policy if exists orders_supplier_or_payment_update on public.orders;
create policy orders_supplier_or_payment_update
on public.orders for update
using (buyer_id = auth.uid() or supplier_id = auth.uid())
with check (buyer_id = auth.uid() or supplier_id = auth.uid());

drop policy if exists order_items_participants_select on public.order_items;
create policy order_items_participants_select
on public.order_items for select
using (public.can_access_order(order_id));

drop policy if exists order_items_buyer_insert on public.order_items;
create policy order_items_buyer_insert
on public.order_items for insert
with check (public.is_order_buyer(order_id));

drop policy if exists delivery_orders_participants_select on public.delivery_orders;
create policy delivery_orders_participants_select
on public.delivery_orders for select
using (public.can_access_delivery_order(id));

drop policy if exists delivery_orders_buyer_insert on public.delivery_orders;
create policy delivery_orders_buyer_insert
on public.delivery_orders for insert
with check (public.is_order_buyer(order_id));

drop policy if exists delivery_orders_company_update on public.delivery_orders;
create policy delivery_orders_company_update
on public.delivery_orders for update
using (shipping_company_id = auth.uid())
with check (shipping_company_id = auth.uid());

drop policy if exists delivery_tracking_participants_select on public.delivery_tracking;
create policy delivery_tracking_participants_select
on public.delivery_tracking for select
using (public.can_access_delivery_order(delivery_order_id));

drop policy if exists delivery_tracking_company_insert on public.delivery_tracking;
create policy delivery_tracking_company_insert
on public.delivery_tracking for insert
with check (public.can_access_delivery_order(delivery_order_id));

drop policy if exists payments_buyer_select_insert_update on public.payments;
create policy payments_buyer_select_insert_update
on public.payments for all
using (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and o.buyer_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.orders o
    where o.id = payments.order_id
      and o.buyer_id = auth.uid()
  )
);

drop policy if exists transactions_owner_select on public.transactions;
create policy transactions_owner_select
on public.transactions for select
using (
  exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = transactions.payment_id
      and (o.buyer_id = auth.uid() or o.supplier_id = auth.uid())
  )
);

drop policy if exists transactions_owner_insert on public.transactions;
create policy transactions_owner_insert
on public.transactions for insert
with check (
  exists (
    select 1
    from public.payments p
    join public.orders o on o.id = p.order_id
    where p.id = transactions.payment_id
      and o.buyer_id = auth.uid()
  )
);

drop policy if exists favorites_owner_all on public.favorites;
create policy favorites_owner_all
on public.favorites for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
