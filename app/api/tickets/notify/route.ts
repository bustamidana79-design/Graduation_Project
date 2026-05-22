import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import {
  notifyAdminsAboutSupportMessage,
  notifyUserAboutAdminSupportMessage,
} from "@/lib/services/support-notifications.service";

export async function POST(request: NextRequest) {
  try {
    const { profile, user } = await requireAuthProfile(request);
    const body = await request.json().catch(() => ({}));
    const ticketId = String(body.ticketId || "").trim();
    const senderType = String(body.senderType || "").trim();
    const message = String(body.message || "").trim();

    if (!ticketId || !message || !["user", "admin"].includes(senderType)) {
      return NextResponse.json({ error: "بيانات الإشعار غير مكتملة." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("id, user_id, subject, user_role")
      .eq("id", ticketId)
      .single();

    if (error || !ticket) {
      return NextResponse.json({ error: "التذكرة غير موجودة." }, { status: 404 });
    }

    const isAdmin = isAdminProfile(profile);
    if (senderType === "admin" && !isAdmin) {
      return NextResponse.json({ error: "غير مصرح لك بإرسال إشعار إداري." }, { status: 403 });
    }

    if (senderType === "user" && ticket.user_id !== user.id && !isAdmin) {
      return NextResponse.json({ error: "غير مصرح لك بهذه التذكرة." }, { status: 403 });
    }

    if (senderType === "admin") {
      await notifyUserAboutAdminSupportMessage(supabase, ticket, message);
    } else {
      await notifyAdminsAboutSupportMessage(supabase, ticket, message);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إرسال إشعار التذكرة.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
