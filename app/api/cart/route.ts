import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { getCart, requireSmallBusiness, updateCartItemQuantity } from "@/lib/services/cart.service";
import { normalizeCurrency } from "@/lib/currency";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    requireSmallBusiness(profile);
    const requestedCurrency = request.nextUrl.searchParams.get("currency");
    const currency = requestedCurrency || profile.preferred_currency || "ILS";
    const cart = await getCart(supabase, user.id, normalizeCurrency(currency));
    return NextResponse.json(cart);
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل السلة.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message === "SMALL_BUSINESS_ONLY" ? "هذه العملية متاحة للمشاريع الصغيرة فقط." : message }, { status });
  }
}

function cartErrorResponse(message: string) {
  const status =
    message === "UNAUTHORIZED"
      ? 401
      : message === "SMALL_BUSINESS_ONLY"
        ? 403
        : ["INSUFFICIENT_STOCK", "PRODUCT_NOT_AVAILABLE", "MIN_ORDER_QUANTITY"].includes(message)
          ? 400
          : 500;

  const publicMessage =
    message === "SMALL_BUSINESS_ONLY"
      ? "هذه العملية متاحة للمشاريع الصغيرة فقط."
      : message === "INSUFFICIENT_STOCK"
        ? "الكمية المطلوبة أكبر من المخزون المتوفر."
        : message === "PRODUCT_NOT_AVAILABLE"
          ? "هذا المنتج غير متاح للشراء حاليا."
          : message === "MIN_ORDER_QUANTITY"
            ? "الكمية أقل من الحد الأدنى للطلب."
            : message === "UNAUTHORIZED"
              ? "يجب تسجيل الدخول."
              : message;

  return NextResponse.json({ error: publicMessage }, { status });
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const productId = String(body.product_id || body.productId || "");
    const quantity = Math.max(1, Number(body.quantity || 1));

    requireSmallBusiness(profile);
    if (!productId) return NextResponse.json({ error: "product_id مطلوب." }, { status: 400 });

    const cart = await updateCartItemQuantity(
      supabase,
      user.id,
      productId,
      quantity,
      normalizeCurrency(body.currency || profile.preferred_currency)
    );
    return NextResponse.json({ success: true, cart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحديث السلة.";
    return cartErrorResponse(message);
  }
}
