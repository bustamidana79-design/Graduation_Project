import { NextRequest, NextResponse } from "next/server";
import { isAdminProfile, requireAuthProfile } from "@/lib/api-auth";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { supabase, profile } = await requireAuthProfile(request);
    if (!isAdminProfile(profile)) {
      return NextResponse.json({ error: "غير مصرح لك بحذف هذا المنتج." }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body.reason || "").trim();

    if (!reason) {
      return NextResponse.json({ error: "يجب كتابة سبب الحذف." }, { status: 400 });
    }

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, name, supplier_id")
      .eq("id", id)
      .single();

    if (productError || !product) {
      return NextResponse.json({ error: "المنتج غير موجود." }, { status: 404 });
    }

    const { error: notificationError } = await supabase.from("notifications").insert({
      user_id: product.supplier_id,
      title: "تم حذف منتجك",
      body: `تم حذف المنتج "${product.name}" بسبب: ${reason}`,
    });

    if (notificationError) {
      return NextResponse.json({ error: notificationError.message }, { status: 500 });
    }

    const { data: ticket, error: ticketError } = await supabase
      .from("support_tickets")
      .insert({
        user_id: product.supplier_id,
        subject: "حذف منتج",
        user_role: "supplier",
        status: "open",
        priority: "medium",
        last_sender_type: "system",
      })
      .select("id")
      .single();

    if (ticketError || !ticket) {
      return NextResponse.json({ error: ticketError?.message || "فشل إنشاء تذكرة الدعم." }, { status: 500 });
    }

    const { error: messageError } = await supabase.from("ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: product.supplier_id,
      sender_type: "system",
      message: reason,
    });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    await supabase.from("product_images").delete().eq("product_id", id);
    const { error: deleteError } = await supabase.from("products").delete().eq("id", id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل حذف المنتج.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
