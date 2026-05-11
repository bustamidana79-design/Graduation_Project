import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { createOrdersFromCart } from "@/lib/services/order.service";
import { normalizeCurrency } from "@/lib/currency";

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const city = String(body.city || "").trim();
    const area = String(body.area || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const currency = normalizeCurrency(body.currency || profile.preferred_currency);

    requireSmallBusiness(profile);
    if (!phone) {
      return NextResponse.json({ error: "PHONE_REQUIRED" }, { status: 400 });
    }
    if (!city) {
      return NextResponse.json({ error: "CITY_REQUIRED" }, { status: 400 });
    }
    if (!area) {
      return NextResponse.json({ error: "AREA_REQUIRED" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const orders = await createOrdersFromCart(supabase, user.id, { phone, city, area, notes }, currency);
    return NextResponse.json({ orders }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إنشاء الطلب.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
