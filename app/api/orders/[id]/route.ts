import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { getBuyerOrderById } from "@/lib/services/order.service";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const { id } = await context.params;
    requireSmallBusiness(profile);
    const order = await getBuyerOrderById(supabase, user.id, id);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل الطلب.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "ORDER_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
