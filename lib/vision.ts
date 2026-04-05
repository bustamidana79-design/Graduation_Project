import Groq from "groq-sdk";
import fs from "fs";
import path from "path";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

type ImageAnalysisResult = {
  authenticity: "real" | "fake" | "uncertain";
  photoshop_detected: boolean;
  document_type: "official" | "personal" | "logo" | "product" | "other";
  matches_business: boolean | null;
  confidence: number;
  description: string;
  warnings: string[];
};

const FALLBACK_RESULT: ImageAnalysisResult = {
  authenticity: "uncertain",
  photoshop_detected: false,
  document_type: "other",
  matches_business: null,
  confidence: 40,
  description: "تعذر تحليل JSON الراجع من الذكاء الاصطناعي",
  warnings: ["JSON_PARSE_ERROR"],
};

// ========== Helper: Parse JSON safely ==========
function safeParseJSON(raw: string): ImageAnalysisResult | null {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ========== Helper: Build prompt ==========
function buildPrompt(businessName?: string): string {
  const businessContext = businessName
    ? `اسم العمل أو المشروع هو: "${businessName}". تحقق إذا الصورة بتطابق هاد الاسم.`
    : "لا يوجد اسم عمل محدد للمقارنة.";

  return `أنت خبير في تحليل الصور وكشف التزوير. حلل الصورة المرفقة بدقة.

${businessContext}

أرجع JSON فقط بدون أي نص إضافي أو backticks بهاد الشكل بالضبط:
{
  "authenticity": "real أو fake أو uncertain",
  "photoshop_detected": true أو false,
  "document_type": "official أو personal أو logo أو product أو other",
  "matches_business": true أو false أو null,
  "confidence": رقم من 0 إلى 100,
  "description": "وصف مختصر لمحتوى الصورة",
  "warnings": ["أي تحذيرات أو ملاحظات مهمة"]
}`;
}

// ========== Pass 1: Main Vision Model ==========
async function mainAnalysis(
  base64Image: string,
  mimeType: string,
  businessName?: string
): Promise<ImageAnalysisResult | null> {
  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.2-11b-vision-preview",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(businessName) },
            {
              type: "image_url",
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0].message.content || "";
    return safeParseJSON(raw);
  } catch {
    return null;
  }
}

// ========== Pass 2: Secondary Text Model ==========
async function secondaryAnalysis(
  description: string,
  businessName?: string
): Promise<{ confidence: number } | null> {
  try {
    const prompt = `بناءً على هاد الوصف للصورة:
"${description}"
${businessName ? `واسم العمل: "${businessName}"` : ""}

قيّم مدى موثوقية الصورة من 0 إلى 100.
أرجع JSON فقط: { "confidence": <رقم> }`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 100,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ========== Main Export ==========
export async function analyzeImage(
  filePath: string,
  businessName?: string
): Promise<ImageAnalysisResult> {
  try {
    const absolutePath = path.resolve(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // ✅ Check file type
    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      throw new Error("Unsupported image format");
    }

    // ✅ Check file size (max 8MB)
    const stats = fs.statSync(absolutePath);
    if (stats.size > 8 * 1024 * 1024) {
      throw new Error("Image too large (max 8MB)");
    }

    // قراءة الصورة
    const imageBuffer = fs.readFileSync(absolutePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType =
      ext === ".png" ? "image/png" :
      ext === ".webp" ? "image/webp" :
      "image/jpeg";

    // ✅ Pass 1: Main vision analysis
    const mainResult = await mainAnalysis(base64Image, mimeType, businessName);

    // ✅ JSON Guard
    if (!mainResult) {
      return FALLBACK_RESULT;
    }

    // ✅ Pass 2: Secondary confidence check
    const secondary = await secondaryAnalysis(mainResult.description, businessName);

    // ✅ Merge confidence: 70% main + 30% secondary
    const finalConfidence = secondary
      ? Math.round(mainResult.confidence * 0.7 + secondary.confidence * 0.3)
      : mainResult.confidence;

    return {
      ...mainResult,
      confidence: finalConfidence,
    };
  } catch (error: any) {
    console.error("analyzeImage error:", error?.message || error);
    return {
      ...FALLBACK_RESULT,
      warnings: [error?.message || "UNKNOWN_ERROR"],
    };
  }
}