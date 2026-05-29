import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const body = await request.json();
    const productId = String(body.product_id || body.productId || "").trim();

    if (!productId) {
      return NextResponse.json({ error: "product_id مطلوب." }, { status: 400 });
    }

    const { error } = await supabase.from("product_views").insert({
      user_id: user.id,
      product_id: productId,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تسجيل مشاهدة المنتج.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
