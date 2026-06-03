-- Fix for: invalid input syntax for type uuid: "restaurant"
-- The app stores product category slugs such as "restaurant" as text.
-- Run this in the Supabase SQL Editor, then retry creating/updating a product.

alter table public.products
  add column if not exists category text;

notify pgrst, 'reload schema';
