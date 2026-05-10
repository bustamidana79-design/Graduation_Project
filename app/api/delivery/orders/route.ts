import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { getDeliveryOrders } from "@/lib/services/shipping.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    if (profile.account_type !== "delivery") {
      return NextResponse.json({ error: "هذه الصفحة متاحة لشركات الشحن فقط." }, { status: 403 });
    }

    const orders = await getDeliveryOrders(supabase, user.id);
    return NextResponse.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل طلبات التوصيل.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
