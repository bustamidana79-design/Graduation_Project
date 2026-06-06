import { createNotification } from "./notification.service";

type SupabaseClient = {
  from: (table: string) => any;
};

const DELIVERY_STATUSES = ["picked_up", "in_transit", "out_for_delivery", "delivered"] as const;
const LATIN_LETTERS = /[a-z]/i;

function trackingNumber() {
  return `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function normalizeLocation(value?: unknown) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function hasMatchingDeliveryLocation(deliveryCities: unknown[], city?: unknown, area?: unknown) {
  const normalizedCity = normalizeLocation(city);
  const normalizedArea = normalizeLocation(area);

  return deliveryCities.some((value) => {
    const deliveryLocation = normalizeLocation(value);
    return Boolean(deliveryLocation && (deliveryLocation === normalizedCity || deliveryLocation === normalizedArea));
  });
}

function toShippingCompany(company: any, shippingFee = 0) {
  return {
    id: company.user_id,
    user_id: company.user_id,
    company_name: company.company_name,
    delivery_cities: company.delivery_cities || [],
    avg_delivery_time: company.avg_delivery_time || "",
    shipping_fee: Number(shippingFee || 0),
  };
}

export async function getShippingRate(
  supabase: SupabaseClient,
  shippingCompanyId: string,
  city: string,
  area?: string | null
) {
  const { data: rate, error } = await supabase
    .from("shipping_rates")
    .select("price")
    .eq("shipping_company_id", shippingCompanyId)
    .eq("city", city)
    .eq("area", String(area || "").trim())
    .single();

  if (error || !rate) {
    throw new Error("لا يوجد سعر شحن لهذه المنطقة");
  }

  return rate;
}

export async function getShippingCompanies(supabase: SupabaseClient, filters?: { city?: string; area?: string; country?: string }) {
  const { data, error } = await supabase
    .from("shipping_company_profiles")
    .select("user_id, company_name, delivery_cities, avg_delivery_time")
    .order("company_name", { ascending: true });

  if (error) throw new Error(error.message);
  const companies = data || [];
  const city = String(filters?.city || "").trim();
  const area = String(filters?.area || "").trim();

  console.log("city:", city);
  console.log("area:", area);

  const availableCompanies = companies.filter((company: any) => {
    const deliveryCities = Array.isArray(company.delivery_cities) ? company.delivery_cities : [];

    console.log("company cities:", company.delivery_cities);
    if (deliveryCities.some((value: unknown) => LATIN_LETTERS.test(String(value || "")))) {
      console.warn("Shipping company delivery_cities should be Arabic:", company.company_name, company.delivery_cities);
    }

    if (!city && !area) return true;
    return hasMatchingDeliveryLocation(deliveryCities, city, area);
  });

  if (availableCompanies.length === 0) {
    console.warn("No matching companies, returning all");
    return companies.map((company: any) => toShippingCompany(company));
  }

  if (!city || !area) {
    return availableCompanies.map((company: any) => toShippingCompany(company));
  }

  const companyIds = availableCompanies.map((company: any) => String(company.user_id)).filter(Boolean);
  const { data: rates, error: ratesError } =
    companyIds.length > 0
      ? await supabase
          .from("shipping_rates")
          .select("shipping_company_id, price")
          .in("shipping_company_id", companyIds)
          .eq("city", city)
          .eq("area", area)
      : { data: [], error: null };

  if (ratesError) throw new Error(ratesError.message);
const rateMap = new Map<string, number>(
  (rates || []).map((rate: any) => [
    String(rate.shipping_company_id),
    Number(rate.price || 0),
  ])
);
  return availableCompanies
    .filter((company: any) => rateMap.has(String(company.user_id)))
    .map((company: any) => toShippingCompany(company, rateMap.get(String(company.user_id)) || 0));
}

export async function selectShippingCompany(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shippingCompanyId: string
) {
  const [{ data: order, error: orderError }, { data: company, error: companyError }] = await Promise.all([
    supabase.from("orders").select("id, buyer_id, total_amount, city, area").eq("id", orderId).eq("buyer_id", buyerId).single(),
    supabase.from("shipping_company_profiles").select("*").eq("user_id", shippingCompanyId).single(),
  ]);

  if (orderError || !order) throw new Error("ORDER_NOT_FOUND");
  if (companyError || !company) throw new Error("SHIPPING_COMPANY_NOT_FOUND");
  const deliveryCities = Array.isArray(company.delivery_cities) ? company.delivery_cities : [];
  if (deliveryCities.length > 0 && !hasMatchingDeliveryLocation(deliveryCities, order.city, order.area)) {
    console.warn("Selected shipping company does not directly match city/area; allowing fallback selection.", {
      city: order.city,
      area: order.area,
      companyCities: company.delivery_cities,
    });
  }

  const rate = await getShippingRate(supabase, shippingCompanyId, String(order.city || "").trim(), String(order.area || "").trim());
  const shippingFee = Number(rate.price || 0);
  const avgDeliveryTime = String(company.avg_delivery_time || "");
  const payload = {
    order_id: orderId,
    shipping_company_id: shippingCompanyId,
    tracking_number: trackingNumber(),
    shipping_fee: shippingFee,
    avg_delivery_time: avgDeliveryTime,
    status: "picked_up",
  };

  const { data: deliveryOrder, error } = await supabase.from("delivery_orders").insert(payload).select("*").single();
  if (error || !deliveryOrder) throw new Error(error?.message || "Failed to create delivery order.");

  await supabase
    .from("orders")
    .update({ total_amount: Number(order.total_amount || 0) + shippingFee, shipping_company_id: shippingCompanyId })
    .eq("id", orderId);
  await supabase.from("delivery_tracking").insert({
    delivery_order_id: deliveryOrder.id,
    status: "picked_up",
    description: "Delivery order created.",
  });

  await createNotification({
    supabase,
    userId: shippingCompanyId,
    title: "طلب توصيل جديد",
    body: `تم إسناد طلب توصيل جديد إليك. رقم التتبع: ${deliveryOrder.tracking_number}`,
    type: "shipping_assigned",
    data: { order_id: orderId, delivery_order_id: deliveryOrder.id, route: "/dashboard/shipping-company/orders" },
  });

  return deliveryOrder;
}

export async function getDeliveryOrders(supabase: SupabaseClient, shippingCompanyId: string) {
  const { data, error } = await supabase
    .from("delivery_orders")
    .select("*, orders(*), delivery_tracking(*)")
    .eq("shipping_company_id", shippingCompanyId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data || []).filter((order: any) => order.orders?.status !== "pending_payment");
}

export async function updateDeliveryStatus(
  supabase: SupabaseClient,
  shippingCompanyId: string,
  deliveryOrderId: string,
  status: string,
  note?: string,
  location?: string
) {
  if (!DELIVERY_STATUSES.includes(status as any)) throw new Error("INVALID_STATUS");

  const { data, error } = await supabase
    .from("delivery_orders")
    .update({ status })
    .eq("id", deliveryOrderId)
    .eq("shipping_company_id", shippingCompanyId)
    .select("*")
    .single();

  if (error || !data) throw new Error(error?.message || "DELIVERY_ORDER_NOT_FOUND");

  const tracking = await supabase.from("delivery_tracking").insert({
    delivery_order_id: deliveryOrderId,
    status,
    description: note || status,
    location: location || null,
  });
  if (tracking.error) throw new Error(tracking.error.message);

  const { data: order } = await supabase.from("orders").select("buyer_id").eq("id", data.order_id).single();
  if (order?.buyer_id) {
      await createNotification({
        supabase,
        userId: order.buyer_id,
        title: "تحديث التوصيل",
        body: status === "delivered" ? "تم تسليم طلبك بنجاح." : `طلبك الآن بحالة ${status}.`,
        type: "delivery_status_updated",
        data: { order_id: data.order_id, delivery_order_id: deliveryOrderId, route: `/dashboard/small-business/orders/${data.order_id}` },
      });
  }

  return data;
}
