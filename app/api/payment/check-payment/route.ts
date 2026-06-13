import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { confirmPayment } from "@/lib/services/payment.service";

type PaymentRow = {
  id: string;
  order_id: string;
  provider_payment_id?: string | null;
  payment_status?: string | null;
};

function unique(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return unique(value.map(String));
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

async function loadCandidatePayments(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  buyerId: string,
  paymentIds: string[],
  providerPaymentIds: string[]
) {
  let payments: PaymentRow[] = [];

  if (paymentIds.length > 0) {
    const { data, error } = await supabase.from("payments").select("*").in("id", paymentIds);
    if (error) throw new Error(error.message);
    payments = payments.concat((data || []) as PaymentRow[]);
  }

  if (providerPaymentIds.length > 0) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .in("provider_payment_id", providerPaymentIds);
    if (error) throw new Error(error.message);
    payments = payments.concat((data || []) as PaymentRow[]);
  }

  if (paymentIds.length === 0 && providerPaymentIds.length === 0) {
    const { data: pendingOrders, error: ordersError } = await supabase
      .from("orders")
      .select("id")
      .eq("buyer_id", buyerId)
      .eq("status", "pending_payment");

    if (ordersError) throw new Error(ordersError.message);
    const orderIds = unique((pendingOrders || []).map((order: any) => String(order.id || "")));
    if (orderIds.length === 0) return [];

    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .in("order_id", orderIds)
      .neq("payment_status", "paid");

    if (error) throw new Error(error.message);
    payments = payments.concat((data || []) as PaymentRow[]);
  }

  const deduped = Array.from(new Map(payments.map((payment) => [payment.id, payment])).values());
  const orderIds = unique(deduped.map((payment) => String(payment.order_id || "")));
  if (orderIds.length === 0) return [];

  const { data: buyerOrders, error: buyerOrdersError } = await supabase
    .from("orders")
    .select("id")
    .eq("buyer_id", buyerId)
    .in("id", orderIds);

  if (buyerOrdersError) throw new Error(buyerOrdersError.message);
  const allowedOrderIds = new Set((buyerOrders || []).map((order: any) => String(order.id)));

  return deduped.filter((payment) => allowedOrderIds.has(String(payment.order_id)));
}

async function checkPayments(request: NextRequest) {
  const { user, profile } = await requireAuthProfile(request);
  requireSmallBusiness(profile);

  const body = request.method === "POST" ? await request.json().catch(() => ({})) : {};
  const params = request.nextUrl.searchParams;
  const paymentIds = unique([
    ...stringArray((body as any).payment_ids),
    ...stringArray((body as any).paymentIds),
    ...stringArray((body as any).payment_id),
    ...stringArray(params.get("payment_id")),
  ]);
  const providerPaymentIds = unique([
    ...stringArray((body as any).provider_payment_ids),
    ...stringArray((body as any).providerPaymentIds),
    ...stringArray((body as any).provider_payment_id),
    ...stringArray((body as any).order_id),
    ...stringArray((body as any).orderId),
    ...stringArray((body as any).taler_order_id),
    ...stringArray(params.get("provider_payment_id")),
    ...stringArray(params.get("order_id")),
    ...stringArray(params.get("orderId")),
    ...stringArray(params.get("taler_order_id")),
  ]);

  const supabase = createSupabaseAdmin();
  const candidates = await loadCandidatePayments(supabase, user.id, paymentIds, providerPaymentIds);
  const refs = Array.from(
    new Map(
      candidates.map((payment) => [
        payment.provider_payment_id ? `provider:${payment.provider_payment_id}` : `payment:${payment.id}`,
        payment,
      ])
    ).values()
  );

  const paidPayments: unknown[] = [];
  const pending: string[] = [];
  const errors: Array<{ payment_id: string; error: string }> = [];

  for (const payment of refs) {
    try {
      const confirmed = payment.provider_payment_id
        ? await confirmPayment(supabase, null, payment.provider_payment_id)
        : await confirmPayment(supabase, payment.id, null);
      paidPayments.push(...confirmed);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to verify payment.";
      if (message === "PAYMENT_NOT_PAID") {
        pending.push(payment.id);
      } else {
        errors.push({ payment_id: payment.id, error: message });
      }
    }
  }

  return NextResponse.json({
    checked: refs.length,
    paid_count: paidPayments.length,
    pending_count: pending.length,
    error_count: errors.length,
    payments: paidPayments,
    pending,
    errors,
  });
}

export async function GET(request: NextRequest) {
  try {
    return await checkPayments(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check payment.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    return await checkPayments(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to check payment.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
