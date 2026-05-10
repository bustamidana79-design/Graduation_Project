import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { updateDeliveryStatus } from "@/lib/services/shipping.service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const { id } = await context.params;
    const body = await request.json();

    if (profile.account_type !== "delivery") {
      return NextResponse.json({ error: "هذه العملية متاحة لشركات الشحن فقط." }, { status: 403 });
    }

    const deliveryOrder = await updateDeliveryStatus(
      supabase,
      user.id,
      id,
      String(body.status || ""),
      body.note ? String(body.note) : undefined,
      body.location ? String(body.location) : undefined
    );

    return NextResponse.json({ delivery_order: deliveryOrder });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحديث حالة التوصيل.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "INVALID_STATUS" ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
