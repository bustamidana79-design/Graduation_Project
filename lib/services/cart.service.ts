import { convertCurrency, normalizeCurrency } from "@/lib/currency";
import { getExchangeRates } from "./currency.service";

type SupabaseClient = {
  from: (table: string) => any;
};

export type CartLine = {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  product?: Record<string, any> | null;
};

export function requireSmallBusiness(profile: { account_type?: string | null }) {
  if (profile.account_type !== "small_business") {
    throw new Error("SMALL_BUSINESS_ONLY");
  }
}

export async function getOrCreateCart(supabase: SupabaseClient, userId: string) {
  const existing = await supabase.from("carts").select("id, user_id").eq("user_id", userId).maybeSingle();
  if (existing.error && existing.error.code !== "PGRST116") throw new Error(existing.error.message);
  if (existing.data) return existing.data;

  const created = await supabase.from("carts").insert({ user_id: userId }).select("id, user_id").single();
  if (created.error || !created.data) throw new Error(created.error?.message || "Failed to create cart.");
  return created.data;
}

async function fetchCartRows(supabase: SupabaseClient, cartId: string): Promise<CartLine[]> {
  const { data, error } = await supabase
    .from("cart_items")
    .select("id, cart_id, product_id, quantity")
    .eq("cart_id", cartId);

  if (error) throw new Error(error.message);
  return (data || []) as CartLine[];
}

async function attachProducts(supabase: SupabaseClient, rows: CartLine[]) {
  const productIds = rows.map((row) => row.product_id).filter(Boolean);
  if (productIds.length === 0) return rows;

  const { data, error } = await supabase
    .from("products")
    .select("*, product_images(id, image_url, is_primary)")
    .in("id", productIds);

  if (error) throw new Error(error.message);

  const supplierIds = Array.from(new Set((data || []).map((product: any) => String(product.supplier_id || "")).filter(Boolean)));
  const [{ data: profiles, error: profilesError }, { data: supplierProfiles, error: supplierProfilesError }] = await Promise.all([
    supplierIds.length > 0
      ? supabase.from("profiles").select("id, country").in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length > 0
      ? supabase.from("supplier_profiles").select("user_id, shipping_company_id").in("user_id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (profilesError) throw new Error(profilesError.message);
  if (supplierProfilesError) throw new Error(supplierProfilesError.message);

  const supplierCountryMap = new Map<string, string>();
  for (const profile of profiles || []) {
    supplierCountryMap.set(String(profile.id), String(profile.country || ""));
  }

  const supplierShippingCompanyMap = new Map<string, string>();
  for (const profile of supplierProfiles || []) {
    supplierShippingCompanyMap.set(String(profile.user_id), String(profile.shipping_company_id || ""));
  }

  const shippingCompanyIds = Array.from(new Set(Array.from(supplierShippingCompanyMap.values()).filter(Boolean)));
  const { data: shippingCompanies, error: shippingCompaniesError } =
    shippingCompanyIds.length > 0
        ? await supabase
          .from("shipping_company_profiles")
          .select("user_id, company_name, avg_delivery_time")
          .in("user_id", shippingCompanyIds)
      : { data: [], error: null };

  if (shippingCompaniesError) throw new Error(shippingCompaniesError.message);
  const shippingCompanyMap = new Map<string, Record<string, any>>();
  for (const company of shippingCompanies || []) {
    shippingCompanyMap.set(String(company.user_id), {
      id: company.user_id,
      user_id: company.user_id,
      company_name: company.company_name || "شركة الشحن",
      avg_delivery_time: company.avg_delivery_time || "",
      shipping_fee: 0,
    });
  }

  const productMap = new Map<string, Record<string, any>>();
  for (const product of data || []) {
    const images = product.product_images || [];
    const supplierId = String(product.supplier_id || "");
    const shippingCompanyId = supplierShippingCompanyMap.get(supplierId) || "";
    productMap.set(String(product.id), {
      ...product,
      supplier_country: supplierCountryMap.get(supplierId) || "",
      supplier_shipping_company: shippingCompanyId ? shippingCompanyMap.get(shippingCompanyId) || null : null,
      primary_image: images.find((image: any) => image.is_primary) || images[0] || null,
    });
  }

  return rows.map((row) => ({ ...row, product: productMap.get(row.product_id) || null }));
}

export async function getCart(supabase: SupabaseClient, userId: string, targetCurrency?: string) {
  const cart = await getOrCreateCart(supabase, userId);
  const rows = await fetchCartRows(supabase, cart.id);
  const items = await attachProducts(supabase, rows);
  const currency = normalizeCurrency(targetCurrency);
  const rates = await getExchangeRates();
  const convertedItems = items.map((item) => {
    if (!item.product) return item;
    const product = item.product as Record<string, any>;
    const sourceCurrency = normalizeCurrency(product.currency);
    const convertedPrice = convertCurrency(Number(product.wholesale_price || 0), sourceCurrency, currency, rates);
    return {
      ...item,
      product: {
        ...product,
        original_wholesale_price: Number(product.wholesale_price || 0),
        original_currency: sourceCurrency,
        converted_wholesale_price: convertedPrice,
      },
      line_total: convertedPrice * Number(item.quantity || 0),
    };
  });

  const subtotal = convertedItems.reduce((sum, item) => {
    const product = item.product as Record<string, any> | null | undefined;
    const price = Number(product?.converted_wholesale_price ?? product?.wholesale_price ?? 0);
    return sum + price * Number(item.quantity || 0);
  }, 0);

  return { cart, items: convertedItems, subtotal, total_amount: subtotal, currency };
}

export async function addToCart(supabase: SupabaseClient, userId: string, productId: string, quantity: number) {
  const finalQuantity = Math.max(1, Number(quantity || 1));
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, stock_quantity, min_order_quantity, is_published")
    .eq("id", productId)
    .single();

  if (productError || !product || !product.is_published) throw new Error("PRODUCT_NOT_AVAILABLE");
  if (finalQuantity < Number(product.min_order_quantity || 1)) throw new Error("MIN_ORDER_QUANTITY");

  const cart = await getOrCreateCart(supabase, userId);
  const requestedQuantity = finalQuantity;
  const existing = await supabase
    .from("cart_items")
    .select("id, quantity")
    .eq("cart_id", cart.id)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing.error && existing.error.code !== "PGRST116") throw new Error(existing.error.message);

  const nextQuantity = Number(existing.data?.quantity || 0) + requestedQuantity;
  if (Number(product.stock_quantity || 0) < nextQuantity) throw new Error("INSUFFICIENT_STOCK");

  if (existing.data) {
    const { error } = await supabase.from("cart_items").update({ quantity: nextQuantity }).eq("id", existing.data.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase
      .from("cart_items")
      .insert({ cart_id: cart.id, product_id: productId, quantity: requestedQuantity });
    if (error) throw new Error(error.message);
  }

  return getCart(supabase, userId);
}

export async function updateCartItemQuantity(
  supabase: SupabaseClient,
  userId: string,
  productId: string,
  quantity: number,
  targetCurrency?: string
) {
  const finalQuantity = Math.max(1, Number(quantity || 1));
  const cart = await getOrCreateCart(supabase, userId);

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, stock_quantity, min_order_quantity, is_published")
    .eq("id", productId)
    .single();

  if (productError || !product || !product.is_published) throw new Error("PRODUCT_NOT_AVAILABLE");
  if (finalQuantity < Number(product.min_order_quantity || 1)) throw new Error("MIN_ORDER_QUANTITY");
  if (Number(product.stock_quantity || 0) < finalQuantity) throw new Error("INSUFFICIENT_STOCK");

  const { error } = await supabase
    .from("cart_items")
    .update({ quantity: finalQuantity })
    .eq("cart_id", cart.id)
    .eq("product_id", productId);

  if (error) throw new Error(error.message);
  return getCart(supabase, userId, targetCurrency);
}

export async function removeFromCart(supabase: SupabaseClient, userId: string, productId: string, targetCurrency?: string) {
  const cart = await getOrCreateCart(supabase, userId);
  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cart.id).eq("product_id", productId);
  if (error) throw new Error(error.message);
  return getCart(supabase, userId, targetCurrency);
}

export async function clearCart(supabase: SupabaseClient, cartId: string) {
  const { error } = await supabase.from("cart_items").delete().eq("cart_id", cartId);
  if (error) throw new Error(error.message);
}
