import { createNotification } from "./notification.service";

type SupabaseClient = {
  from: (table: string) => any;
};

const DELIVERY_STATUSES = ["picked_up", "in_transit", "out_for_delivery", "delivered"] as const;

function trackingNumber() {
  return `TRK-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function getShippingCompanies(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("shipping_company_profiles")
    .select("user_id, company_name, delivery_cities, avg_delivery_time")
    .order("company_name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data || []).map((company: any) => ({
    id: company.user_id,
    user_id: company.user_id,
    company_name: company.company_name,
    delivery_cities: company.delivery_cities || [],
    avg_delivery_time: company.avg_delivery_time || "",
  }));
}

export async function selectShippingCompany(
  supabase: SupabaseClient,
  buyerId: string,
  orderId: string,
  shippingCompanyId: string
) {
  const [{ data: order, error: orderError }, { data: company, error: companyError }] = await Promise.all([
    supabase.from("orders").select("id, buyer_id, total_amount").eq("id", orderId).eq("buyer_id", buyerId).single(),
    supabase.from("shipping_company_profiles").select("*").eq("user_id", shippingCompanyId).single(),
  ]);

  if (orderError || !order) throw new Error("ORDER_NOT_FOUND");
  if (companyError || !company) throw new Error("SHIPPING_COMPANY_NOT_FOUND");

  const shippingFee = Number(company.shipping_fee || company.delivery_fee || company.base_fee || 0);
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

  await supabase.from("orders").update({ total_amount: Number(order.total_amount || 0) + shippingFee }).eq("id", orderId);
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
  return data || [];
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
    });
  }

  return data;
}
