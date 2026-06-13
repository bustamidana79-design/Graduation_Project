import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmPayment } from "@/lib/services/payment.service";

function addPaymentReturnParams(
  url: URL,
  status: "success" | "failed",
  params: {
    paymentId?: string | null;
    providerPaymentId?: string | null;
    reason?: string;
  }
) {
  url.searchParams.set("payment", status);
  if (params.paymentId) url.searchParams.set("payment_id", params.paymentId);
  if (params.providerPaymentId) url.searchParams.set("provider_payment_id", params.providerPaymentId);
  if (params.reason) url.searchParams.set("reason", params.reason);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const returnUrl = requestUrl.searchParams.get("return_url");
  const fallbackUrl = returnUrl ? new URL(returnUrl) : new URL("/payment/return", request.url);
  const wantsJson = requestUrl.searchParams.get("format") === "json";
  const paymentId = requestUrl.searchParams.get("paymentId") || requestUrl.searchParams.get("payment_id");
  const providerPaymentId =
    requestUrl.searchParams.get("providerPaymentId") ||
    requestUrl.searchParams.get("provider_payment_id") ||
    requestUrl.searchParams.get("order_id") ||
    requestUrl.searchParams.get("orderId") ||
    requestUrl.searchParams.get("taler_order_id");

  try {
    if (requestUrl.searchParams.get("mock") === "true") {
      return NextResponse.json({ error: "Mock payment is disabled." }, { status: 400 });
    }

    if (!paymentId && !providerPaymentId) {
      return NextResponse.json({ error: "paymentId or providerPaymentId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const payments = await confirmPayment(supabase, paymentId, providerPaymentId);

    if (!wantsJson) {
      addPaymentReturnParams(fallbackUrl, "success", {
        paymentId: paymentId || payments[0]?.id,
        providerPaymentId: providerPaymentId || payments[0]?.provider_payment_id,
      });
      return NextResponse.redirect(fallbackUrl);
    }

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm payment.";

    if (!wantsJson) {
      addPaymentReturnParams(fallbackUrl, "failed", {
        paymentId,
        providerPaymentId,
        reason: message,
      });
      return NextResponse.redirect(fallbackUrl);
    }

    const status =
      message === "PAYMENT_NOT_FOUND"
        ? 404
        : message === "PAYMENT_NOT_PAID"
          ? 402
          : message === "Taler service unavailable"
            ? 503
            : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
