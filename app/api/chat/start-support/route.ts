import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { getDashboardMessagesRoute } from "@/lib/profile-routes";

type DirectConversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
};

async function findConversation(supabase: ReturnType<typeof createSupabaseAdmin>, userId: string, adminId: string) {
  const existingFilter =
    `and(user_one_id.eq.${userId},user_two_id.eq.${adminId}),` +
    `and(user_one_id.eq.${adminId},user_two_id.eq.${userId})`;

  const { data, error } = await supabase
    .from("direct_conversations")
    .select("id, user_one_id, user_two_id")
    .or(existingFilter)
    .maybeSingle();

  if (error) throw error;
  return (data as DirectConversation | null) || null;
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json().catch(() => ({}));
    const productId = String(body.productId || body.product_id || "").trim();
    const productName = String(body.productName || body.product_name || "").trim();
    const supabase = createSupabaseAdmin();

    const { data: admin, error: adminError } = await supabase
      .from("profiles")
      .select("id")
      .eq("account_type", "admin")
      .neq("id", user.id)
      .limit(1)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!admin?.id) {
      return NextResponse.json({ error: "No admin account is available for support." }, { status: 404 });
    }

    const existingConversation = await findConversation(supabase, user.id, admin.id);
    let conversationId = existingConversation?.id ?? null;

    if (!conversationId) {
      const { data: createdConversation, error: createError } = await supabase
        .from("direct_conversations")
        .insert({
          user_one_id: user.id,
          user_two_id: admin.id,
        })
        .select("id, user_one_id, user_two_id")
        .single();

      if (createError) throw createError;
      conversationId = (createdConversation as DirectConversation).id;
    }

    const supportMessage = [
      "Hello, I need support regarding a product deleted from my account.",
      productName ? `Product name: ${productName}.` : "",
      productId ? `Product ID: ${productId}.` : "",
    ]
      .filter(Boolean)
      .join(" ");

    const { data: duplicateMessage, error: duplicateError } = await supabase
      .from("direct_messages")
      .select("id")
      .eq("conversation_id", conversationId)
      .eq("sender_id", user.id)
      .eq("receiver_id", admin.id)
      .eq("content", supportMessage)
      .maybeSingle();

    if (duplicateError) throw duplicateError;

    if (!duplicateMessage) {
      const { error: messageError } = await supabase.from("direct_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        receiver_id: admin.id,
        content: supportMessage,
      });

      if (messageError) throw messageError;

      const now = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("direct_conversations")
        .update({
          last_message: supportMessage,
          last_message_at: now,
          last_sender_id: user.id,
          updated_at: now,
        })
        .eq("id", conversationId);

      if (updateError) throw updateError;
    }

    return NextResponse.json({
      conversationId,
      route: `${getDashboardMessagesRoute(profile.account_type)}?conversation=${conversationId}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to open support chat.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Login is required." : message }, { status });
  }
}
