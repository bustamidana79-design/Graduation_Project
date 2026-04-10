// app/api/ai/evaluate-application/route.ts
import { NextRequest, NextResponse } from "next/server";
import { analyzeImage as groqAnalyzeImage } from "@/lib/vision";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const RF_AI_SERVER_URL = "http://127.0.0.1:5000/predict";

const accountTypeLabel: Record<string, string> = {
  merchant: "تاجر (جملة)",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};
// دالة سريعة للترجمة باستخدام Groq لضمان توافق اللغة مع الموديل الإنجليزي
async function translateToEnglish(text: string): Promise<string> {
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant", // موديل سريع ورخيص جداً للترجمة
        messages: [
          { role: "system", content: "Translate the following text to English. Output only the translation, no explanations." },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || text;
  } catch {
    return text; // في حال الفشل نرسل النص الأصلي
  }
}
// ============================================================
// AI Model Bridge (Random Forest)
// ============================================================
async function getRfAiScore(bio: string): Promise<{ status: number; confidence: number }> {
  try {
    const res = await fetch(RF_AI_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });
    if (!res.ok) throw new Error("RF Server Unreachable");
    return await res.json();
  } catch (err) {
    console.error("AI RF Bridge Error:", err);
    return { status: 1, confidence: 0.5 };
  }
}

// ============================================================
// Image Analyzer (من الكود الأول)
// ============================================================
async function analyzeImage(url: string, label: string) {
  try {
    const res = await fetch("http://127.0.0.1:5000/image-check", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, label }),
    });
    return await res.json();
  } catch (err: any) {
    return {
      authenticity: "uncertain",
      photoshop_detected: false,
      document_type: "other",
      matches_business: null,
      confidence: 0,
      description: "فشل تحليل الصورة",
      warnings: [err?.message || "IMAGE_ERROR"],
    };
  }
}

// ============================================================
// Types
// ============================================================
interface LinkAnalysisResult {
  reachable: boolean;
  title?: string;
  description?: string;
  contentSnippet?: string;
  relevanceHint?: string;
  platform?: string;
  error?: string;
}

const EMPTY_LINK: LinkAnalysisResult = { reachable: false, error: "لا يوجد رابط" };

// ============================================================
// Link Analysis
// ============================================================
async function analyzeLinkContent(url: string, accountType: string): Promise<LinkAnalysisResult> {
  if (!url || url === "غير موجود") return { ...EMPTY_LINK };

  let platform = "website";
  if (url.includes("instagram.com")) platform = "instagram";
  else if (url.includes("facebook.com") || url.includes("fb.com")) platform = "facebook";
  else if (url.includes("tiktok.com")) platform = "tiktok";
  else if (url.includes("twitter.com") || url.includes("x.com")) platform = "twitter/x";
  else if (url.includes("linkedin.com")) platform = "linkedin";
  else if (url.includes("youtube.com") || url.includes("youtu.be")) platform = "youtube";
  else if (url.includes("snapchat.com")) platform = "snapchat";
  else if (url.includes("wa.me") || url.includes("whatsapp")) platform = "whatsapp";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.9",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);

    if (!res.ok) return { reachable: false, platform, error: `HTTP ${res.status}` };

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { reachable: true, platform, relevanceHint: "محتوى غير نصي" };

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const contentSnippet = stripped.substring(0, 600);

    const accountKeywords: Record<string, string[]> = {
      merchant: ["متجر", "بيع", "بضاعة", "جملة", "تجارة"],
      delivery: ["توصيل", "شحن", "نقل"],
    };

    const keywords = accountKeywords[accountType] || [];
    const matched = keywords.filter((kw) => html.includes(kw));

    return {
      reachable: true,
      platform,
      title,
      contentSnippet,
      relevanceHint: matched.length > 0 ? `متوافق: ${matched.join("، ")}` : "لا يوجد تطابق كلمات مفتاحية",
    };
  } catch (err: any) {
    return { reachable: false, platform, error: err.message };
  }
}

// ============================================================
// Bio Analysis
// ============================================================
function analyzeBio(bio: string, accountType: string) {
  const words = bio.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const flags: string[] = [];
  if (wordCount < 5) flags.push("النبذة قصيرة جداً");

  const score = Math.min(100, (wordCount / 20) * 100);
  return { wordCount, score, flags, quality: score > 60 ? "good" : "weak" };
}

// ============================================================
// Main Handler
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { app } = await req.json();
    if (!app) return NextResponse.json({ error: "No data" }, { status: 400 });

    const basic = app.data_json?.basic || {};
    const proof = app.proof_json || {};
    const specific = app.data_json?.type_specific || {};
    const fileUrls: string[] = proof.file_urls || [];
//  استخراج الـ bio وترجمته فوراً قبل البدء بالتحليلات المتوازية
const userBio = basic.bio || "";
const translatedBio = await translateToEnglish(userBio);
    // ── تنفيذ كل التحليلات بالتوازي بما فيها RF و Vision ──
    const [link1Result, link2Result, bioAnalysis, rfAiResult, imageAnalyses] = await Promise.all([
      proof.proof_link_1
        ? analyzeLinkContent(proof.proof_link_1, app.account_type)
        : Promise.resolve<LinkAnalysisResult>({ ...EMPTY_LINK }),
      proof.proof_link_2
        ? analyzeLinkContent(proof.proof_link_2, app.account_type)
        : Promise.resolve<LinkAnalysisResult>({ ...EMPTY_LINK }),
      Promise.resolve(analyzeBio(basic.bio || "", app.account_type)),
      getRfAiScore(basic.bio || ""),
      Promise.all(
        fileUrls.map(async (url: string) => {
    try {
      // ✅ استخدم تحليل الصور من Groq (بدلاً من Python)
      return await groqAnalyzeImage(url, basic.full_name || app.account_type);
    } catch (err: any) {
      return {
        authenticity: "uncertain",
        photoshop_detected: false,
        document_type: "other",
        matches_business: null,
        confidence: 0,
        description: "فشل تحليل الصورة",
        warnings: [err?.message || "IMAGE_ERROR"],
      };
    }
  })
),
    ]);

    // ── Local Score ──
    const localScore = Math.round(
      bioAnalysis.score * 0.4 +
      (link1Result.reachable ? 40 : 0) +
      (rfAiResult.status === 1 ? 20 : 0)
    );

    // ── Image flags ──
    const imageFlags: string[] = [];
    imageAnalyses.forEach((img, idx) => {
      if (img?.authenticity === "fake") imageFlags.push(`الصورة ${idx + 1} تبدو مزورة`);
      if (img?.photoshop_detected) imageFlags.push(`الصورة ${idx + 1} تحتوي على تعديلات`);
      if (img?.matches_business === false) imageFlags.push(`الصورة ${idx + 1} لا تطابق نوع العمل`);
    });

    // ── Image Context للـ Prompt ──
    const imageContext =
      imageAnalyses.length > 0
        ? imageAnalyses
            .map(
              (img, idx) =>
                `الصورة ${idx + 1}: أصالة=${img?.authenticity}, فوتوشوب=${img?.photoshop_detected}, ثقة=${img?.confidence}%, وصف=${img?.description}`
            )
            .join("\n")
        : "لا توجد صور مرفوعة";

    // ── App Context ──
    const appContext = `
تحليل الطلب المتقدم:
- المتقدم: ${basic.full_name}
- نوع الحساب: ${accountTypeLabel[app.account_type] || app.account_type}
- الوصف الشخصي: ${basic.bio}
- الدولة: ${basic.country}
- نتيجة الموديل المدرب (Random Forest): ${rfAiResult.status === 1 ? "احترافي" : "مشبوه/غير مكتمل"} (ثقة: ${Math.round(rfAiResult.confidence * 100)}%)
- فحص الرابط الأول: ${link1Result.reachable ? "✅ متاح" : "❌ غير متاح"} — ${link1Result.relevanceHint || link1Result.error || ""}
- فحص الرابط الثاني: ${link2Result.reachable ? "✅ متاح" : "❌ غير متاح"} — ${link2Result.relevanceHint || link2Result.error || ""}
- تحليل النبذة: جودة=${bioAnalysis.quality}, نقاط=${bioAnalysis.score}/100
- تحليل الصور (Vision AI):
${imageContext}
- النقاط المحلية: ${localScore}/100
`;

    const systemPrompt = `أنت خبير مراجعة طلبات تسجيل في منصة تجارية. لديك نتائج من:
1. موديل Random Forest مدرب (ثقة: ${Math.round(rfAiResult.confidence * 100)}%)
2. فحص الروابط الفعلي
3. تحليل Vision AI للصور
4. تحليل النبذة

أجب فقط بـ JSON بدون أي نص خارجه:
{
  "score": <0-100>,
  "recommendation": "<approve|review|reject>",
  "risk": "<low|medium|high>",
  "summary": "<جملتان تلخصان الطلب>",
  "project_summary": "<اسم + نوع حساب + نشاط + دولة>",
  "bio_analysis": "<جملتان عن النبذة>",
  "link_analysis": "<جملتان عن الروابط>",
  "strengths": ["<نقطة قوة>"],
  "weaknesses": ["<نقطة ضعف>"],
  "flags": ["<علامة تستحق الانتباه>"],
  "decision_hint": "<جملة واحدة مباشرة للمدير>"
}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `حلّل هذا الطلب:\n${appContext}` },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      return NextResponse.json({ error: `Groq API error: ${errText}` }, { status: 500 });
    }

    const groqData = await groqResponse.json();
    const raw = groqData.choices?.[0]?.message?.content || "{}";
    const clean = raw.replace(/```json|```/g, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "Failed to parse Groq response", raw }, { status: 500 });
    }

    // التحقق من صحة القيم
    const validRec = ["approve", "reject", "review"];
    const validRisk = ["low", "medium", "high"];
    if (!validRec.includes(parsed.recommendation)) parsed.recommendation = "review";
    if (!validRisk.includes(parsed.risk)) parsed.risk = "medium";
    if (!Array.isArray(parsed.strengths)) parsed.strengths = [];
    if (!Array.isArray(parsed.weaknesses)) parsed.weaknesses = [];
    if (!Array.isArray(parsed.flags)) parsed.flags = [];

    return NextResponse.json({
      score: parsed.score ?? localScore,
      recommendation: parsed.recommendation,
      risk: parsed.risk,
      summary: parsed.summary ?? "—",
      project_summary: parsed.project_summary ?? `${basic.full_name} — ${accountTypeLabel[app.account_type]} — ${basic.country}`,
      bio_analysis: parsed.bio_analysis ?? "—",
      link_analysis: parsed.link_analysis ?? "—",
      strengths: parsed.strengths,
      weaknesses: parsed.weaknesses,
      flags: [...new Set([...(parsed.flags ?? []), ...imageFlags])],
      decision_hint: parsed.decision_hint ?? "—",
      rf_ai_status: rfAiResult.status,
      rf_ai_confidence: rfAiResult.confidence,
      local_score: localScore,
      image_analysis: imageAnalyses,
      _meta: {
        bioQuality: bioAnalysis.quality,
        bioScore: bioAnalysis.score,
        rfStatus: rfAiResult.status,
        rfConfidence: rfAiResult.confidence,
        link1: {
          url: proof.proof_link_1 ?? null,
          reachable: link1Result.reachable,
          platform: link1Result.platform,
          relevanceHint: link1Result.relevanceHint,
          error: link1Result.error,
        },
        link2: {
          url: proof.proof_link_2 ?? null,
          reachable: link2Result.reachable,
          platform: link2Result.platform,
          relevanceHint: link2Result.relevanceHint,
          error: link2Result.error,
        },
      },
    });
  } catch (err: any) {
    console.error("Evaluation error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}