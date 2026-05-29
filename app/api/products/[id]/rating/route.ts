import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;
    const { supabase, user, profile } = await requireAuthProfile(request);

    if (profile.account_type !== "small_business") {
      return NextResponse.json({ error: "التقييم متاح للمشترين فقط" }, { status: 403 });
    }

    const body = await request.json();
    const rating = Number(body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "قيمة التقييم يجب أن تكون بين 1 و 5" }, { status: 400 });
    }

    const { data: purchasedRows, error: purchaseError } = await supabase
      .from("order_items")
      .select("id, orders!inner(id, buyer_id, status)")
      .eq("product_id", productId)
      .eq("orders.buyer_id", user.id)
      .eq("orders.status", "paid")
      .limit(1);

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 400 });
    }

    if (!purchasedRows || purchasedRows.length === 0) {
      return NextResponse.json({ error: "يمكن تقييم المنتج فقط بعد شرائه" }, { status: 403 });
    }

    const { error: upsertError } = await supabase
      .from("product_ratings")
      .upsert(
        {
          product_id: productId,
          user_id: user.id,
          rating,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "product_id,user_id" }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 400 });
    }

    const { data: ratings, error: ratingsError } = await supabase
      .from("product_ratings")
      .select("rating")
      .eq("product_id", productId);

    if (ratingsError) {
      return NextResponse.json({ error: ratingsError.message }, { status: 400 });
    }

    const count = ratings?.length || 0;
    const average = count ? (ratings || []).reduce((sum, row) => sum + Number(row.rating || 0), 0) / count : 0;

    const { error: updateError } = await supabase
      .from("products")
      .update({ rating_average: Number(average.toFixed(2)), rating_count: count })
      .eq("id", productId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ rating_average: Number(average.toFixed(2)), rating_count: count });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    const status = message === "UNAUTHORIZED" ? 401 : message === "PROFILE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
