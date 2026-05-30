import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { notifyAdminsAboutSupportMessage } from "@/lib/services/support-notifications.service";

const FIRST_MESSAGE = "مرحباً، لدي استفسار بخصوص حذف أحد منتجاتي";

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json().catch(() => ({}));
    const ticketIdFromNotification = String(body.ticketId || body.ticket_id || "").trim();
    const productName = String(body.productName || body.product_name || "").trim();
    const productId = String(body.productId || body.product_id || "").trim();
    const reason = String(body.reason || "").trim();
    const supabase = createSupabaseAdmin();

    const subject = productName ? `استفسار بخصوص حذف المنتج: ${productName}` : "استفسار بخصوص حذف منتج";
    const details = [
      FIRST_MESSAGE,
      productName ? `اسم المنتج: ${productName}` : "",
      productId ? `رقم المنتج: ${productId}` : "",
      reason ? `سبب الحذف: ${reason}` : "",
    ].filter(Boolean).join("\n");

    if (ticketIdFromNotification) {
      const { data: notificationTicket, error: notificationTicketError } = await supabase
        .from("support_tickets")
        .select("id")
        .eq("id", ticketIdFromNotification)
        .eq("user_id", user.id)
        .maybeSingle();

      if (notificationTicketError) throw notificationTicketError;

      if (notificationTicket?.id) {
        return NextResponse.json({
          ticketId: notificationTicket.id,
          route: `/dashboard/${profile.account_type === "merchant" ? "supplier" : profile.account_type}/customer-service?ticket=${notificationTicket.id}`,
        });
      }
    }

    const { data: openTickets, error: existingError } = await supabase
      .from("support_tickets")
      .select("id, subject")
      .eq("user_id", user.id)
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(20);

    if (existingError) throw existingError;

    const existingTicket = (openTickets || []).find((ticket: { id: string; subject?: string | null }) => {
      const ticketSubject = ticket.subject || "";
      return ticketSubject === subject || (productName ? ticketSubject.includes(productName) : false);
    });

    let ticketId = existingTicket?.id;

    if (!ticketId) {
      const { data: ticket, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          user_id: user.id,
          subject,
          user_role: profile.account_type === "merchant" ? "supplier" : profile.account_type,
          status: "open",
          priority: "medium",
          last_sender_type: "user",
        })
        .select("id")
        .single();

      if (ticketError || !ticket) throw ticketError || new Error("Failed to create support ticket.");
      ticketId = ticket.id;

      const { error: messageError } = await supabase.from("ticket_messages").insert({
        ticket_id: ticketId,
        sender_id: user.id,
        sender_type: "user",
        message: details,
      });

      if (messageError) throw messageError;

      await notifyAdminsAboutSupportMessage(
        supabase,
        {
          id: ticketId,
          user_id: user.id,
          subject,
          user_role: profile.account_type === "merchant" ? "supplier" : profile.account_type,
        },
        details
      );
    }

    return NextResponse.json({
      ticketId,
      route: `/dashboard/${profile.account_type === "merchant" ? "supplier" : profile.account_type}/customer-service?ticket=${ticketId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open support.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Login is required." : message }, { status });
  }
}
