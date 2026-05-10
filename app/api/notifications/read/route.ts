import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { markNotificationsRead } from "@/lib/services/notification.service";

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.map(String).filter(Boolean) : undefined;

    await markNotificationsRead(supabase, user.id, ids);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحديث الإشعارات.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
