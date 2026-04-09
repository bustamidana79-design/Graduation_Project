import { groq } from "./groq";
import fs from "fs";
import path from "path";

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

async function loadImageAsBase64(input: string): Promise<{ base64: string; mimeType: string }> {
  const isUrl = input.startsWith("http://") || input.startsWith("https://");

  if (isUrl) {
    console.log("Loading image from URL:", input);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    try {
      const res = await fetch(input, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);

      const contentType = res.headers.get("content-type") || "image/jpeg";
      const mimeType = contentType.split(";")[0].trim();
      console.log("Image mimeType:", mimeType);

      if (!["image/jpeg", "image/png", "image/webp", "image/jpg"].includes(mimeType)) {
        throw new Error(`Unsupported image type: ${mimeType}`);
      }

      const contentLength = res.headers.get("content-length");
      if (contentLength && parseInt(contentLength) > 8 * 1024 * 1024) {
        throw new Error("Image too large (max 8MB)");
      }

      const buffer = await res.arrayBuffer();
      const base64 = Buffer.from(buffer).toString("base64");
      console.log("Image loaded successfully, base64 length:", base64.length);
      return { base64, mimeType };
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    }
  } else {
    console.log("Loading image from file path:", input);
    const absolutePath = path.resolve(input);
    const ext = path.extname(input).toLowerCase();

    if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
      throw new Error("Unsupported image format");
    }

    const stats = fs.statSync(absolutePath);
    if (stats.size > 8 * 1024 * 1024) {
      throw new Error("Image too large (max 8MB)");
    }

    const imageBuffer = fs.readFileSync(absolutePath);
    const base64 = imageBuffer.toString("base64");
    const mimeType = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";

    return { base64, mimeType };
  }
}

function safeParseJSON(raw: string): ImageAnalysisResult | null {
  try {
    console.log("RAW AI RESPONSE (first 300 chars):", raw.substring(0, 300));
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}") + 1;
    if (jsonStart === -1 || jsonEnd === 0) throw new Error("No JSON object found");
    const cleaned = raw.slice(jsonStart, jsonEnd);
    return JSON.parse(cleaned);
  } catch (err) {
    console.error("safeParseJSON failed:", err);
    return null;
  }
}

function buildPrompt(businessName?: string): string {
  const businessContext = businessName
    ? `اسم العمل أو المشروع هو: "${businessName}". تحقق إذا الصورة تطابق هذا الاسم.`
    : "لا يوجد اسم عمل محدد للمقارنة.";

  return `أنت خبير في تحليل الصور وكشف التزوير. حلل الصورة المرفقة بدقة.

${businessContext}

**تعليمات مهمة جداً:**
- يجب أن يكون ردك بصيغة JSON صالحة فقط.
- لا تضع أي نص قبل JSON أو بعده.
- لا تستخدم علامات \`\`\`json أو أي تنسيق آخر.

أرجع JSON بهذا الشكل بالضبط:
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

async function mainAnalysis(
  base64Image: string,
  mimeType: string,
  businessName?: string
): Promise<ImageAnalysisResult | null> {
  try {
    console.log("Calling Groq vision model with llama-4-scout...");
    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct", // ✅ النموذج الجديد
      max_tokens: 1024,
      temperature: 0.2,
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
    console.log("Groq vision response received");
    return safeParseJSON(raw);
  } catch (err: any) {
    console.error("mainAnalysis GROQ error:", err?.message || err);
    return null;
  }
}

async function secondaryAnalysis(
  description: string,
  businessName?: string
): Promise<{ confidence: number } | null> {
  try {
    const prompt = `بناءً على هذا الوصف للصورة:
"${description}"
${businessName ? `واسم العمل: "${businessName}"` : ""}

قيّم مدى موثوقية الصورة من 0 إلى 100.
أرجع JSON فقط: { "confidence": <رقم> }`;

    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      max_tokens: 100,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = response.choices[0].message.content || "";
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (err: any) {
    console.error("secondaryAnalysis error:", err?.message || err);
    return null;
  }
}

export async function analyzeImage(
  input: string,
  businessName?: string
): Promise<ImageAnalysisResult> {
  console.log("analyzeImage called with:", input);
  try {
    const { base64, mimeType } = await loadImageAsBase64(input);
    const mainResult = await mainAnalysis(base64, mimeType, businessName);

    if (!mainResult) {
      console.warn("mainAnalysis returned null, using FALLBACK");
      return FALLBACK_RESULT;
    }

    const secondary = await secondaryAnalysis(mainResult.description, businessName);

    const finalConfidence = secondary
      ? Math.round(mainResult.confidence * 0.7 + secondary.confidence * 0.3)
      : mainResult.confidence;

    return { ...mainResult, confidence: finalConfidence };
  } catch (error: any) {
    console.error("analyzeImage error:", error?.message || error);
    return {
      ...FALLBACK_RESULT,
      warnings: [error?.message || "UNKNOWN_ERROR"],
    };
  }
}