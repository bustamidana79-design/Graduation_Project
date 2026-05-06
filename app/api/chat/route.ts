import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { groq } from "@/lib/groq";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

type ChatRequestBody = {
  message?: string;
  sessionId?: string;
  profileId?: string;
  accountType?: AccountType;
};

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "merchant",
  small_business: "small business owner",
  delivery: "delivery company",
  supporter: "supporter",
  admin: "platform admin",
};

const createAuthedSupabase = (token: string) =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as ChatRequestBody;
    const message = body.message?.trim();

    if (!message || !body.sessionId || !body.profileId) {
      return NextResponse.json({ error: "Missing chat message data." }, { status: 400 });
    }

    const accountType = body.accountType || "small_business";
    const supabase = createAuthedSupabase(token);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user || user.id !== body.profileId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: session, error: sessionError } = await supabase
      .from("ai_chat_sessions")
      .select("id")
      .eq("id", body.sessionId)
      .eq("profile_id", body.profileId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Chat session was not found." }, { status: 404 });
    }

    const { error: userMessageError } = await supabase.from("ai_chat_messages").insert({
      session_id: body.sessionId,
      role: "user",
      message,
    });

    if (userMessageError) {
      throw userMessageError;
    }

    const { data: knowledge } = await supabase
      .from("ai_knowledge_base")
      .select("title, content")
      .eq("is_active", true)
      .in("account_type", ["all", accountType])
      .limit(8);

    const { data: history } = await supabase
      .from("ai_chat_messages")
      .select("role, message")
      .eq("session_id", body.sessionId)
      .order("created_at", { ascending: false })
      .limit(10);

    const knowledgeText =
      knowledge?.map((item) => `${item.title}: ${item.content}`).join("\n\n") ||
      "No extra platform knowledge is available.";

    const orderedHistory = [...(history || [])].reverse();

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0.4,
      max_tokens: 700,
      messages: [
        {
          role: "system",
          content: [
            "You are the smart assistant for a Palestinian B2B platform.",
            `The current user is a ${accountTypeLabels[accountType]}.`,
            "Reply in Arabic. Be practical, concise, and specific to the user's role.",
            "Do not claim final legal, financial, or administrative authority.",
            `Platform knowledge:\n${knowledgeText}`,
          ].join("\n"),
        },
        ...orderedHistory.map((item) => ({
          role: item.role as "user" | "assistant",
          content: item.message as string,
        })),
      ],
    });

    const reply =
      completion.choices[0]?.message?.content?.trim() ||
      "عذراً، لم أستطع توليد رد مناسب الآن.";

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("ai_chat_messages")
      .insert({
        session_id: body.sessionId,
        role: "assistant",
        message: reply,
      })
      .select("id")
      .single();

    if (assistantMessageError) {
      throw assistantMessageError;
    }

    return NextResponse.json({ reply, messageId: assistantMessage?.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected chat error.";
    console.error("Chat API error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
