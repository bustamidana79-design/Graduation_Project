import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { createOrdersFromCart } from "@/lib/services/order.service";

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const shippingAddressId = String(body.shipping_address_id || body.shippingAddressId || body.address_id || "");

    requireSmallBusiness(profile);
    const supabase = createSupabaseAdmin();
    const orders = await createOrdersFromCart(supabase, user.id, shippingAddressId);
    return NextResponse.json({ orders }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إنشاء الطلب.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
