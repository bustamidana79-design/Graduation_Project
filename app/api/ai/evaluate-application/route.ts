import { NextRequest, NextResponse } from "next/server";
import { groq } from "@/lib/groq";
import { analyzeImage } from "@/lib/vision";
import { buildApplicationProjectSummary } from "@/lib/application-summary";

const AI_SERVER_URL = process.env.AI_MODEL_API_URL || "http://127.0.0.1:8000/predict";
const AI_REPORT_VERSION = 2;

type LinkAnalysisResult = {
  reachable: boolean;
  platform?: string;
  isSocialPlatform?: boolean;
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
  image_url?: string;
  file_name?: string;
  authenticity: string;
  photoshop_detected: boolean;
  document_type: string;
  matches_business?: boolean | null;
  matches_project?: boolean | null;
  confidence: number;
  description: string;
  business_type?: string;
  main_objects?: string[];
  extracted_text?: string[];
  professionalism_score?: number;
  quality_score?: number;
  explanation?: string;
  warnings?: string[];
};

type ImageFeaturePayload = {
  number_of_uploaded_images: number;
  image_professionalism_score: number;
  image_matches_category: number;
  image_confidence: number;
  image_quality_score: number;
  image_mismatch_count: number;
  image_has_warnings: number;
  image_manipulation_risk: number;
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
    page_username?: string | null;
    file_urls?: string[] | null;
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
    reportVersion?: number;
    aiSource?: "random_forest" | "fallback";
    bioQuality: "good" | "weak" | "suspicious";
    bioScore: number;
    link1: {
      url: string | null;
      reachable: boolean;
      platform?: string;
      isSocialPlatform?: boolean;
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
      isSocialPlatform?: boolean;
      relevanceHint?: string;
      relevanceScore?: number;
      relevanceStatus?: "matched" | "weak" | "unknown";
      pageTitle?: string;
      pageDescription?: string;
      error?: string;
    };
    imageFeatures?: ImageFeaturePayload;
  };
  image_analysis?: ImageAnalysisResult[];
};

const EMPTY_LINK: LinkAnalysisResult = {
  reachable: false,
  error: "لم يتم توفير رابط",
};

const SOCIAL_PLATFORM_HOSTS: Record<string, string[]> = {
  Instagram: ["instagram.com"],
  Facebook: ["facebook.com", "fb.com"],
  TikTok: ["tiktok.com"],
  X: ["x.com", "twitter.com"],
  LinkedIn: ["linkedin.com"],
  YouTube: ["youtube.com", "youtu.be"],
  Snapchat: ["snapchat.com"],
  WhatsApp: ["wa.me", "whatsapp.com"],
};

function getUrlHostname(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostnameMatches(hostname: string, domain: string) {
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function detectPlatform(url: string): string {
  const hostname = getUrlHostname(url);
  for (const [platform, domains] of Object.entries(SOCIAL_PLATFORM_HOSTS)) {
    if (domains.some((domain) => hostnameMatches(hostname, domain))) return platform;
  }
  return "Website";
}

function isSocialPlatformUrl(url: string) {
  return detectPlatform(url) !== "Website";
}

function translateReason(reason: string) {
  const normalized = reason.toLowerCase();
  if (normalized.includes("bio too short")) return "النبذة قصيرة جدًا ولا تعطي صورة كافية عن النشاط.";
  if (normalized.includes("no links provided")) return "لا توجد روابط داعمة لإثبات النشاط.";
  if (normalized.includes("email domain does not match")) return "دومين البريد لا يبدو متوافقًا مع الروابط المرفقة.";
  if (normalized.includes("suspicious email")) return "صيغة البريد الإلكتروني تبدو غير موثوقة.";
  if (normalized.includes("proof link is not a business or social page"))
    return "رابط الإثبات يبدو غير مناسب كنشاط تجاري أو صفحة سوشال ميديا، مثل روابط الكود أو مواقع لا تعرض متجراً.";
  if (normalized.includes("project or store description is limited"))
    return "وصف المشروع أو المتجر محدود جدًا.";
  if (normalized.includes("bio and business description look sufficiently detailed"))
    return "النبذة ووصف النشاط يحتويان على تفاصيل مقنعة مبدئيًا.";
  if (normalized.includes("multiple weak trust signals"))
    return "توجد عدة مؤشرات ثقة ضعيفة في الطلب وتحتاج مراجعة دقيقة.";
  if (normalized.includes("model pattern leaned reject"))
    return "النموذج وجد أن نمط الطلب أقرب لطلبات مرفوضة سابقة، لذلك يحتاج تحققاً يدوياً قبل القرار.";
  if (normalized.includes("model confidence is moderate"))
    return "ثقة النموذج متوسطة، لذلك يفضّل مراجعة الطلب يدوياً قبل القرار النهائي.";
  if (normalized.includes("ai model request failed"))
    return "تعذر تشغيل نموذج التقييم الخارجي، وتم الاعتماد على تقييم احتياطي.";
  if (normalized.includes("python ai service unavailable"))
    return "خدمة نموذج الراندوم فورست غير متاحة حالياً، وتم الاعتماد على تقييم احتياطي.";
  if (normalized.includes("mixed signals require manual review"))
    return "الطلب يحتاج مراجعة إدارية نهائية قبل اتخاذ القرار.";
  if (normalized.includes("uploaded images may be manipulated"))
    return "بعض الصور المرفوعة قد تحتوي على تعديل أو تلاعب.";
  if (normalized.includes("uploaded images do not match project category"))
    return "الصور المرفوعة لا تبدو متوافقة مع فئة المشروع أو وصفه.";
  if (normalized.includes("uploaded images look professional and relevant"))
    return "الصور المرفوعة تبدو احترافية ومرتبطة بالنشاط.";
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
  if (looksMostlyEnglish(normalized)) return "تم رصد ملاحظة تقنية باللغة الإنجليزية، وتحتاج مراجعة من الإدارة.";
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
    image_analysis: report.image_analysis,
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

function normalizeHandle(value?: string | null) {
  return (value || "")
    .toLowerCase()
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/\/+$/g, "");
}

function usernameMatchesUrl(url: string, pageUsername?: string | null) {
  const handle = normalizeHandle(pageUsername);
  if (!handle) return false;

  const normalizedUrl = normalizeHandle(url);
  const handleParts = handle.split("/").filter(Boolean);
  const lastHandlePart = handleParts[handleParts.length - 1] || handle;

  return normalizedUrl.includes(handle) || normalizedUrl.includes(lastHandlePart);
}

function decodeUrlForMatching(url: string) {
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

function tokenLooksSimilar(left: string, right: string) {
  if (left === right) return true;
  if (left.length >= 4 && right.includes(left)) return true;
  if (right.length >= 4 && left.includes(right)) return true;
  return false;
}

function scoreBusinessNameInUrl(url: string, businessName?: string | null) {
  const nameTokens = tokenizeForRelevance(businessName || "").filter((token) => token.length >= 3);
  if (nameTokens.length === 0) {
    return { matched: false, score: 0, matchedTokens: [] as string[] };
  }

  const urlTokens = tokenizeForRelevance(decodeUrlForMatching(url));
  const matchedTokens = nameTokens.filter((nameToken) =>
    urlTokens.some((urlToken) => tokenLooksSimilar(nameToken, urlToken))
  );

  if (matchedTokens.length === 0) {
    return { matched: false, score: 0, matchedTokens: [] as string[] };
  }

  const ratio = matchedTokens.length / nameTokens.length;
  const score = Math.max(65, Math.min(92, Math.round(ratio * 100)));
  return { matched: true, score, matchedTokens: matchedTokens.slice(0, 4) };
}

function scoreLinkRelevance(params: {
  url: string;
  pageText: string;
  pageUsername?: string | null;
  businessName?: string | null;
  fullName: string;
  bio: string;
  description: string;
}): { score: number; matchedTokens: string[]; status: "matched" | "weak" | "unknown" } {
  const handleMatched = usernameMatchesUrl(params.url, params.pageUsername);
  const businessNameMatched = scoreBusinessNameInUrl(params.url, params.businessName);
  const claimTokens = tokenizeForRelevance(`${params.fullName} ${params.bio} ${params.description}`).slice(0, 60);
  const pageTokens = new Set(tokenizeForRelevance(`${params.url} ${params.pageUsername || ""} ${params.pageText}`).slice(0, 250));

  if (handleMatched) {
    return { score: 75, matchedTokens: ["username"], status: "matched" as const };
  }

  if (businessNameMatched.matched) {
    return {
      score: businessNameMatched.score,
      matchedTokens: businessNameMatched.matchedTokens,
      status: "matched" as const,
    };
  }

  if (claimTokens.length === 0 || pageTokens.size === 0) {
    return { score: 0, matchedTokens: [] as string[], status: "unknown" as const };
  }

  const matchedTokens = claimTokens.filter((token) => pageTokens.has(token));
  const score = Math.round((matchedTokens.length / Math.min(claimTokens.length, 12)) * 100);
  const status = score >= 25 || matchedTokens.length >= 3 ? "matched" : "weak";

  return { score: Math.min(score, 100), matchedTokens: matchedTokens.slice(0, 6), status };
}

async function analyzeLink(
  url?: string | null
): Promise<LinkAnalysisResult> {
  if (!url) return { ...EMPTY_LINK };

  const platform = detectPlatform(url);
  const isSocialPlatform = isSocialPlatformUrl(url);

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
      return { reachable: false, platform, isSocialPlatform, error: `HTTP ${response.status}` };
    }

    return {
      reachable: true,
      platform,
      isSocialPlatform,
      relevanceHint: isSocialPlatform
        ? `تم الوصول إلى رابط سوشال ميديا موثوق على ${platform}.`
        : `تم الوصول إلى رابط إثبات على موقع إلكتروني عادي.`,
    };
  } catch (error) {
    return {
      reachable: false,
      platform,
      isSocialPlatform,
      error: error instanceof Error ? error.message : "فشل التحقق من الرابط",
    };
  }
}

async function analyzeRelevantLink(
  url?: string | null,
  context?: { fullName: string; bio: string; description: string; pageUsername?: string | null; businessName?: string | null }
): Promise<LinkAnalysisResult> {
  if (!url) return { ...EMPTY_LINK };

  const baseResult = await analyzeLink(url);
  if (!baseResult.reachable) return baseResult;
  const handleMatched = usernameMatchesUrl(url, context?.pageUsername);
  const businessNameMatched = scoreBusinessNameInUrl(url, context?.businessName);
  const handleMatchResult = {
    ...baseResult,
    relevanceHint: `تم الوصول إلى الرابط على ${baseResult.platform} واسم الصفحة المدخل موجود داخل الرابط.`,
    relevanceScore: 75,
    relevanceStatus: "matched" as const,
  };
  if (handleMatched) return handleMatchResult;
  if (businessNameMatched.matched) {
    return {
      ...baseResult,
      relevanceHint: `تم الوصول إلى الرابط على ${baseResult.platform} وظهر تشابه مع اسم النشاط في الرابط (${businessNameMatched.matchedTokens.join("، ")}).`,
      relevanceScore: businessNameMatched.score,
      relevanceStatus: "matched" as const,
    };
  }

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
          pageUsername: context.pageUsername,
          businessName: context.businessName,
          fullName: context.fullName,
          bio: context.bio,
          description: context.description,
        })
      : { score: 0, matchedTokens: [] as string[], status: "unknown" as const };

    const relevanceHint =
      relevance.status === "matched"
        ? `تم الوصول إلى الرابط على ${baseResult.platform} وظهر تطابق مع وصف النشاط (${relevance.matchedTokens.join("، ")}).`
        : relevance.status === "weak"
          ? `تم الوصول إلى الرابط على ${baseResult.platform}، ويمكن مراجعته يدوياً لتأكيد علاقته بالنشاط.`
          : `تم الوصول إلى الرابط على ${baseResult.platform}، ويعد إشارة داعمة تحتاج مراجعة يدوية عند الحاجة.`;

    return {
      ...baseResult,
      relevanceHint,
      relevanceScore: relevance.score,
      relevanceStatus: relevance.status,
      pageTitle: page.title || undefined,
      pageDescription: page.description || undefined,
    };
  } catch {
    return handleMatched
      ? handleMatchResult
      : {
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
    matches_project: null,
    confidence: 0,
    description: "تعذر تحليل الصورة",
    business_type: "غير محدد",
    main_objects: [],
    extracted_text: [],
    professionalism_score: 0,
    quality_score: 0,
    explanation: "تعذر استخراج تقرير رؤية من الصورة.",
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

function extractBusinessName(
  accountType: string,
  typeSpecific: Record<string, unknown>,
  fullName: string
) {
  const keyMap: Record<string, string[]> = {
    merchant: ["store_name"],
    small_business: ["project_name"],
    delivery: ["company_name"],
    supporter: ["professional_name", "supporter_name"],
  };

  for (const key of keyMap[accountType] || []) {
    const value = typeSpecific[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  return fullName;
}

function extractSelectedCategory(accountType: string, typeSpecific: Record<string, unknown>) {
  const keyMap: Record<string, string[]> = {
    merchant: ["product_category"],
    small_business: ["project_field"],
    delivery: ["delivery_scope", "delivery_cities"],
    supporter: ["support_type", "interests"],
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

function clampScore(value: unknown, fallback = 0) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const score = numeric <= 1 && numeric >= 0 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function average(numbers: number[]) {
  if (!numbers.length) return 0;
  return Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length);
}

function imageMatchValue(image: ImageAnalysisResult): number {
  const value = image.matches_project ?? image.matches_business;
  if (value === true) return 1;
  if (value === false) return 0;
  return 0.5;
}

function buildImageFeaturePayload(
  imageAnalyses: ImageAnalysisResult[],
  uploadedImageCount: number
): ImageFeaturePayload {
  const analyzedImages = imageAnalyses.filter((image) => image.description || image.confidence > 0);
  const professionalismScores = analyzedImages.map((image) => clampScore(image.professionalism_score));
  const qualityScores = analyzedImages.map((image) =>
    clampScore(image.quality_score, clampScore(image.professionalism_score))
  );
  const confidenceScores = analyzedImages.map((image) => clampScore(image.confidence));
  const matchValues = analyzedImages.map(imageMatchValue);
  const mismatchCount = analyzedImages.filter((image) => (image.matches_project ?? image.matches_business) === false).length;
  const warningCount = analyzedImages.filter((image) => (image.warnings || []).length > 0).length;
  const manipulationCount = analyzedImages.filter(
    (image) => image.photoshop_detected || image.authenticity === "fake"
  ).length;

  return {
    number_of_uploaded_images: uploadedImageCount,
    image_professionalism_score: average(professionalismScores),
    image_matches_category: analyzedImages.length ? Number((matchValues.reduce((sum, value) => sum + value, 0) / matchValues.length).toFixed(2)) : 0,
    image_confidence: analyzedImages.length ? Number((average(confidenceScores) / 100).toFixed(2)) : 0,
    image_quality_score: average(qualityScores),
    image_mismatch_count: mismatchCount,
    image_has_warnings: warningCount > 0 ? 1 : 0,
    image_manipulation_risk: manipulationCount > 0 ? 1 : 0,
  };
}

function percentFromRatio(value: number) {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

function targetScore(value: number, target: number) {
  if (target <= 0) return 0;
  return percentFromRatio(Math.min(1, value / target));
}

function calculateLinkScore(params: {
  providedLinks: number;
  link1Result: LinkAnalysisResult;
  link2Result: LinkAnalysisResult;
}) {
  const links = [params.link1Result, params.link2Result];
  const reachableLinks = links.filter((item) => item.reachable).length;
  const matchedLinks = links.filter((item) => item.relevanceStatus === "matched").length;
  const socialLinks = links.filter((item) => item.isSocialPlatform).length;

  if (params.providedLinks === 0) return 0;
  if (reachableLinks === 0) return 30;

  if (matchedLinks > 0 && socialLinks > 0) return 100;
  if (matchedLinks > 0) return 95;
  if (socialLinks > 0) return 88;

  return Math.max(0, Math.min(100, 70 + reachableLinks * 10));
}

function calculateImageScore(imageFeatures: ImageFeaturePayload) {
  if (imageFeatures.number_of_uploaded_images <= 0) return null;

  const score =
    imageFeatures.image_professionalism_score * 0.35 +
    imageFeatures.image_quality_score * 0.25 +
    imageFeatures.image_confidence * 100 * 0.2 +
    imageFeatures.image_matches_category * 100 * 0.2 -
    imageFeatures.image_mismatch_count * 12 -
    imageFeatures.image_has_warnings * 8 -
    imageFeatures.image_manipulation_risk * 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function calculateCompositeScore(params: {
  python: PythonAiResponse;
  bioWordCount: number;
  descriptionWordCount: number;
  providedLinks: number;
  link1Result: LinkAnalysisResult;
  link2Result: LinkAnalysisResult;
  imageFeatures: ImageFeaturePayload;
}) {
  const modelScore = clampScore(params.python.score * 100);
  const bioScore = targetScore(params.bioWordCount, 35);
  const descriptionScore = targetScore(params.descriptionWordCount, 10);
  const linkScore = calculateLinkScore(params);
  const imageScore = calculateImageScore(params.imageFeatures);

  const weightedScore =
    imageScore === null
      ? modelScore * 0.55 + bioScore * 0.2 + descriptionScore * 0.15 + linkScore * 0.1
      : modelScore * 0.45 + bioScore * 0.15 + descriptionScore * 0.1 + linkScore * 0.15 + imageScore * 0.15;

  let finalScore = weightedScore;
  if (params.python.decision === "approve") finalScore = Math.max(finalScore, 55);
  if (params.python.decision === "review") finalScore = Math.min(Math.max(finalScore, 35), 78);
  if (params.python.decision === "reject") finalScore = Math.min(finalScore, 35);

  return Math.max(0, Math.min(100, Math.round(finalScore)));
}

function fileNameFromUrl(url: string) {
  try {
    const pathname = new URL(url).pathname;
    return decodeURIComponent(pathname.split("/").filter(Boolean).pop() || "");
  } catch {
    return decodeURIComponent(url.split("?")[0].split("/").filter(Boolean).pop() || "");
  }
}

function getFallbackPythonDecision(payload: {
  bio: string;
  email: string;
  links: string[];
  description: string;
  image_features?: ImageFeaturePayload;
}): PythonAiResponse {
  const bioWordCount = payload.bio.trim() ? payload.bio.trim().split(/\s+/).length : 0;
  const descriptionWordCount = payload.description.trim() ? payload.description.trim().split(/\s+/).length : 0;
  const emailLocalPart = payload.email.includes("@") ? payload.email.split("@")[0] : payload.email;
  const suspiciousEmail = (emailLocalPart.match(/\d/g) || []).length >= 4;
  const hasLinks = payload.links.length > 0;
  const imageFeatures = payload.image_features;
  const hasImages = Boolean(imageFeatures && imageFeatures.number_of_uploaded_images > 0);

  let score = 0.45;
  if (bioWordCount >= 20) score += 0.2;
  if (descriptionWordCount >= 4) score += 0.15;
  if (hasLinks) score += 0.15;
  if (hasImages) score += Math.min(0.12, (imageFeatures?.image_professionalism_score || 0) / 1000);
  if (hasImages && (imageFeatures?.image_matches_category || 0) >= 0.75) score += 0.08;
  if (hasImages && imageFeatures?.image_matches_category === 0) score -= 0.18;
  if (hasImages && (imageFeatures?.image_quality_score || 0) < 35) score -= 0.1;
  if (imageFeatures?.image_manipulation_risk) score -= 0.2;
  if (suspiciousEmail) score -= 0.2;
  if (bioWordCount < 8) score -= 0.15;

  score = Math.max(0.05, Math.min(0.95, score));
  const decision: PythonAiResponse["decision"] = score >= 0.72 ? "approve" : score <= 0.35 ? "reject" : "review";
  const reasons: string[] = ["python ai service unavailable"];

  if (bioWordCount < 8) reasons.push("bio too short");
  if (!hasLinks) reasons.push("no links provided");
  if (suspiciousEmail) reasons.push("suspicious email");
  if (descriptionWordCount < 4) reasons.push("project or store description is limited");
  if (hasImages && imageFeatures?.image_matches_category === 0) reasons.push("uploaded images do not match project category");
  if (imageFeatures?.image_manipulation_risk) reasons.push("uploaded images may be manipulated");
  if (hasImages && (imageFeatures?.image_professionalism_score || 0) >= 70) reasons.push("uploaded images look professional and relevant");
  if (reasons.length === 1) reasons.push("mixed signals require manual review");

  return {
    decision,
    score,
    confidence: Math.min(0.65, Math.max(0.35, score)),
    reasons: reasons.slice(0, 4),
    source: "fallback",
  };
}

async function getPythonDecision(payload: {
  bio: string;
  email: string;
  links: string[];
  account_type: string;
  full_name: string;
  description: string;
  image_features?: ImageFeaturePayload;
}): Promise<PythonAiResponse> {
  try {
    const response = await fetch(AI_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        image_features: payload.image_features,
        image_professionalism_score: payload.image_features?.image_professionalism_score ?? 0,
        image_matches_category: payload.image_features?.image_matches_category ?? 0,
        image_confidence: payload.image_features?.image_confidence ?? 0,
        number_of_uploaded_images: payload.image_features?.number_of_uploaded_images ?? 0,
        image_quality_score: payload.image_features?.image_quality_score ?? 0,
        image_mismatch_count: payload.image_features?.image_mismatch_count ?? 0,
        image_has_warnings: payload.image_features?.image_has_warnings ?? 0,
        image_manipulation_risk: payload.image_features?.image_manipulation_risk ?? 0,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`AI model request failed: ${response.status} ${text}`);
    }

    const result = (await response.json()) as PythonAiResponse;
    console.log("AI Source = random_forest");
    return { ...result, source: "random_forest" };
  } catch (error) {
    console.error("Python AI service unavailable; using fallback decision.", error);
    return getFallbackPythonDecision(payload);
  }
}

function ignoreEmailDomainSignal(python: PythonAiResponse): PythonAiResponse {
  const reasons = python.reasons.filter(
    (reason) => !reason.toLowerCase().includes("email domain does not match")
  );

  if (reasons.length === python.reasons.length) return python;

  const decision =
    python.decision === "reject" && reasons.length <= 1
      ? "review"
      : python.decision;

  return {
    ...python,
    decision,
    reasons: reasons.length > 0 ? reasons : ["mixed signals require manual review"],
  };
}

function softenGenericConfidenceSignal(python: PythonAiResponse): PythonAiResponse {
  const shouldKeepModerateConfidence =
    python.decision === "review" && python.confidence < 0.55;

  if (shouldKeepModerateConfidence) return python;

  return {
    ...python,
    reasons: python.reasons.filter(
      (reason) => !reason.toLowerCase().includes("model confidence is moderate")
    ),
  };
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
  descriptionWordCount: number;
  link1Result: LinkAnalysisResult;
  link2Result: LinkAnalysisResult;
  imageAnalyses: ImageAnalysisResult[];
  imageFeatures: ImageFeaturePayload;
}): AIReport {
  const { app, python, bioWordCount, descriptionWordCount, link1Result, link2Result, imageAnalyses, imageFeatures } = params;
  const proof = app.proof_json || {};
  const providedLinks = [proof.proof_link_1, proof.proof_link_2].filter(
    (value) => typeof value === "string" && value.trim().length > 0
  ).length;
  const reachableLinks = [link1Result, link2Result].filter((item) => item.reachable).length;
  const socialLinks = [link1Result, link2Result].filter((item) => item.isSocialPlatform).length;
  let adjustedScore = calculateCompositeScore({
    python,
    bioWordCount,
    descriptionWordCount,
    providedLinks,
    link1Result,
    link2Result,
    imageFeatures,
  });

  const recommendation = python.decision;
  if (recommendation === "reject") adjustedScore = Math.min(adjustedScore, 35);
  const risk: AIReport["risk"] =
    recommendation === "reject" ? "high" : recommendation === "approve" ? "low" : "medium";

  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const flags = python.reasons.map(translateReason);

  if (bioWordCount >= 20) strengths.push("النبذة تحتوي على قدر جيد من التفاصيل الأولية.");
  else weaknesses.push("النبذة قصيرة ولا توضح النشاط بشكل كاف.");

  if (reachableLinks > 0) strengths.push("يوجد رابط إثبات واحد على الأقل يمكن الوصول إليه.");
  else if (providedLinks > 0) strengths.push("تم تقديم رابط إثبات يمكن مراجعته يدوياً حتى لو تعذر التحقق الآلي منه.");
  else weaknesses.push("لم يتم تقديم رابط إثبات يمكن الاعتماد عليه في المراجعة.");

  if (socialLinks > 0) strengths.push("يوجد رابط سوشال ميديا معروف مثل إنستغرام أو فيسبوك أو لينكدإن.");

  const matchedLinks = [link1Result, link2Result].filter((item) => item.relevanceStatus === "matched").length;

  if (matchedLinks > 0) strengths.push("رابط الإثبات يحتوي على مؤشرات مرتبطة بوصف النشاط المقدم.");

  if (python.reasons.some((reason) => reason.includes("suspicious email"))) {
    weaknesses.push("صيغة البريد الإلكتروني تثير الشك.");
  }

  if (imageAnalyses.some((img) => img.authenticity === "fake" || img.photoshop_detected)) {
    flags.push("بعض الصور المرفوعة تبدو غير موثوقة أو معدلة.");
  }
  if (imageFeatures.number_of_uploaded_images === 0) {
    weaknesses.push("لم يتم رفع صور داعمة تساعد في التحقق من النشاط.");
  } else {
    if (imageFeatures.image_matches_category >= 0.75) {
      strengths.push("الصور المرفوعة متسقة مع نوع المشروع أو الفئة المختارة.");
    } else if (imageFeatures.image_matches_category === 0) {
      weaknesses.push("الصور المرفوعة لا تبدو متطابقة مع نوع المشروع أو الفئة المختارة.");
    }

    if (imageFeatures.image_professionalism_score >= 70) {
      strengths.push("جودة الصور واحترافيتها تدعم جدية النشاط.");
    } else if (imageFeatures.image_professionalism_score > 0 && imageFeatures.image_professionalism_score < 40) {
      weaknesses.push("احترافية الصور منخفضة وتحتاج مراجعة يدوية.");
    }

    if (imageFeatures.image_confidence < 0.35) {
      flags.push("ثقة تحليل الصور منخفضة، لذلك يفضّل مراجعتها يدويًا.");
    }
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
          : "الطلب يحتاج مراجعة إدارية نهائية قبل اتخاذ القرار.",
    project_summary: buildApplicationProjectSummary(app),
    details: `الأسباب الأساسية: ${python.reasons.map(translateReason).join(" ")}`,
    bio_analysis:
      bioWordCount >= 20
        ? "النبذة تعطي وصفًا مقبولًا للنشاط ويمكن البناء عليها في المراجعة."
        : "النبذة ضعيفة وتحتاج تفاصيل أوضح عن النشاط والخبرة أو طبيعة العمل.",
    link_analysis: [link1Result.relevanceHint, link2Result.relevanceHint].filter(Boolean).join(" | ") || "لم يتم تقديم رابط يمكن الاعتماد عليه في التحليل الآلي، ويمكن للمدير طلب رابط إضافي عند الحاجة.",
    strengths,
    weaknesses,
    flags,
    decision_hint: buildDecisionHint(recommendation),
    local_score: adjustedScore,
    reasons: python.reasons.map(translateReason),
    _meta: {
      reportVersion: AI_REPORT_VERSION,
      aiSource: python.source ?? "random_forest",
      bioQuality,
      bioScore,
      link1: {
        url: proof.proof_link_1 || null,
        reachable: link1Result.reachable,
        platform: link1Result.platform,
        isSocialPlatform: link1Result.isSocialPlatform,
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
        isSocialPlatform: link2Result.isSocialPlatform,
        relevanceHint: link2Result.relevanceHint,
        relevanceScore: link2Result.relevanceScore,
        relevanceStatus: link2Result.relevanceStatus,
        pageTitle: link2Result.pageTitle,
        pageDescription: link2Result.pageDescription,
        error: link2Result.error,
      },
      imageFeatures,
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
            "لا تذكر القرار المبدئي أو نسبة الثقة داخل حقل details. " +
            "لا تجعل عدم وضوح الرابط نقطة ضعف بحد ذاته إذا كان الرابط يعمل؛ اكتبه كملاحظة تحقق يدوية فقط، ولا تضرر تقييم المستخدم بسبب غياب تطابق آلي كامل. " +
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
    const businessName = extractBusinessName(accountType, typeSpecific, fullName);
    const selectedCategory = extractSelectedCategory(accountType, typeSpecific);
    const links = [proof.proof_link_1, proof.proof_link_2].filter(
      (value): value is string => typeof value === "string" && value.length > 0
    );
    const bioWordCount = bio.trim() ? bio.trim().split(/\s+/).length : 0;
    const descriptionWordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
    const fileUrls = (Array.isArray(proof.file_urls) ? proof.file_urls : [])
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => value.trim());

    const [link1Result, link2Result, imageAnalyses] = await Promise.all([
      analyzeRelevantLink(proof.proof_link_1, { fullName, bio, description, pageUsername: proof.page_username, businessName }),
      analyzeRelevantLink(proof.proof_link_2, { fullName, bio, description, pageUsername: proof.page_username, businessName }),
      Promise.all(
        fileUrls.map(async (url) => {
          try {
            const analysis = await analyzeImage(url, {
              businessName,
              selectedCategory,
              accountType,
              projectDescription: [description, bio].filter(Boolean).join(" "),
            });
            return {
              ...analysis,
              image_url: url,
              file_name: fileNameFromUrl(url),
            };
          } catch (error) {
            return {
              ...normalizeImageError(error),
              image_url: url,
              file_name: fileNameFromUrl(url),
            };
          }
        })
      ),
    ]);
    const imageFeatures = buildImageFeaturePayload(imageAnalyses, fileUrls.length);
    const rawPython = await getPythonDecision({
      bio,
      email,
      links,
      account_type: accountType,
      full_name: fullName,
      description,
      image_features: imageFeatures,
    });
    const python = softenGenericConfidenceSignal(ignoreEmailDomainSignal(rawPython));

    const fallbackReport = buildArabicFallbackReport({
      app,
      python,
      bioWordCount,
      descriptionWordCount,
      link1Result,
      link2Result,
      imageAnalyses,
      imageFeatures,
    });

    const report = await humanizeWithGroq(normalizeArabicReport(fallbackReport), {
      fullName,
      accountType,
      bio,
      description,
    });

    return NextResponse.json({
      ...report,
      project_summary: buildApplicationProjectSummary(app),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "فشل تحليل الطلب." },
      { status: 500 }
    );
  }
}
