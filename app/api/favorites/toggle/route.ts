import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { toggleFavorite } from "@/lib/services/favorites.service";

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const productId = String(body.product_id || body.productId || "");

    requireSmallBusiness(profile);
    const result = await toggleFavorite(supabase, user.id, productId);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحديث المفضلة.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
