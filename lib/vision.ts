import { groq } from "./groq";
import fs from "fs";
import path from "path";

type ImageAnalysisResult = {
  authenticity: "real" | "fake" | "uncertain";
  photoshop_detected: boolean;
  document_type: "official" | "personal" | "logo" | "product" | "other";
  matches_business: boolean | null;
  matches_project: boolean | null;
  confidence: number;
  description: string;
  business_type: string;
  main_objects: string[];
  extracted_text: string[];
  professionalism_score: number;
  quality_score: number;
  explanation: string;
  warnings: string[];
};

const FALLBACK_RESULT: ImageAnalysisResult = {
  authenticity: "uncertain",
  photoshop_detected: false,
  document_type: "other",
  matches_business: null,
  matches_project: null,
  confidence: 40,
  description: "تعذر تحليل JSON الراجع من الذكاء الاصطناعي",
  business_type: "غير محدد",
  main_objects: [],
  extracted_text: [],
  professionalism_score: 0,
  quality_score: 0,
  explanation: "لم يتمكن نموذج الرؤية من إرجاع تقرير منظم يمكن الاعتماد عليه.",
  warnings: ["JSON_PARSE_ERROR"],
};

type ImageAnalysisContext =
  | string
  | {
      businessName?: string;
      projectDescription?: string;
      selectedCategory?: string;
      accountType?: string;
    };

function normalizeContext(context?: ImageAnalysisContext) {
  if (typeof context === "string") {
    return {
      businessName: context,
      projectDescription: "",
      selectedCategory: "",
      accountType: "",
    };
  }

  return {
    businessName: context?.businessName || "",
    projectDescription: context?.projectDescription || "",
    selectedCategory: context?.selectedCategory || "",
    accountType: context?.accountType || "",
  };
}

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

function normalizeScore(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const score = numeric <= 1 && numeric >= 0 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean).slice(0, 8);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["yes", "true", "matched", "match", "نعم", "متطابق"].includes(normalized)) return true;
  if (["no", "false", "not matched", "mismatch", "لا", "غير متطابق"].includes(normalized)) return false;
  return null;
}

function normalizeImageReport(parsed: Partial<ImageAnalysisResult>): ImageAnalysisResult {
  const matchesProject = normalizeBoolean(parsed.matches_project);
  const matchesBusiness = normalizeBoolean(parsed.matches_business);

  return {
    authenticity: ["real", "fake", "uncertain"].includes(String(parsed.authenticity))
      ? (parsed.authenticity as ImageAnalysisResult["authenticity"])
      : "uncertain",
    photoshop_detected: Boolean(parsed.photoshop_detected),
    document_type: ["official", "personal", "logo", "product", "other"].includes(String(parsed.document_type))
      ? (parsed.document_type as ImageAnalysisResult["document_type"])
      : "other",
    matches_business: matchesBusiness ?? matchesProject,
    matches_project: matchesProject ?? matchesBusiness,
    confidence: normalizeScore(parsed.confidence, 40),
    description: String(parsed.description || "لا يوجد وصف واضح للصورة.").trim(),
    business_type: String(parsed.business_type || "غير محدد").trim(),
    main_objects: normalizeStringList(parsed.main_objects),
    extracted_text: normalizeStringList(parsed.extracted_text),
    professionalism_score: normalizeScore(parsed.professionalism_score, 0),
    quality_score: normalizeScore(parsed.quality_score, normalizeScore(parsed.professionalism_score, 0)),
    explanation: String(parsed.explanation || "").trim(),
    warnings: normalizeStringList(parsed.warnings),
  };
}

function safeParseJSON(raw: string): ImageAnalysisResult | null {
  try {
    console.log("RAW AI RESPONSE (first 300 chars):", raw.substring(0, 300));
    const jsonStart = raw.indexOf("{");
    const jsonEnd = raw.lastIndexOf("}") + 1;
    if (jsonStart === -1 || jsonEnd === 0) throw new Error("No JSON object found");
    const cleaned = raw.slice(jsonStart, jsonEnd);
    return normalizeImageReport(JSON.parse(cleaned));
  } catch (err) {
    console.error("safeParseJSON failed:", err);
    return null;
  }
}

function buildPrompt(context?: ImageAnalysisContext): string {
  const { businessName, projectDescription, selectedCategory, accountType } = normalizeContext(context);
  const businessContext = [
    businessName ? `اسم العمل أو المشروع: "${businessName}".` : "",
    selectedCategory ? `الفئة أو المجال المختار: "${selectedCategory}".` : "",
    accountType ? `نوع الحساب: "${accountType}".` : "",
    projectDescription ? `وصف/نبذة المشروع: "${projectDescription}".` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return `أنت خبير في تحليل صور الأنشطة التجارية وطلبات التسجيل. حلل الصورة المرفقة بدقة وقارنها ببيانات المشروع.

${businessContext || "لا توجد بيانات مشروع كافية للمقارنة، اعتمد على محتوى الصورة فقط."}

**تعليمات مهمة جداً:**
- يجب أن يكون ردك بصيغة JSON صالحة فقط.
- لا تضع أي نص قبل JSON أو بعده.
- لا تستخدم علامات \`\`\`json أو أي تنسيق آخر.
- اكتب الوصف والشرح بالعربية قدر الإمكان.
- إذا لم تستطع قراءة نص ظاهر في الصورة، اجعل extracted_text مصفوفة فارغة.
- matches_project يعني: هل محتوى الصورة منطقي ومتوافق مع الفئة/الوصف/نوع الحساب المقدم؟

أرجع JSON بهذا الشكل بالضبط:
{
  "description": "وصف مختصر لمحتوى الصورة",
  "business_type": "نوع النشاط الظاهر مثل: مقهى، متجر ملابس، إلكترونيات، شعار، وثيقة، منتجات، غير واضح",
  "main_objects": ["أهم العناصر الظاهرة"],
  "extracted_text": ["أي كلمات أو علامات أو أسماء مقروءة"],
  "professionalism_score": رقم من 0 إلى 100,
  "quality_score": رقم من 0 إلى 100,
  "matches_project": true أو false أو null,
  "matches_business": true أو false أو null,
  "explanation": "سبب مختصر لنتيجة المطابقة والاحترافية",
  "authenticity": "real أو fake أو uncertain",
  "photoshop_detected": true أو false,
  "document_type": "official أو personal أو logo أو product أو other",
  "confidence": رقم من 0 إلى 100,
  "warnings": ["أي تحذيرات أو ملاحظات مهمة"]
}`;
}

async function mainAnalysis(
  base64Image: string,
  mimeType: string,
  context?: ImageAnalysisContext
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
            { type: "text", text: buildPrompt(context) },
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
  context?: ImageAnalysisContext
): Promise<{ confidence: number } | null> {
  try {
    const { businessName, selectedCategory } = normalizeContext(context);
    const prompt = `بناءً على هذا الوصف للصورة:
"${description}"
${businessName ? `واسم العمل: "${businessName}"` : ""}
${selectedCategory ? `والفئة المختارة: "${selectedCategory}"` : ""}

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
  context?: ImageAnalysisContext
): Promise<ImageAnalysisResult> {
  console.log("analyzeImage called with:", input);
  try {
    const { base64, mimeType } = await loadImageAsBase64(input);
    const mainResult = await mainAnalysis(base64, mimeType, context);

    if (!mainResult) {
      console.warn("mainAnalysis returned null, using FALLBACK");
      return FALLBACK_RESULT;
    }

    const secondary = await secondaryAnalysis(mainResult.description, context);

    const finalConfidence = secondary
      ? Math.round(mainResult.confidence * 0.7 + secondary.confidence * 0.3)
      : mainResult.confidence;

    return normalizeImageReport({ ...mainResult, confidence: finalConfidence });
  } catch (error: any) {
    console.error("analyzeImage error:", error?.message || error);
    return {
      ...FALLBACK_RESULT,
      warnings: [error?.message || "UNKNOWN_ERROR"],
    };
  }
}
