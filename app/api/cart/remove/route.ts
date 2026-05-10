import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { removeFromCart, requireSmallBusiness } from "@/lib/services/cart.service";

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json().catch(() => ({}));
    const { searchParams } = new URL(request.url);
    const productId = String(body.product_id || body.productId || searchParams.get("product_id") || "");

    requireSmallBusiness(profile);
    if (!productId) return NextResponse.json({ error: "product_id مطلوب." }, { status: 400 });

    const cart = await removeFromCart(supabase, user.id, productId);
    return NextResponse.json({ success: true, cart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل حذف المنتج من السلة.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message === "SMALL_BUSINESS_ONLY" ? "هذه العملية متاحة للمشاريع الصغيرة فقط." : message }, { status });
  }
}
