import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { listNotifications } from "@/lib/services/notification.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const notifications = await listNotifications(supabase, user.id, limit);
    return NextResponse.json({ notifications });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل الإشعارات.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
