import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { getOrCreateDailyTip } from "@/lib/services/daily-tip.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, profile } = await requireAuthProfile(request);
    const tip = await getOrCreateDailyTip(supabase, profile);

    return NextResponse.json({ tip });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل نصيحة اليوم.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "PROFILE_NOT_FOUND" ? 404 : 500;

    return NextResponse.json(
      { error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message },
      { status }
    );
  }
}
