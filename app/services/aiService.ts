import { createClient } from '@supabase/supabase-js';
import Groq from "groq-sdk";

interface AIAnalysis {
  summary: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ضفنا subject كباراميتر اختياري عشان الـ AI يفهم السياق أكتر
export const analyzeTicketWithAI = async (ticketId: string, subject: string, messageContent: string) => {
  try {
    console.log("--- بداية عملية تحليل الذكاء الاصطناعي ---");

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a professional B2B support assistant. 
          Analyze the support ticket and return ONLY a valid JSON object.
          The 'summary' must be a very short sentence in Arabic (max 7 words).
          The 'priority' must be one of: 'high', 'medium', 'low'.
          The 'category' should be a general classification in Arabic (e.g., تقني, مالي, شحن).`
        },
        {
          role: "user",
          content: `Subject: ${subject}\nMessage: ${messageContent}`,
        },
      ],
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
    });

    const content = chatCompletion.choices[0]?.message?.content;
    const analysis: AIAnalysis = JSON.parse(content || "{}");

    // تحديث Supabase
    const { data, error } = await supabase
      .from('support_tickets')
      .update({
        ai_summary: analysis.summary,
        priority: analysis.priority.toLowerCase(),
        // إذا حابة تضيفي تصنيف المشكلة مستقبلاً:
        // category: analysis.category 
      })
      .eq('id', ticketId)
      .select();

    if (error) throw error;
    console.log("✅ تم التحديث بنجاح:", data);

  } catch (error: any) {
    console.error("❌ خطأ في خدمة الـ AI:", error.message);
  }
}