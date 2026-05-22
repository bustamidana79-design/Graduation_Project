import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

function getSupportRole(accountType?: string | null) {
  if (accountType === "merchant") return "supplier";
  if (accountType === "small_business") return "small_business";
  if (accountType === "delivery") return "delivery";
  if (accountType === "supporter") return "supporter";
  return "supplier";
}

export async function POST(request: NextRequest) {
  try {
    const { profile, user } = await requireAuthProfile(request);
    if (!isAdminProfile(profile)) {
      return NextResponse.json({ error: "غير مصرح لك بإرسال رسائل الدعم." }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetUserId = String(body.userId || "").trim();
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();

    if (!targetUserId || !subject || !message) {
      return NextResponse.json({ error: "يجب اختيار المستخدم وكتابة عنوان الرسالة ومحتواها." }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const { data: targetProfile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, account_type")
      .eq("id", targetUserId)
      .single();

    if (profileError || !targetProfile) {
      return NextResponse.json({ error: "المستخدم غير موجود." }, { status: 404 });
    }

    if (targetProfile.account_type === "admin") {
      return NextResponse.json({ error: "لا يمكن فتح تذكرة دعم لحساب أدمن." }, { status: 400 });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: targetUserId,
        subject,
        user_role: getSupportRole(targetProfile.account_type),
        status: "open",
        priority: "medium",
        last_sender_type: "admin",
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: ticketError?.message || "فشل إنشاء تذكرة الدعم." }, { status: 500 });
    }

    const { error: messageError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: user.id,
      sender_type: "admin",
      message,
    });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    await supabase.from("notifications").insert({
      user_id: targetUserId,
      title: "رسالة جديدة من الإدارة",
      body: subject,
      notification_type: "support_message",
      data: {
        ticket_id: ticket.id,
        action: "open_support",
      },
    });

    return NextResponse.json({ success: true, ticketId: ticket.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل إرسال رسالة الدعم.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
