import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function monthBuckets() {
  const now = new Date();
  return Array.from({ length: 6 }).map((_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, month: date.toLocaleDateString("ar", { month: "short" }), users: 0, orders: 0, deliveryOrders: 0, investments: 0 };
  });
}

function bucketKey(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const admin = createSupabaseAdmin();

    const [
      profilesResult,
      applicationsResult,
      upgradeRequestsResult,
      productsResult,
      ordersResult,
      deliveryOrdersResult,
      investmentsResult,
    ] = await Promise.all([
      admin.from("profiles").select("id, account_type, status, created_at"),
      admin.from("applications").select("id, status, account_type, created_at"),
      admin.from("upgrade_requests").select("id, status, created_at"),
      admin.from("products").select("id, supplier_id, is_published, stock_quantity, created_at"),
      admin.from("orders").select("id, status, total_amount, subtotal, currency, created_at"),
      admin.from("delivery_orders").select("id, status, shipping_fee, created_at"),
      admin.from("investments").select("id, status, amount, currency, created_at"),
    ]);

    const firstError =
      profilesResult.error ||
      applicationsResult.error ||
      upgradeRequestsResult.error ||
      productsResult.error ||
      ordersResult.error ||
      deliveryOrdersResult.error ||
      investmentsResult.error;

    if (firstError) return jsonError(firstError.message, 500);

    const profiles = profilesResult.data || [];
    const applications = applicationsResult.data || [];
    const upgradeRequests = upgradeRequestsResult.data || [];
    const products = productsResult.data || [];
    const orders = ordersResult.data || [];
    const deliveryOrders = deliveryOrdersResult.data || [];
    const investments = investmentsResult.data || [];

    const profileTypes = new Map<string, number>();
    profiles.forEach((profile: { account_type?: string | null }) => {
      const type = profile.account_type || "unknown";
      profileTypes.set(type, (profileTypes.get(type) || 0) + 1);
    });

    const orderStatuses = new Map<string, number>();
    orders.forEach((order: { status?: string | null }) => {
      const status = order.status || "unknown";
      orderStatuses.set(status, (orderStatuses.get(status) || 0) + 1);
    });

    const deliveryStatuses = new Map<string, number>();
    deliveryOrders.forEach((order: { status?: string | null }) => {
      const status = order.status || "unknown";
      deliveryStatuses.set(status, (deliveryStatuses.get(status) || 0) + 1);
    });

    const investmentStatuses = new Map<string, number>();
    investments.forEach((investment: { status?: string | null }) => {
      const status = investment.status || "unknown";
      investmentStatuses.set(status, (investmentStatuses.get(status) || 0) + 1);
    });

    const monthly = monthBuckets();
    const monthlyByKey = new Map(monthly.map((bucket) => [bucket.key, bucket]));

    profiles.forEach((profile: { created_at?: string | null }) => {
      const bucket = monthlyByKey.get(bucketKey(profile.created_at));
      if (bucket) bucket.users += 1;
    });
    orders.forEach((order: { created_at?: string | null }) => {
      const bucket = monthlyByKey.get(bucketKey(order.created_at));
      if (bucket) bucket.orders += 1;
    });
    deliveryOrders.forEach((order: { created_at?: string | null }) => {
      const bucket = monthlyByKey.get(bucketKey(order.created_at));
      if (bucket) bucket.deliveryOrders += 1;
    });
    investments.forEach((investment: { created_at?: string | null }) => {
      const bucket = monthlyByKey.get(bucketKey(investment.created_at));
      if (bucket) bucket.investments += 1;
    });

    const totalOrderAmount = orders.reduce(
      (sum: number, order: { total_amount?: number | string | null; subtotal?: number | string | null }) =>
        sum + toNumber(order.total_amount || order.subtotal),
      0
    );
    const totalShippingFees = deliveryOrders.reduce(
      (sum: number, order: { shipping_fee?: number | string | null }) => sum + toNumber(order.shipping_fee),
      0
    );
    const totalInvestments = investments
      .filter((investment: { status?: string | null }) => investment.status === "active" || investment.status === "completed")
      .reduce((sum: number, investment: { amount?: number | string | null }) => sum + toNumber(investment.amount), 0);

    return NextResponse.json({
      summary: {
        users: profiles.length,
        approvedUsers: profiles.filter((profile: { status?: string | null }) => profile.status === "approved").length,
        pendingApplications: applications.filter((application: { status?: string | null }) => application.status === "pending").length,
        pendingUpgrades: upgradeRequests.filter((upgrade: { status?: string | null }) => upgrade.status === "pending").length,
        products: products.length,
        publishedProducts: products.filter((product: { is_published?: boolean | null }) => product.is_published).length,
        orders: orders.length,
        totalOrderAmount,
        deliveryOrders: deliveryOrders.length,
        totalShippingFees,
        investments: investments.length,
        totalInvestments,
      },
      breakdowns: {
        profileTypes: Array.from(profileTypes.entries()).map(([key, value]) => ({ key, value })),
        orderStatuses: Array.from(orderStatuses.entries()).map(([key, value]) => ({ key, value })),
        deliveryStatuses: Array.from(deliveryStatuses.entries()).map(([key, value]) => ({ key, value })),
        investmentStatuses: Array.from(investmentStatuses.entries()).map(([key, value]) => ({ key, value })),
      },
      monthly,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (message === "PROFILE_NOT_FOUND") return jsonError("Profile not found", 404);
    if (message === "FORBIDDEN") return jsonError("Admin access required", 403);
    return jsonError(message, 500);
  }
}
