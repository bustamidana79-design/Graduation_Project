import { clearCart, getCart } from "./cart.service";
import { createNotification } from "./notification.service";
import { convertCurrency, normalizeCurrency } from "@/lib/currency";

type SupabaseClient = {
  from: (table: string) => any;
};

type OrderShippingDetails = {
  phone: string;
  city: string;
  area: string;
  notes?: string | null;
};

const SUPPLIER_STATUSES = ["pending", "confirmed", "processing", "shipped"] as const;

export async function createOrdersFromCart(
  supabase: SupabaseClient,
  buyerId: string,
  shippingDetails: OrderShippingDetails,
  targetCurrency = "ILS"
) {
  const phone = shippingDetails.phone.trim();
  const city = shippingDetails.city.trim();
  const area = shippingDetails.area.trim();
  if (!phone) throw new Error("PHONE_REQUIRED");
  if (!city) throw new Error("CITY_REQUIRED");
  if (!area) throw new Error("AREA_REQUIRED");

  const currency = normalizeCurrency(targetCurrency);
  const { items, cart } = await getCart(supabase, buyerId, currency);
  const validItems = items.filter((item) => item.product) as any[];
  if (validItems.length === 0) throw new Error("CART_EMPTY");

  const grouped = new Map<string, typeof validItems>();
  for (const item of validItems) {
    const product = item.product!;
    const stock = Number(product.stock_quantity || 0);
    const quantity = Number(item.quantity || 0);
    if (!product.is_published || stock < quantity) throw new Error("INSUFFICIENT_STOCK");

    const supplierId = String(product.supplier_id || "");
    if (!supplierId) throw new Error("PRODUCT_SUPPLIER_MISSING");
    grouped.set(supplierId, [...(grouped.get(supplierId) || []), item]);
  }

  const createdOrders: any[] = [];

  for (const [supplierId, supplierItems] of grouped.entries()) {
    const subtotal = supplierItems.reduce((sum, item) => {
      const productCurrency = normalizeCurrency(item.product?.currency);
      const price = convertCurrency(Number(item.product?.wholesale_price || 0), productCurrency, currency);
      return sum + price * Number(item.quantity || 0);
    }, 0);

    const orderInsert = await supabase
      .from("orders")
      .insert({
        buyer_id: buyerId,
        supplier_id: supplierId,
        shipping_address_id: null,
        phone,
        city,
        area,
        notes: shippingDetails.notes?.trim() || null,
        status: "pending",
        subtotal,
        total_amount: subtotal,
        currency,
      })
      .select("*")
      .single();

    if (orderInsert.error || !orderInsert.data) {
      throw new Error(orderInsert.error?.message || "Failed to create order.");
    }

    const order = orderInsert.data;
    const itemPayload = supplierItems.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: Number(item.quantity || 0),
      unit_price: convertCurrency(
        Number(item.product?.wholesale_price || 0),
        normalizeCurrency(item.product?.currency),
        currency
      ),
      total_price:
        convertCurrency(Number(item.product?.wholesale_price || 0), normalizeCurrency(item.product?.currency), currency) *
        Number(item.quantity || 0),
      currency,
    }));

    const orderItemsInsert = await supabase.from("order_items").insert(itemPayload).select("*");
    if (orderItemsInsert.error) throw new Error(orderItemsInsert.error.message);

    for (const item of supplierItems) {
      const nextStock = Math.max(0, Number(item.product?.stock_quantity || 0) - Number(item.quantity || 0));
      const { error } = await supabase.from("products").update({ stock_quantity: nextStock }).eq("id", item.product_id);
      if (error) throw new Error(error.message);
    }

    createdOrders.push({ ...order, items: orderItemsInsert.data || [] });

    await createNotification({
      supabase,
      userId: supplierId,
      title: "طلب جديد",
      body: `تم إنشاء طلب جديد يحتوي على منتجاتك. رقم الطلب: ${order.id}`,
      type: "order_created",
    });
  }

  await clearCart(supabase, cart.id);
  return createdOrders;
}

export async function getBuyerOrders(supabase: SupabaseClient, buyerId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), delivery_orders(*, delivery_tracking(*)), payments(*)")
    .eq("buyer_id", buyerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function getBuyerOrderById(supabase: SupabaseClient, buyerId: string, orderId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, products(*)), delivery_orders(*, delivery_tracking(*)), payments(*)")
    .eq("id", orderId)
    .eq("buyer_id", buyerId)
    .single();

  if (error || !data) throw new Error("ORDER_NOT_FOUND");
  return data;
}

export async function getSupplierOrders(supabase: SupabaseClient, supplierId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, products(*)), delivery_orders(*)")
    .eq("supplier_id", supplierId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function updateSupplierOrderStatus(
  supabase: SupabaseClient,
  supplierId: string,
  orderId: string,
  status: string
) {
  if (!SUPPLIER_STATUSES.includes(status as any)) throw new Error("INVALID_STATUS");

  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .eq("supplier_id", supplierId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "ORDER_NOT_FOUND");

  await createNotification({
    supabase,
    userId: data.buyer_id,
    title: "تحديث حالة الطلب",
    body: `تم تحديث حالة الطلب إلى ${status}. رقم الطلب: ${data.id}`,
    type: "order_status_updated",
  });

  return data;
}
