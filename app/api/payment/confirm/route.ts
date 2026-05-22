import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmPayment } from "@/lib/services/payment.service";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const returnUrl = requestUrl.searchParams.get("return_url");
  const fallbackUrl = returnUrl ? new URL(returnUrl) : new URL("/dashboard/small-business/orders", request.url);
  const wantsJson = requestUrl.searchParams.get("format") === "json";

  try {
    if (requestUrl.searchParams.get("mock") === "true") {
      return NextResponse.json({ error: "Mock payment is disabled." }, { status: 400 });
    }

    const paymentId = requestUrl.searchParams.get("paymentId") || requestUrl.searchParams.get("payment_id");
    const providerPaymentId =
      requestUrl.searchParams.get("providerPaymentId") ||
      requestUrl.searchParams.get("provider_payment_id") ||
      requestUrl.searchParams.get("order_id");

    if (!paymentId && !providerPaymentId) {
      return NextResponse.json({ error: "paymentId or providerPaymentId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const payments = await confirmPayment(supabase, paymentId, providerPaymentId);

    if (!wantsJson) {
      fallbackUrl.searchParams.set("payment", "success");
      return NextResponse.redirect(fallbackUrl);
    }

    return NextResponse.json({ success: true, payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to confirm payment.";

    if (!wantsJson) {
      fallbackUrl.searchParams.set("payment", "failed");
      fallbackUrl.searchParams.set("reason", message);
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
