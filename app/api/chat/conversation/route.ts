import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

type DirectConversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
};

async function findConversation(
  supabase: Awaited<ReturnType<typeof requireAuthProfile>>["supabase"],
  currentUserId: string,
  targetUserId: string
) {
  const existingFilter =
    `and(user_one_id.eq.${currentUserId},user_two_id.eq.${targetUserId}),` +
    `and(user_one_id.eq.${targetUserId},user_two_id.eq.${currentUserId})`;

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
    const { supabase, user } = await requireAuthProfile(request);
    const body = await request.json();
    const targetUserId = String(body.targetUserId || "").trim();

    if (!targetUserId) {
      return NextResponse.json({ error: "targetUserId is required." }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "لا يمكن بدء محادثة مع نفس الحساب." }, { status: 400 });
    }

    const { data: targetProfile, error: targetError } = await supabase
      .from("profiles")
      .select("id, account_type, status")
      .eq("id", targetUserId)
      .eq("status", "approved")
      .neq("account_type", "admin")
      .maybeSingle();

    if (targetError) throw targetError;

    if (!targetProfile) {
      return NextResponse.json({ error: "المستخدم غير متاح للمحادثة." }, { status: 404 });
    }

    const existingConversation = await findConversation(supabase, user.id, targetUserId);
    if (existingConversation) {
      return NextResponse.json({ conversationId: existingConversation.id });
    }

    const { data: createdConversation, error: createError } = await supabase
      .from("direct_conversations")
      .insert([
        {
          user_one_id: user.id,
          user_two_id: targetUserId,
        },
      ])
      .select("id, user_one_id, user_two_id")
      .single();

    if (createError) {
      const conversationAfterRace = await findConversation(supabase, user.id, targetUserId);
      if (conversationAfterRace) {
        return NextResponse.json({ conversationId: conversationAfterRace.id });
      }

      throw createError;
    }

    return NextResponse.json({ conversationId: (createdConversation as DirectConversation).id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل بدء المحادثة.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
