import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { createPayment } from "@/lib/services/payment.service";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const orderIds = Array.isArray(body.order_ids)
      ? body.order_ids.map(String)
      : Array.isArray(body.orderIds)
        ? body.orderIds.map(String)
        : [String(body.order_id || body.orderId || "")].filter(Boolean);

    requireSmallBusiness(profile);
    const payment = await createPayment(supabase, user.id, orderIds, body.return_url || body.returnUrl);
    return NextResponse.json(payment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إنشاء الدفع.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ORDER_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
