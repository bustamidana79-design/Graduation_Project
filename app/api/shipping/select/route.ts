import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { selectShippingCompany } from "@/lib/services/shipping.service";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const orderId = String(body.order_id || body.orderId || "");
    const shippingCompanyId = String(body.shipping_company_id || body.shippingCompanyId || "");

    requireSmallBusiness(profile);
    if (!orderId || !shippingCompanyId) {
      return NextResponse.json({ error: "order_id و shipping_company_id مطلوبان." }, { status: 400 });
    }

    const deliveryOrder = await selectShippingCompany(supabase, user.id, orderId, shippingCompanyId);
    return NextResponse.json({ delivery_order: deliveryOrder }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل اختيار شركة الشحن.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ORDER_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
