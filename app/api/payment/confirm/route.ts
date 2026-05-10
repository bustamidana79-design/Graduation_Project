import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmPayment } from "@/lib/services/payment.service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentId = searchParams.get("paymentId") || searchParams.get("payment_id");
    const providerPaymentId =
      searchParams.get("providerPaymentId") || searchParams.get("provider_payment_id") || searchParams.get("order_id");

    if (!paymentId && !providerPaymentId) {
      return NextResponse.json({ error: "paymentId أو providerPaymentId مطلوب." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const payments = await confirmPayment(supabase, paymentId, providerPaymentId);
    return NextResponse.json({ success: true, payments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تأكيد الدفع.";
    const status = message === "PAYMENT_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
