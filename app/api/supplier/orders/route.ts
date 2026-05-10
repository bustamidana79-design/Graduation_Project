import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { getSupplierOrders } from "@/lib/services/order.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    if (profile.account_type !== "merchant") {
      return NextResponse.json({ error: "هذه الصفحة متاحة للموردين فقط." }, { status: 403 });
    }

    const orders = await getSupplierOrders(supabase, user.id);
    return NextResponse.json({ orders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل طلبات المورد.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
