import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { addToCart, requireSmallBusiness } from "@/lib/services/cart.service";

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
    message === "UNAUTHORIZED"
      ? "يجب تسجيل الدخول."
      : message === "SMALL_BUSINESS_ONLY"
        ? "هذه العملية متاحة للمشاريع الصغيرة فقط."
        : message === "INSUFFICIENT_STOCK"
          ? "الكمية المطلوبة أكبر من المخزون المتوفر."
          : message === "PRODUCT_NOT_AVAILABLE"
            ? "هذا المنتج غير متاح للشراء حاليا."
            : message === "MIN_ORDER_QUANTITY"
              ? "الكمية أقل من الحد الأدنى للطلب."
              : message;

  return NextResponse.json({ error: publicMessage }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const productId = String(body.product_id || body.productId || "");
    const quantity = Math.max(1, Number(body.quantity || 1));

    requireSmallBusiness(profile);
    const cart = await addToCart(supabase, user.id, productId, quantity);
    return NextResponse.json({ success: true, cart });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إضافة المنتج إلى السلة.";
    return cartErrorResponse(message);
  }
}
