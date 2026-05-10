import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { listFavorites } from "@/lib/services/favorites.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    requireSmallBusiness(profile);
    const favorites = await listFavorites(supabase, user.id);
    return NextResponse.json({ favorites });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل المفضلة.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
