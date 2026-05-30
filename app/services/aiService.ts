import Groq from "groq-sdk";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

interface AIAnalysis {
  summary: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

const validPriorities = new Set(["high", "medium", "low"]);

const normalizePriority = (priority?: string): AIAnalysis["priority"] => {
  const normalizedPriority = priority?.toLowerCase();
  return validPriorities.has(normalizedPriority || "")
    ? (normalizedPriority as AIAnalysis["priority"])
    : "medium";
};

const buildFallbackSummary = (subject: string, messageContent: string) => {
  const fallback = subject.trim() || messageContent.trim() || "تذكرة دعم تحتاج متابعة";
  return fallback.length > 90 ? `${fallback.slice(0, 87)}...` : fallback;
};

const buildSafeAnalysis = (
  analysis: Partial<AIAnalysis>,
  subject: string,
  messageContent: string
): Pick<AIAnalysis, "summary" | "priority"> => {
  const summary =
    typeof analysis.summary === "string" && analysis.summary.trim()
      ? analysis.summary.trim()
      : buildFallbackSummary(subject, messageContent);

  return {
    summary,
    priority: normalizePriority(analysis.priority),
  };
};

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const analyzeTicketWithAI = async (
  ticketId: string,
  subject: string,
  messageContent: string
) => {
  try {
    console.log("--- Starting AI ticket analysis ---");

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
    const analysis = buildSafeAnalysis(
      JSON.parse(content || "{}") as Partial<AIAnalysis>,
      subject,
      messageContent
    );

    const supabaseAdmin = createSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from('support_tickets')
      .update({
        ai_summary: analysis.summary,
        priority: analysis.priority,
      })
      .eq('id', ticketId)
      .select();

    if (error) throw error;
    console.log("Ticket AI summary updated successfully:", data);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("AI ticket summary failed:", errorMessage);

    try {
      const supabaseAdmin = createSupabaseAdmin();
      const { error: fallbackError } = await supabaseAdmin
        .from('support_tickets')
        .update({
          ai_summary: buildFallbackSummary(subject, messageContent),
          priority: "medium",
        })
        .eq('id', ticketId);

      if (fallbackError) {
        console.error("Failed to save fallback ticket summary:", fallbackError.message);
      }
    } catch (fallbackError: unknown) {
      const fallbackErrorMessage =
        fallbackError instanceof Error ? fallbackError.message : "Unknown error";
      console.error("Fallback ticket summary failed:", fallbackErrorMessage);
    }
  }
};
