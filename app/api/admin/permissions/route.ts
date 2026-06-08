import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function forbidden(message = "غير مصرح لك بمراقبة الحسابات.") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export async function GET(request: NextRequest) {
  try {
    const { profile } = await requireAuthProfile(request);
    if (!isAdminProfile(profile)) return forbidden();

    const supabase = createSupabaseAdmin();

    const { data: users, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, country, city, account_type, status, is_active, created_at")
      .eq("status", "approved")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل الحسابات.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
