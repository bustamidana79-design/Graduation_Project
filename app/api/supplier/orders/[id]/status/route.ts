import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { updateSupplierOrderStatus } from "@/lib/services/order.service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const { id } = await context.params;
    const body = await request.json();
    const status = String(body.status || "");

    if (profile.account_type !== "merchant") {
      return NextResponse.json({ error: "هذه العملية متاحة للموردين فقط." }, { status: 403 });
    }

    const order = await updateSupplierOrderStatus(supabase, user.id, id, status);
    return NextResponse.json({ order });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحديث حالة الطلب.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "INVALID_STATUS" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
