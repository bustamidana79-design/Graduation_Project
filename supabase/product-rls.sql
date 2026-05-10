-- Product catalog RLS policies.
-- The API inserts products with supplier_id = auth.users.id, and product images
-- are allowed only when the authenticated user owns the related product.

alter table public.products enable row level security;
alter table public.product_images enable row level security;

drop policy if exists products_public_or_owner_select on public.products;
create policy products_public_or_owner_select
on public.products for select
using (
  is_published = true
  or supplier_id = auth.uid()
);

drop policy if exists products_supplier_insert on public.products;
create policy products_supplier_insert
on public.products for insert
with check (supplier_id = auth.uid());

drop policy if exists products_supplier_update on public.products;
create policy products_supplier_update
on public.products for update
using (supplier_id = auth.uid())
with check (supplier_id = auth.uid());

drop policy if exists products_supplier_delete on public.products;
create policy products_supplier_delete
on public.products for delete
using (supplier_id = auth.uid());

drop policy if exists products_admin_delete on public.products;
drop policy if exists "Admin can delete products" on public.products;
create policy "Admin can delete products"
on public.products for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_type = 'admin'
  )
);

drop policy if exists product_images_public_or_owner_select on public.product_images;
create policy product_images_public_or_owner_select
on public.product_images for select
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and (p.is_published = true or p.supplier_id = auth.uid())
  )
);

drop policy if exists product_images_supplier_insert on public.product_images;
create policy product_images_supplier_insert
on public.product_images for insert
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.supplier_id = auth.uid()
  )
);

drop policy if exists product_images_supplier_update on public.product_images;
create policy product_images_supplier_update
on public.product_images for update
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.supplier_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.supplier_id = auth.uid()
  )
);

drop policy if exists product_images_supplier_delete on public.product_images;
create policy product_images_supplier_delete
on public.product_images for delete
using (
  exists (
    select 1
    from public.products p
    where p.id = product_images.product_id
      and p.supplier_id = auth.uid()
  )
);

drop policy if exists product_images_admin_delete on public.product_images;
create policy product_images_admin_delete
on public.product_images for delete
using (
  exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.account_type = 'admin'
  )
);
