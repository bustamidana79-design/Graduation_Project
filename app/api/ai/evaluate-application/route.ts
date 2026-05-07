import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { analyzeImage } from "@/lib/vision";

const AI_SERVER_URL = process.env.AI_MODEL_API_URL || "http://127.0.0.1:8000/predict";

type LinkAnalysisResult = {
  reachable: boolean;
  platform?: string;
  relevanceHint?: string;
  relevanceScore?: number;
  relevanceStatus?: "matched" | "weak" | "unknown";
  pageTitle?: string;
  pageDescription?: string;
  error?: string;
};

type PythonAiResponse = {
  decision: "approve" | "reject" | "review";
  score: number;
  confidence: number;
  reasons: string[];
  source?: "random_forest" | "fallback";
};

type ImageAnalysisResult = {
  authenticity: string;
  photoshop_detected: boolean;
  document_type: string;
  matches_business?: boolean | null;
  confidence: number;
  description: string;
  warnings?: string[];
};

type ApplicationPayload = {
  id?: string;
  account_type?: string;
  data_json?: {
    basic?: {
      full_name?: string;
      bio?: string;
      email?: string;
    };
    type_specific?: Record<string, unknown>;
  };
  proof_json?: {
    proof_link_1?: string;
    proof_link_2?: string;
    file_urls?: string[];
  };
};

type AIReport = {
  score: number;
  recommendation: "approve" | "reject" | "review";
  risk: "low" | "medium" | "high";
  summary: string;
  project_summary?: string;
  details: string;
  bio_analysis?: string;
  link_analysis?: string;
  strengths: string[];
  weaknesses: string[];
  flags: string[];
  decision_hint: string;
  local_score?: number;
  reasons: string[];
  _meta?: {
    aiSource?: "random_forest" | "fallback";
    bioQuality: "good" | "weak" | "suspicious";
    bioScore: number;
    link1: {
      url: string | null;
      reachable: boolean;
      platform?: string;
      relevanceHint?: string;
      relevanceScore?: number;
      relevanceStatus?: "matched" | "weak" | "unknown";
      pageTitle?: string;
      pageDescription?: string;
      error?: string;
    };
    link2: {
      url: string | null;
      reachable: boolean;
      platform?: string;
      relevanceHint?: string;
      relevanceScore?: number;
      relevanceStatus?: "matched" | "weak" | "unknown";
      pageTitle?: string;
      pageDescription?: string;
      error?: string;
    };
  };
  image_analysis?: ImageAnalysisResult[];
};

const EMPTY_LINK: LinkAnalysisResult = {
  reachable: false,
  error: "لم يتم توفير رابط",
};

const DECISION_LABELS: Record<AIReport["recommendation"], string> = {
  approve: "قبول",
  reject: "رفض",
  review: "مراجعة",
};

function detectPlatform(url: string): string {
  const normalized = url.toLowerCase();
  if (normalized.includes("instagram.com")) return "Instagram";
  if (normalized.includes("facebook.com") || normalized.includes("fb.com")) return "Facebook";
  if (normalized.includes("tiktok.com")) return "TikTok";
  if (normalized.includes("twitter.com") || normalized.includes("x.com")) return "X";
  if (normalized.includes("linkedin.com")) return "LinkedIn";
  if (normalized.includes("youtube.com") || normalized.includes("youtu.be")) return "YouTube";
  if (normalized.includes("snapchat.com")) return "Snapchat";
  if (normalized.includes("wa.me") || normalized.includes("whatsapp")) return "WhatsApp";
  return "Website";
}

function translateReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("bio too short")) return "النبذة قصيرة جدًا ولا تعطي صورة كافية عن النشاط.";
  if (normalized.includes("no links provided")) return "لا توجد روابط داعمة لإثبات النشاط.";
  if (normalized.includes("email domain does not match")) return "دومين البريد لا يبدو متوافقًا مع الروابط المرفقة.";
  if (normalized.includes("suspicious email")) return "صيغة البريد الإلكتروني تبدو غير موثوقة.";
  if (normalized.includes("project or store description is limited"))
    return "وصف المشروع أو المتجر محدود جدًا.";
  if (normalized.includes("bio and business description look sufficiently detailed"))
    return "النبذة ووصف النشاط يحتويان على تفاصيل مقنعة مبدئيًا.";
  if (normalized.includes("mixed signals require manual review"))
    return "الإشارات الحالية متضاربة وتحتاج مراجعة بشرية.";
  if (normalized.includes("uploaded images may be manipulated"))
    return "بعض الصور المرفوعة قد تحتوي على تعديل أو تلاعب.";
  if (normalized.includes("image analysis failed")) return "تعذر تحليل الصورة المرفوعة.";
  if (normalized.includes("http ")) return `تعذر الوصول إلى الرابط (${reason}).`;
  if (normalized.includes("link validation failed")) return "فشل التحقق من الرابط المرفق.";
  return reason;
}

function containsArabic(text: string) {
  return /[\u0600-\u06FF]/.test(text);
}

function looksMostlyEnglish(text: string) {
  return /[A-Za-z]/.test(text) && !containsArabic(text);
}

function localizeLooseText(text: string) {
  if (!text) return text;

  const normalized = text.trim();
  const mapped = translateReason(normalized);
  if (mapped !== normalized) return mapped;

  const lower = normalized.toLowerCase();
  if (lower === "uncertain") return "غير مؤكد";
  if (lower === "other") return "أخرى";
  if (lower === "website") return "موقع إلكتروني";
  if (lower === "instagram") return "إنستغرام";
  if (lower === "facebook") return "فيسبوك";
  if (lower === "linkedin") return "لينكدإن";
  if (lower === "youtube") return "يوتيوب";
  if (lower === "tiktok") return "تيك توك";
  if (lower === "snapchat") return "سناب شات";
  if (lower === "whatsapp") return "واتساب";
  if (lower === "x") return "إكس";
  if (lower.startsWith("reachable ")) return normalized.replace(/^Reachable\s+/i, "تم الوصول إلى ");
  if (lower.startsWith("ai model request failed")) return "تعذر الاتصال بخدمة التحليل الذكية.";
  if (lower.startsWith("python ai service unavailable")) return "خدمة التحليل الخارجية غير متاحة حاليًا.";
  if (looksMostlyEnglish(normalized)) return `نص بحاجة لترجمة: ${normalized}`;
  return normalized;
}

function normalizeArabicReport(report: AIReport): AIReport {
  return {
    ...report,
    summary: localizeLooseText(report.summary),
    project_summary: report.project_summary ? localizeLooseText(report.project_summary) : report.project_summary,
    details: localizeLooseText(report.details),
    bio_analysis: report.bio_analysis ? localizeLooseText(report.bio_analysis) : report.bio_analysis,
    link_analysis: report.link_analysis ? localizeLooseText(report.link_analysis) : report.link_analysis,
    strengths: report.strengths.map(localizeLooseText),
    weaknesses: report.weaknesses.map(localizeLooseText),
    flags: report.flags.map(localizeLooseText),
    decision_hint: localizeLooseText(report.decision_hint),
    reasons: report.reasons.map(localizeLooseText),
    _meta: report._meta
      ? {
          ...report._meta,
          link1: {
            ...report._meta.link1,
            platform: report._meta.link1.platform ? localizeLooseText(report._meta.link1.platform) : report._meta.link1.platform,
            relevanceHint: report._meta.link1.relevanceHint
              ? localizeLooseText(report._meta.link1.relevanceHint)
              : report._meta.link1.relevanceHint,
            error: report._meta.link1.error ? localizeLooseText(report._meta.link1.error) : report._meta.link1.error,
          },
          link2: {
            ...report._meta.link2,
            platform: report._meta.link2.platform ? localizeLooseText(report._meta.link2.platform) : report._meta.link2.platform,
            relevanceHint: report._meta.link2.relevanceHint
              ? localizeLooseText(report._meta.link2.relevanceHint)
              : report._meta.link2.relevanceHint,
            error: report._meta.link2.error ? localizeLooseText(report._meta.link2.error) : report._meta.link2.error,
          },
        }
      : report._meta,
    image_analysis: report.image_analysis?.map((image) => ({
      ...image,
      authenticity: localizeLooseText(image.authenticity),
      document_type: localizeLooseText(image.document_type),
      description: localizeLooseText(image.description),
      warnings: image.warnings?.map(localizeLooseText),
    })),
  };
}

function parseGroqJson(raw: string) {
  const cleaned = raw.trim().replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
  return JSON.parse(cleaned);
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function extractMetaContent(html: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtmlEntities(match[1]);
  }

  return "";
}

function extractPageText(html: string) {
  const title = decodeHtmlEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const description =
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description") ||
    extractMetaContent(html, "twitter:description");
  const ogTitle = extractMetaContent(html, "og:title") || extractMetaContent(html, "twitter:title");
  const bodyText = decodeHtmlEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .slice(0, 6000)
  );

  return {
    title: ogTitle || title,
    description,
    content: [ogTitle, title, description, bodyText].filter(Boolean).join(" "),
  };
}

function tokenizeForRelevance(text: string) {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "http",
    "https",
    "www",
    "com",
    "من",
    "في",
    "على",
    "عن",
    "الى",
    "إلى",
    "هذا",
    "هذه",
    "ذلك",
    "التي",
    "الذي",
    "او",
    "أو",
    "و",
  ]);

  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[\p{L}\p{N}]+/gu)
        ?.filter((token) => token.length > 2 && !stopWords.has(token)) || []
    )
  );
}

function scoreLinkRelevance(params: {
  url: string;
  pageText: string;
  fullName: string;
  bio: string;
  description: string;
}): { score: number; matchedTokens: string[]; status: "matched" | "weak" | "unknown" } {
  const claimTokens = tokenizeForRelevance(`${params.fullName} ${params.bio} ${params.description}`).slice(0, 60);
  const pageTokens = new Set(tokenizeForRelevance(`${params.url} ${params.pageText}`).slice(0, 250));

  if (claimTokens.length === 0 || pageTokens.size === 0) {
    return { score: 0, matchedTokens: [] as string[], status: "unknown" as const };
  }

  const matchedTokens = claimTokens.filter((token) => pageTokens.has(token));
  const score = Math.round((matchedTokens.length / Math.min(claimTokens.length, 12)) * 100);
  const status = score >= 25 || matchedTokens.length >= 3 ? "matched" : "weak";

  return { score: Math.min(score, 100), matchedTokens: matchedTokens.slice(0, 6), status };
}

async function analyzeLink(
  url?: string | null,
  context?: { fullName: string; bio: string; description: string }
): Promise<LinkAnalysisResult> {
  if (!url) return { ...EMPTY_LINK };

  const platform = detectPlatform(url);

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return { reachable: false, platform, error: `HTTP ${response.status}` };
    }

    return {
      reachable: true,
      platform,
      relevanceHint: `تم الوصول إلى رابط إثبات على ${platform}`,
    };
  } catch (error) {
    return {
      reachable: false,
      platform,
      error: error instanceof Error ? error.message : "فشل التحقق من الرابط",
    };
  }
}

async function analyzeRelevantLink(
  url?: string | null,
  context?: { fullName: string; bio: string; description: string }
): Promise<LinkAnalysisResult> {
  if (!url) return { ...EMPTY_LINK };

  const baseResult = await analyzeLink(url, context);
  if (!baseResult.reachable) return baseResult;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return baseResult;

    const html = await response.text();
    const page = extractPageText(html);
    const relevance = context
      ? scoreLinkRelevance({
          url,
          pageText: page.content,
          fullName: context.fullName,
          bio: context.bio,
          description: context.description,
        })
      : { score: 0, matchedTokens: [] as string[], status: "unknown" as const };

    const relevanceHint =
      relevance.status === "matched"
        ? `تم الوصول إلى الرابط على ${baseResult.platform} وظهر تطابق مع وصف النشاط (${relevance.matchedTokens.join("، ")}).`
        : relevance.status === "weak"
          ? `تم الوصول إلى الرابط على ${baseResult.platform} لكن لم يظهر تطابق كاف مع وصف النشاط.`
          : `تم الوصول إلى الرابط على ${baseResult.platform} لكن لا توجد معلومات كافية للتحقق من مطابقته للنشاط.`;

    return {
      ...baseResult,
      relevanceHint,
      relevanceScore: relevance.score,
      relevanceStatus: relevance.status,
      pageTitle: page.title || undefined,
      pageDescription: page.description || undefined,
    };
  } catch {
    return {
      ...baseResult,
      relevanceStatus: "unknown",
      relevanceScore: 0,
    };
  }
}

function normalizeImageError(error: unknown): ImageAnalysisResult {
  return {
    authenticity: "uncertain",
    photoshop_detected: false,
    document_type: "other",
    matches_business: null,
    confidence: 0,
    description: "تعذر تحليل الصورة",
    warnings: [error instanceof Error ? error.message : "IMAGE_ERROR"],
  };
}

function collectDescription(accountType: string, typeSpecific: Record<string, unknown>) {
  const keyMap: Record<string, string[]> = {
    merchant: ["store_name", "product_category"],
    small_business: ["project_name", "project_field", "project_stage"],
    delivery: ["company_name", "delivery_scope", "avg_delivery_time"],
    supporter: ["support_type", "interests", "previous_experience"],
  };

  return (keyMap[accountType] || [])
    .map((key) => {
      const value = typeSpecific[key];
      if (Array.isArray(value)) return value.join(" ");
      return typeof value === "string" ? value : "";
    })
    .filter(Boolean)
    .join(" ");
}

async function getPythonDecision(payload: {
  bio: string;
  email: string;
  links: string[];
  account_type: string;
  full_name: string;
  description: string;
}): Promise<PythonAiResponse> {
  try {
    const response = await fetch(AI_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI model request failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as PythonAiResponse;
    console.log("AI Source = random_forest");
    return { ...result, source: "random_forest" };
  } catch (error) {
    console.error("Python AI service unavailable; fallback is disabled.", error);
    throw error;
  }
}

function buildDecisionHint(recommendation: AIReport["recommendation"]) {
  if (recommendation === "approve") return "يمكن اعتماد الطلب مبدئيًا ما لم تظهر ملاحظات يدوية معاكسة.";
  if (recommendation === "reject") return "يفضل رفض الطلب ما لم تتوفر أدلة خارجية قوية تعالج نقاط الشك.";
  return "يفضل إبقاء الطلب للمراجعة اليدوية قبل اتخاذ القرار النهائي.";
}

function buildArabicFallbackReport(params: {
  app: ApplicationPayload;
  python: PythonAiResponse;
  bioWordCount: number;
  link1Result: LinkAnalysisResult;
  link2Result: LinkAnalysisResult;
  imageAnalyses: ImageAnalysisResult[];
}): AIReport {
  const { app, python, bioWordCount, link1Result, link2Result, imageAnalyses } = params;
  const proof = app.proof_json || {};
  const reachableLinks = [link1Result, link2Result].filter((item) => item.reachable).length;
  const baseScore = Math.round(python.score * 100);
  const adjustedScore = Math.max(
    0,
    Math.min(100, baseScore + (reachableLinks > 0 ? 6 : -8) + (bioWordCount >= 20 ? 4 : -6))
  );

  const recommendation = python.decision;
  const risk: AIReport["risk"] =
    recommendation === "reject" ? "high" : recommendation === "approve" ? "low" : "medium";

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const flags = python.reasons.map(translateReason);

  if (bioWordCount >= 20) strengths.push("النبذة تحتوي على قدر جيد من التفاصيل الأولية.");
  else weaknesses.push("النبذة قصيرة ولا توضح النشاط بشكل كاف.");

  if (reachableLinks > 0) strengths.push("يوجد رابط إثبات واحد على الأقل يمكن الوصول إليه.");
  else weaknesses.push("لم يتم العثور على رابط إثبات صالح يمكن الوصول إليه.");

  const matchedLinks = [link1Result, link2Result].filter((item) => item.relevanceStatus === "matched").length;
  const weakLinks = [link1Result, link2Result].filter((item) => item.relevanceStatus === "weak").length;

  if (matchedLinks > 0) strengths.push("رابط الإثبات يحتوي على مؤشرات مرتبطة بوصف النشاط المقدم.");
  if (weakLinks > 0) weaknesses.push("يوجد رابط إثبات يعمل، لكن محتواه لا يطابق وصف النشاط بشكل كاف.");

  if (python.reasons.some((reason) => reason.includes("suspicious email"))) {
    weaknesses.push("صيغة البريد الإلكتروني تثير الشك.");
  }

  if (imageAnalyses.some((img) => img.authenticity === "fake" || img.photoshop_detected)) {
    flags.push("بعض الصور المرفوعة تبدو غير موثوقة أو معدلة.");
  }

  const bioQuality: NonNullable<AIReport["_meta"]>["bioQuality"] =
    bioWordCount >= 20 ? "good" : bioWordCount >= 8 ? "weak" : "suspicious";
  const bioScore = Math.max(0, Math.min(100, Math.round((bioWordCount / 30) * 100)));

  return {
    score: adjustedScore,
    recommendation,
    risk,
    summary:
      recommendation === "approve"
        ? "الطلب يبدو موثوقًا مبدئيًا استنادًا إلى النصوص وروابط الإثبات."
        : recommendation === "reject"
          ? "الطلب يحتوي على مؤشرات شك واضحة ولا يوصى باعتماده تلقائيًا."
          : "الطلب يحتوي على إشارات متباينة ويحتاج مراجعة بشرية.",
    project_summary: `تم تحليل بيانات الحساب من خلال النظام الهجين للنصوص والروابط والملفات المرفوعة لنوع الحساب ${app.account_type || "غير المحدد"}.`,
    details: `القرار المبدئي: ${DECISION_LABELS[recommendation]}. نسبة الثقة: ${Math.round(
      python.confidence * 100
    )}%. الأسباب الأساسية: ${python.reasons.map(translateReason).join(" ")}`,
    bio_analysis:
      bioWordCount >= 20
        ? "النبذة تعطي وصفًا مقبولًا للنشاط ويمكن البناء عليها في المراجعة."
        : "النبذة ضعيفة وتحتاج تفاصيل أوضح عن النشاط والخبرة أو طبيعة العمل.",
    link_analysis: [link1Result.relevanceHint, link2Result.relevanceHint].filter(Boolean).join(" | ") || "لا توجد إفادة قوية من الروابط المرفقة.",
    strengths,
    weaknesses,
    flags,
    decision_hint: buildDecisionHint(recommendation),
    local_score: adjustedScore,
    reasons: python.reasons.map(translateReason),
    _meta: {
      aiSource: python.source ?? "random_forest",
      bioQuality,
      bioScore,
      link1: {
        url: proof.proof_link_1 || null,
        reachable: link1Result.reachable,
        platform: link1Result.platform,
        relevanceHint: link1Result.relevanceHint,
        relevanceScore: link1Result.relevanceScore,
        relevanceStatus: link1Result.relevanceStatus,
        pageTitle: link1Result.pageTitle,
        pageDescription: link1Result.pageDescription,
        error: link1Result.error,
      },
      link2: {
        url: proof.proof_link_2 || null,
        reachable: link2Result.reachable,
        platform: link2Result.platform,
        relevanceHint: link2Result.relevanceHint,
        relevanceScore: link2Result.relevanceScore,
        relevanceStatus: link2Result.relevanceStatus,
        pageTitle: link2Result.pageTitle,
        pageDescription: link2Result.pageDescription,
        error: link2Result.error,
      },
    },
    image_analysis: imageAnalyses,
  };
}

async function humanizeWithGroq(report: AIReport, context: {
  fullName: string;
  accountType: string;
  bio: string;
  description: string;
}) {
  if (!process.env.GROQ_API_KEY) return report;

  try {
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      temperature: 0.4,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "أنت محلل طلبات احترافي. أعد صياغة التقرير التالي بالعربية الطبيعية وبأسلوب بشري واضح ومهني. " +
            "أعد JSON فقط بنفس المفاتيح التالية: summary, project_summary, details, bio_analysis, link_analysis, strengths, weaknesses, flags, decision_hint, reasons. " +
            "اجعل الجمل طبيعية وغير روبوتية، قصيرة نسبيًا، وواضحة لمدير منصة عربي. " +
            "ممنوع استخدام اللغة الإنجليزية إلا لأسماء المنصات أو القيم التقنية الضرورية جدًا.",
        },
        {
          role: "user",
          content: JSON.stringify({
            applicant: context.fullName,
            account_type: context.accountType,
            bio: context.bio,
            description: context.description,
            recommendation: report.recommendation,
            risk: report.risk,
            score: report.score,
            raw_report: {
              summary: report.summary,
              project_summary: report.project_summary,
              details: report.details,
              bio_analysis: report.bio_analysis,
              link_analysis: report.link_analysis,
              strengths: report.strengths,
              weaknesses: report.weaknesses,
              flags: report.flags,
              decision_hint: report.decision_hint,
              reasons: report.reasons,
            },
          }),
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) return report;

    const parsed = parseGroqJson(content) as Partial<AIReport>;
    return normalizeArabicReport({
      ...report,
      summary: typeof parsed.summary === "string" ? parsed.summary : report.summary,
      project_summary:
        typeof parsed.project_summary === "string" ? parsed.project_summary : report.project_summary,
      details: typeof parsed.details === "string" ? parsed.details : report.details,
      bio_analysis: typeof parsed.bio_analysis === "string" ? parsed.bio_analysis : report.bio_analysis,
      link_analysis:
        typeof parsed.link_analysis === "string" ? parsed.link_analysis : report.link_analysis,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : report.strengths,
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(String) : report.weaknesses,
      flags: Array.isArray(parsed.flags) ? parsed.flags.map(String) : report.flags,
      decision_hint:
        typeof parsed.decision_hint === "string" ? parsed.decision_hint : report.decision_hint,
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : report.reasons,
    });
  } catch (error) {
    console.error("Groq humanization failed, using Arabic fallback.", error);
    return normalizeArabicReport(report);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { app } = (await req.json()) as { app?: ApplicationPayload };
    if (!app) {
      return NextResponse.json({ error: "لم يتم إرسال بيانات الطلب." }, { status: 400 });
    }

    const basic = app.data_json?.basic || {};
    const typeSpecific = app.data_json?.type_specific || {};
    const proof = app.proof_json || {};
    const bio = typeof basic.bio === "string" ? basic.bio : "";
    const email = typeof basic.email === "string" ? basic.email : "";
    const fullName = typeof basic.full_name === "string" ? basic.full_name : "";
    const accountType = typeof app.account_type === "string" ? app.account_type : "";
    const description = collectDescription(accountType, typeSpecific);
    const links = [proof.proof_link_1, proof.proof_link_2].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
    const bioWordCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;
    const fileUrls = Array.isArray(proof.file_urls) ? proof.file_urls : [];

    const [python, link1Result, link2Result, imageAnalyses] = await Promise.all([
      getPythonDecision({
        bio,
        email,
        links,
        account_type: accountType,
        full_name: fullName,
        description,
      }),
      analyzeRelevantLink(proof.proof_link_1, { fullName, bio, description }),
      analyzeRelevantLink(proof.proof_link_2, { fullName, bio, description }),
      Promise.all(
        fileUrls.map(async (url) => {
          try {
            return await analyzeImage(url, fullName || accountType);
          } catch (error) {
            return normalizeImageError(error);
          }
        })
      ),
    ]);

    const fallbackReport = buildArabicFallbackReport({
      app,
      python,
      bioWordCount,
      link1Result,
      link2Result,
      imageAnalyses,
    });

    const report = await humanizeWithGroq(normalizeArabicReport(fallbackReport), {
      fullName,
      accountType,
      bio,
      description,
    });

    return NextResponse.json(report);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فشل تحليل الطلب." },
      { status: 500 }
    );
  }
}
