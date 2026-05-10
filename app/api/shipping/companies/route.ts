import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { getShippingCompanies } from "@/lib/services/shipping.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, profile } = await requireAuthProfile(request);
    requireSmallBusiness(profile);
    const companies = await getShippingCompanies(supabase);
    return NextResponse.json({ companies });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل شركات الشحن.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
