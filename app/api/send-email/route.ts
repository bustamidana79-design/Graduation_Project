import { NextRequest, NextResponse } from "next/server";
import { analyzeImage as groqAnalyzeImage } from "@/lib/vision";

// إعدادات الروابط والمفاتيح البرمجية
const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const RF_AI_SERVER_URL = "http://127.0.0.1:5000/predict";

const accountTypeLabel: Record<string, string> = {
  merchant: "تاجر (جملة)",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};

// 1. دالة الترجمة إلى الإنجليزية (مصححة الـ Backticks لإزالة الـ Warning الأصفر)
async function translateToEnglish(text: string): Promise<string> {
  if (!text || text.trim() === "") return "";
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: "Translate the following text to English. Output only the translation." },
          { role: "user", content: text },
        ],
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || text;
  } catch (err) {
    console.error("Translation Error:", err);
    return text; // العودة للنص الأصلي في حال الفشل
  }
}

// 2. دالة استدعاء موديل الـ Random Forest (تدعم الـ 506 أعمدة)
async function getRfAiScore(features: any): Promise<{ status: number; confidence: number }> {
  try {
    const res = await fetch(RF_AI_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    });
    if (!res.ok) throw new Error("RF Server Unreachable");
    return await res.json();
  } catch (err) {
    console.error("AI RF Bridge Error:", err);
    return { status: 1, confidence: 0.5 }; // قيمة افتراضية عند الفشل
  }
}

// 3. تحليل الروابط (Link Analysis)
interface LinkAnalysisResult {
  reachable: boolean;
  platform?: string;
  error?: string;
}

const EMPTY_LINK: LinkAnalysisResult = { reachable: false };

async function analyzeLinkContent(url: string): Promise<LinkAnalysisResult> {
  if (!url || url === "غير موجود") return { ...EMPTY_LINK };
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal, method: "HEAD" });
    clearTimeout(id);
    return { 
        reachable: res.ok, 
        platform: url.includes("linkedin") ? "linkedin" : "website" 
    };
  } catch {
    return { reachable: false };
  }
}

// 4. تحليل النبذة محلياً (Bio Analysis)
function analyzeBioLocal(bio: string) {
  const words = bio.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const score = Math.min(100, (wordCount / 20) * 100);
  return { wordCount, score, quality: score > 60 ? "good" : "weak" };
}

// 5. المعالج الرئيسي (Main Handler)
export async function POST(req: NextRequest) {
  try {
    const { app } = await req.json();
    if (!app) return NextResponse.json({ error: "No data" }, { status: 400 });

    const basic = app.data_json?.basic || {};
    const proof = app.proof_json || {};
    const fileUrls: string[] = proof.file_urls || [];

    // أ- استخراج الـ bio وترجمته فوراً
    const userBio = basic.bio || "";
    const translatedBio = await translateToEnglish(userBio);

    // ب- تجهيز الميزات الـ 6 السلوكية (لإكمال الـ 506 عمود المطلوبة للموديل)
    const rfFeatures = {
      bio: translatedBio,
      link_reachable: (proof.proof_link_1 || proof.proof_link_2) ? 1 : 0,
      platform_score: (proof.proof_link_1?.includes("linkedin") || proof.proof_link_2?.includes("linkedin")) ? 1 : 0.5,
      has_files: fileUrls.length > 0 ? 1 : 0,
      fields_complete: (basic.full_name && userBio.length > 20) ? 1 : 0,
      has_second_link: (proof.proof_link_1 && proof.proof_link_2) ? 1 : 0,
      bio_word_count: userBio.trim().split(/\s+/).length
    };

    // ج- تنفيذ التحليلات بالتوازي لزيادة السرعة
    const [link1Result, link2Result, bioAnalysis, rfAiResult, imageAnalyses] = await Promise.all([
      analyzeLinkContent(proof.proof_link_1),
      analyzeLinkContent(proof.proof_link_2),
      Promise.resolve(analyzeBioLocal(userBio)),
      getRfAiScore(rfFeatures),
      Promise.all(fileUrls.map(url => groqAnalyzeImage(url, basic.full_name || "Unknown")))
    ]);

    // د- حساب السكور المحلي بناءً على معطيات الموديل الجديد
    const localScore = Math.round(
      bioAnalysis.score * 0.3 + 
      (link1Result.reachable ? 30 : 0) + 
      (rfAiResult.status === 1 ? 40 : 0)
    );

    // هـ- بناء السياق النهائي لـ Llama (مصحح الـ Backticks)
    const imageContext = imageAnalyses.length > 0
      ? imageAnalyses.map((img: any, idx) => 
          `الصورة ${idx + 1}: أصالة=${img?.authenticity}, تعديل=${img?.photoshop_detected}, وصف=${img?.description}`
        ).join("\n")
      : "لا توجد صور مرفوعة";

    const appContext = `
تحليل طلب التسجيل:
- المتقدم: ${basic.full_name}
- نوع الحساب: ${accountTypeLabel[app.account_type] || app.account_type}
- النبذة الأصلية: ${userBio}
- نتيجة الذكاء الاصطناعي (RF): ${rfAiResult.status === 1 ? "احترافي" : "مشبوه"} (ثقة: ${Math.round(rfAiResult.confidence * 100)}%)
- فحص الروابط: ${link1Result.reachable ? "الرابط 1 متاح" : "الرابط 1 معطل"}
- النقاط المحلية: ${localScore}/100
- تحليل الصور: ${imageContext}
`;

    // و- طلب التقييم النهائي من Groq بصيغة JSON
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        messages: [
          { role: "system", content: "أنت خبير تقييم منصات تجارية. أجب بصيغة JSON فقط." },
          { role: "user", content: `حلل هذا الطلب وقدم تقريراً مفصلاً:\n${appContext}` },
        ],
      }),
    });

    const groqData = await groqResponse.json();
    const cleanContent = groqData.choices[0].message.content.replace(/```json|```/g, "").trim();
    
    return NextResponse.json({
      ...JSON.parse(cleanContent),
      rf_ai_confidence: rfAiResult.confidence,
      local_score: localScore
    });

  } catch (err: any) {
    console.error("Evaluation error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}