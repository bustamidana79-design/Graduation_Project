import { clearUserCartProducts, getCart } from "./cart.service";
import { createNotification } from "./notification.service";
import { convertCurrency, normalizeCurrency } from "@/lib/currency";
import { getExchangeRates } from "./currency.service";
import { getShippingRate } from "./shipping.service";

type SupabaseClient = {
  from: (table: string) => any;
};

type OrderShippingDetails = {
  phone: string;
  country: string;
  city: string;
  area: string;
  addressText: string;
  postalCode?: string | null;
  customerType?: "citizen" | "visitor" | "";
  nationalId?: string | null;
  passportNumber?: string | null;
  notes?: string | null;
};

const SUPPLIER_STATUSES = ["paid", "processing", "shipped"] as const;

export async function createOrdersFromCart(
  supabase: SupabaseClient,
  buyerId: string,
  shippingDetails: OrderShippingDetails,
  targetCurrency = "ILS",
  selectedProductIds: string[] = []
) {
  const phone = shippingDetails.phone.trim();
  const country = shippingDetails.country.trim();
  const city = shippingDetails.city.trim();
  const area = shippingDetails.area.trim();
  const addressText = shippingDetails.addressText.trim();
  const postalCode = shippingDetails.postalCode?.trim() || null;
  if (!phone) throw new Error("PHONE_REQUIRED");
  if (!country) throw new Error("COUNTRY_REQUIRED");
  if (!city) throw new Error("CITY_REQUIRED");
  if (!area) throw new Error("AREA_REQUIRED");
  if (!addressText) throw new Error("ADDRESS_REQUIRED");

  const currency = normalizeCurrency(targetCurrency);
  const rates = await getExchangeRates();
  const { items } = await getCart(supabase, buyerId, currency);
  const selectedIds = new Set(selectedProductIds.filter(Boolean));
  const validItems = items.filter((item) => item.product && (selectedIds.size === 0 || selectedIds.has(item.product_id))) as any[];
  if (validItems.length === 0) throw new Error("CART_EMPTY");

  const supplierIds = Array.from(
    new Set(validItems.map((item) => String(item.product?.supplier_id || "")).filter(Boolean))
  );
  const [
    { data: buyerProfile },
    { data: supplierCountryProfiles, error: supplierCountryProfilesError },
    { data: supplierProfiles, error: supplierProfilesError },
  ] = await Promise.all([
    supabase.from("profiles").select("id, country").eq("id", buyerId).maybeSingle(),
    supplierIds.length > 0
      ? supabase.from("profiles").select("id, country").in("id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
    supplierIds.length > 0
      ? supabase.from("supplier_profiles").select("user_id, shipping_company_id").in("user_id", supplierIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (supplierCountryProfilesError) throw new Error(supplierCountryProfilesError.message);
  if (supplierProfilesError) throw new Error(supplierProfilesError.message);
  const supplierCountryMap = new Map<string, string>();
  for (const profile of supplierCountryProfiles || []) {
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
    shippingCompanyMap.set(String(company.user_id), company);
  }

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
    const shippingCompanyId = supplierShippingCompanyMap.get(supplierId) || "";
    if (!shippingCompanyId) throw new Error("المورد لم يحدد شركة توصيل");

    const shippingCompany = shippingCompanyMap.get(shippingCompanyId);
    if (!shippingCompany) throw new Error("المورد لم يحدد شركة توصيل");

    const shippingRate = await getShippingRate(supabase, shippingCompanyId, city, area || null);
    const shippingFee = Number(shippingRate.price || 0);
    const avgDeliveryTime = String(shippingCompany.avg_delivery_time || "");
    const supplierCountry = supplierCountryMap.get(supplierId) || "";
    const buyerCountry = String(buyerProfile?.country || country || "");
    const isInternational = Boolean(country && supplierCountry && country !== supplierCountry) || Boolean(buyerCountry && supplierCountry && buyerCountry !== supplierCountry);
    const customerType = shippingDetails.customerType || "";
    const nationalId = shippingDetails.nationalId?.trim() || null;
    const passportNumber = shippingDetails.passportNumber?.trim() || null;

    if (isInternational) {
      if (!postalCode) throw new Error("POSTAL_CODE_REQUIRED");
      if (customerType !== "citizen" && customerType !== "visitor") throw new Error("CUSTOMER_TYPE_REQUIRED");
      if (customerType === "citizen" && !nationalId) throw new Error("NATIONAL_ID_REQUIRED");
      if (customerType === "visitor" && !passportNumber) throw new Error("PASSPORT_NUMBER_REQUIRED");
    }

    const subtotal = supplierItems.reduce((sum, item) => {
      const productCurrency = normalizeCurrency(item.product?.currency);
      const price = convertCurrency(Number(item.product?.wholesale_price || 0), productCurrency, currency, rates);
      return sum + price * Number(item.quantity || 0);
    }, 0);

    const orderInsert = await supabase
      .from("orders")
      .insert({
        buyer_id: buyerId,
        supplier_id: supplierId,
        shipping_address_id: null,
        phone,
        country,
        city,
        area,
        address_text: addressText,
        postal_code: postalCode,
        shipping_company_id: shippingCompanyId,
        shipping_cost: shippingFee,
        is_international: isInternational,
        customer_type: isInternational ? customerType : null,
        national_id: isInternational && customerType === "citizen" ? nationalId : null,
        passport_number: isInternational && customerType === "visitor" ? passportNumber : null,
        notes: shippingDetails.notes?.trim() || null,
        status: "paid",
        subtotal,
        total_amount: subtotal + shippingFee,
        currency,
      })
      .select("*")
      .single();

    if (orderInsert.error || !orderInsert.data) {
      throw new Error(orderInsert.error?.message || "Failed to create order.");
    }

    const order = orderInsert.data;
    const trackingNumber = `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const deliveryOrderInsert = await supabase
      .from("delivery_orders")
      .insert({
        order_id: order.id,
        shipping_company_id: shippingCompanyId,
        tracking_number: trackingNumber,
        shipping_fee: shippingFee,
        avg_delivery_time: avgDeliveryTime,
        status: "picked_up",
      })
      .select("*")
      .single();

    if (deliveryOrderInsert.error || !deliveryOrderInsert.data) {
      throw new Error(deliveryOrderInsert.error?.message || "Failed to create delivery order.");
    }

    const trackingInsert = await supabase.from("delivery_tracking").insert({
      delivery_order_id: deliveryOrderInsert.data.id,
      status: "picked_up",
      description: "Delivery order created.",
    });

    if (trackingInsert.error) throw new Error(trackingInsert.error.message);

    const itemPayload = supplierItems.map((item) => {
      const quantity = Number(item.quantity || 0);
      const unitPrice = convertCurrency(
        Number(item.product?.wholesale_price || 0),
        normalizeCurrency(item.product?.currency),
        currency,
        rates
      );
      const lineTotal = unitPrice * quantity;

      return {
        order_id: order.id,
        product_id: item.product_id,
        quantity,
        unit_price: unitPrice,
        total_price: lineTotal,
        line_total: lineTotal,
        currency,
      };
    });

    const orderItemsInsert = await supabase.from("order_items").insert(itemPayload).select("*");
    if (orderItemsInsert.error) throw new Error(orderItemsInsert.error.message);

    for (const item of supplierItems) {
      const nextStock = Math.max(0, Number(item.product?.stock_quantity || 0) - Number(item.quantity || 0));
      const { error } = await supabase.from("products").update({ stock_quantity: nextStock }).eq("id", item.product_id);
      if (error) throw new Error(error.message);
    }

    const paymentInsert = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        amount: Number(order.total_amount || 0),
        currency,
        payment_provider: "taler",
        payment_method: "taler",
        payment_status: "paid",
        provider_payment_id: `checkout-${order.id}`,
      })
      .select("*")
      .single();

    if (paymentInsert.error || !paymentInsert.data) {
      throw new Error(paymentInsert.error?.message || "Failed to mark order as paid.");
    }

    const txInsert = await supabase.from("transactions").insert({
      payment_id: paymentInsert.data.id,
      provider_reference: paymentInsert.data.provider_payment_id,
      transaction_status: "success",
      response_payload: {
        provider: "checkout",
        transaction_type: "payment",
        amount: paymentInsert.data.amount,
        currency: paymentInsert.data.currency,
        auto_confirmed: true,
      },
    });
    if (txInsert.error) {
      console.warn("Checkout transaction log failed:", txInsert.error.message);
    }

    await createNotification({
      supabase,
      userId: buyerId,
      title: "Payment confirmed",
      body: `Payment was confirmed successfully for order ${order.id}.`,
      type: "payment_confirmed",
      data: { order_id: order.id, route: `/dashboard/small-business/orders/${order.id}` },
    });

    await createNotification({
      supabase,
      userId: supplierId,
      title: "Order paid",
      body: `Order ${order.id} was paid.`,
      type: "supplier_order_paid",
      data: { order_id: order.id, route: "/dashboard/supplier/orders" },
    });

    await createNotification({
      supabase,
      userId: shippingCompanyId,
      title: "Delivery order ready",
      body: `Order ${order.id} was paid and is ready for delivery follow-up.`,
      type: "shipping_assigned",
      data: { order_id: order.id, route: "/dashboard/shipping-company/orders" },
    });

    createdOrders.push({ ...order, payments: [paymentInsert.data], delivery_order: deliveryOrderInsert.data, items: orderItemsInsert.data || [] });

  }

  await clearUserCartProducts(
    supabase,
    buyerId,
    validItems.map((item) => String(item.product_id || "")).filter(Boolean)
  );

  return createdOrders;
}

export async function getBuyerOrders(supabase: SupabaseClient, buyerId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*), delivery_orders(*, delivery_tracking(*)), payments(*)")
    .eq("buyer_id", buyerId)
    .eq("status", "paid")
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
    .eq("status", "paid")
    .single();

  if (error || !data) throw new Error("ORDER_NOT_FOUND");
  return data;
}

export async function getSupplierOrders(supabase: SupabaseClient, supplierId: string) {
  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(*, products(*)), delivery_orders(*)")
    .eq("supplier_id", supplierId)
    .neq("status", "pending_payment")
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
    data: { order_id: data.id, route: `/dashboard/small-business/orders/${data.id}` },
  });

  return data;
}
