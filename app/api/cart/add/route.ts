import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const productId = String(body.product_id || "");
    const quantity = Math.max(1, Number(body.quantity || 1));

    if (profile.account_type !== "small_business") {
      return NextResponse.json({ error: "هذه العملية متاحة للمشاريع الصغيرة فقط." }, { status: 403 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, stock_quantity, min_order_quantity, is_published")
      .eq("id", productId)
      .single();

    if (productError || !product || !product.is_published || product.stock_quantity <= 0) {
      return NextResponse.json({ error: "هذا المنتج غير متاح للشراء حاليًا." }, { status: 400 });
    }

    let { data: cart } = await supabase.from("carts").select("id").eq("user_id", user.id).single();
    if (!cart) {
      const { data: newCart, error: cartError } = await supabase
        .from("carts")
        .insert({ user_id: user.id })
        .select("id")
        .single();

      if (cartError || !newCart) {
        return NextResponse.json({ error: cartError?.message || "فشل إنشاء السلة." }, { status: 500 });
      }
      cart = newCart;
    }

    const finalQuantity = Math.max(quantity, Number(product.min_order_quantity || 1));
    const { data: existingItem } = await supabase
      .from("cart_items")
      .select("id, quantity")
      .eq("cart_id", cart.id)
      .eq("product_id", productId)
      .single();

    if (existingItem) {
      const { error } = await supabase
        .from("cart_items")
        .update({ quantity: existingItem.quantity + finalQuantity })
        .eq("id", existingItem.id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    } else {
      const { error } = await supabase.from("cart_items").insert({
        cart_id: cart.id,
        product_id: productId,
        quantity: finalQuantity,
      });

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إضافة المنتج إلى السلة.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
