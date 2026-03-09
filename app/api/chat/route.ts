import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { message, sessionId, profileId } = await req.json();

    if (!message || !sessionId || !profileId) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    // 1. احفظ رسالة المستخدم
    await supabase.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "user",
      message,
    });

    // 2. جيب تاريخ المحادثة كاملاً
    const { data: history } = await supabase
      .from("ai_chat_messages")
      .select("role, message")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true });

    // 3. جيب بيانات السوشال ميديا
    const { data: socialAccounts } = await supabase
      .from("social_media_accounts")
      .select("*")
      .eq("profile_id", profileId);

    const socialContext = socialAccounts?.length
      ? `بيانات حسابات السوشال ميديا للمستخدم: ${JSON.stringify(socialAccounts)}`
      : "المستخدم لم يضف بيانات السوشال ميديا بعد.";

    // 4. ابعث لـ Groq
    const messages = [
      {
        role: "system" as const,
        content: `أنت مساعد تسويق رقمي ذكي متخصص في مساعدة أصحاب المشاريع الصغيرة. 
        تتحدث بالعربية دائماً.
        تقدم نصائح تسويقية عملية ومحددة.
        ${socialContext}`,
      },
      ...(history?.map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.message,
      })) || []),
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1024,
    });

    const reply = completion.choices[0]?.message?.content || "عذراً، حدث خطأ.";

    // 5. احفظ رد الـ AI
    await supabase.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "assistant",
      message: reply,
    });

    return NextResponse.json({ reply });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}