import { NextRequest, NextResponse } from "next/server";
import { analyzeImage } from "@/lib/vision";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const RF_AI_SERVER_URL = "http://127.0.0.1:5000/predict";

type LinkAnalysisResult = {
  reachable: boolean;
  title?: string;
  description?: string;
  contentSnippet?: string;
  relevanceHint?: string;
  platform?: string;
  error?: string;
};

type RfAiResponse = {
  status: number;
  confidence: number;
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
  account_type?: string;
  data_json?: {
    basic?: {
      full_name?: string;
      bio?: string;
    };
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
  _meta?: {
    bioQuality: "good" | "weak" | "suspicious";
    bioScore: number;
    link1: {
      url: string | null;
      reachable: boolean;
      platform?: string;
      relevanceHint?: string;
      error?: string;
    };
    link2: {
      url: string | null;
      reachable: boolean;
      platform?: string;
      relevanceHint?: string;
      error?: string;
    };
  };
  image_analysis?: ImageAnalysisResult[];
};

const EMPTY_LINK: LinkAnalysisResult = {
  reachable: false,
  error: "No link provided",
};

async function translateToEnglish(text: string): Promise<string> {
  if (!text.trim() || !GROQ_API_KEY) return text;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "system",
            content:
              "Translate the following text to English. Output only the translation.",
          },
          { role: "user", content: text },
        ],
      }),
    });

    if (!res.ok) return text;

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return data.choices?.[0]?.message?.content?.trim() || text;
  } catch {
    return text;
  }
}

async function getRfAiScore(features: Record<string, unknown>): Promise<RfAiResponse> {
  try {
    const res = await fetch(RF_AI_SERVER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(features),
    });

    if (!res.ok) throw new Error("RF Server Unreachable");

    return (await res.json()) as RfAiResponse;
  } catch (error) {
    console.error("AI RF Bridge Error:", error);
    return { status: 1, confidence: 0.5 };
  }
}

async function analyzeLinkContent(
  url: string,
  accountType: string
): Promise<LinkAnalysisResult> {
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
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ar,en;q=0.9",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return { reachable: false, platform, error: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      return { reachable: true, platform, relevanceHint: "Non-HTML content" };
    }

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const contentSnippet = stripped.slice(0, 600);

    const accountKeywords: Record<string, string[]> = {
      merchant: ["متجر", "بيع", "بضاعة", "جملة", "تجارة"],
      delivery: ["توصيل", "شحن", "نقل"],
      small_business: ["مشروع", "منتج", "خدمة", "متجر"],
      supporter: ["استثمار", "دعم", "شراكة"],
    };

    const keywords = accountKeywords[accountType] || [];
    const matched = keywords.filter((keyword) => html.includes(keyword));

    return {
      reachable: true,
      platform,
      title,
      contentSnippet,
      relevanceHint:
        matched.length > 0
          ? `Relevant keywords: ${matched.join(", ")}`
          : "No matching keywords found",
    };
  } catch (error) {
    return {
      reachable: false,
      platform,
      error: error instanceof Error ? error.message : "Unknown link analysis error",
    };
  }
}

function analyzeBio(
  bio: string
): { wordCount: number; score: number; flags: string[]; quality: "good" | "weak" } {
  const words = bio.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const flags: string[] = [];

  if (wordCount < 5) flags.push("Bio is too short");

  const score = Math.min(100, (wordCount / 20) * 100);

  return {
    wordCount,
    score,
    flags,
    quality: score > 60 ? "good" : "weak",
  };
}

function normalizeImageError(error: unknown): ImageAnalysisResult {
  return {
    authenticity: "uncertain",
    photoshop_detected: false,
    document_type: "other",
    matches_business: null,
    confidence: 0,
    description: "Image analysis failed",
    warnings: [error instanceof Error ? error.message : "IMAGE_ERROR"],
  };
}

function parseModelJson(raw: string) {
  const trimmed = raw.trim();
  const withoutFences = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const jsonStart = withoutFences.indexOf("{");
    const jsonEnd = withoutFences.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("Model did not return valid JSON");
    }

    const jsonSlice = withoutFences.slice(jsonStart, jsonEnd + 1);
    return JSON.parse(jsonSlice);
  }
}

function clampScore(score: unknown, fallback: number) {
  const parsed = typeof score === "number" ? score : Number(score);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function normalizeRecommendation(value: unknown, score: number): AIReport["recommendation"] {
  const normalized = String(value || "").toLowerCase();
  if (["approve", "approved", "accept"].includes(normalized)) return "approve";
  if (["reject", "rejected", "deny"].includes(normalized)) return "reject";
  if (["review", "manual_review", "needs_review", "pending"].includes(normalized)) return "review";
  if (score >= 75) return "approve";
  if (score <= 39) return "reject";
  return "review";
}

function normalizeRisk(value: unknown, score: number): AIReport["risk"] {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "low" || normalized === "medium" || normalized === "high") return normalized;
  if (score >= 75) return "low";
  if (score <= 39) return "high";
  return "medium";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : String(item ?? "").trim()))
    .filter(Boolean);
}

function buildFallbackReport(params: {
  localScore: number;
  bioAnalysis: ReturnType<typeof analyzeBio>;
  link1Result: LinkAnalysisResult;
  link2Result: LinkAnalysisResult;
  proof: ApplicationPayload["proof_json"];
  imageAnalyses: ImageAnalysisResult[];
  rfAiResult: RfAiResponse;
}): AIReport {
  const { localScore, bioAnalysis, link1Result, link2Result, proof, imageAnalyses, rfAiResult } = params;

  const recommendation = normalizeRecommendation(undefined, localScore);
  const risk = normalizeRisk(undefined, localScore);
  const bioQuality: NonNullable<AIReport["_meta"]>["bioQuality"] =
    bioAnalysis.score < 30 ? "suspicious" : bioAnalysis.quality;
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const flags = [...bioAnalysis.flags];

  if (bioAnalysis.score >= 60) strengths.push("The bio contains enough detail to support the application.");
  else weaknesses.push("The bio is brief and gives limited evidence about the business.");

  if (link1Result.reachable || link2Result.reachable) {
    strengths.push("At least one proof link is reachable.");
  } else {
    weaknesses.push("No reachable proof links were found.");
    flags.push("Proof links could not be verified.");
  }

  if (rfAiResult.status === 1) strengths.push("The Random Forest model rated the application as likely valid.");
  else {
    weaknesses.push("The Random Forest model marked the application as suspicious.");
    flags.push("Random Forest model raised a suspicion signal.");
  }

  if (imageAnalyses.some((img) => img.authenticity === "fake" || img.photoshop_detected)) {
    flags.push("At least one uploaded image may be manipulated or suspicious.");
  }

  return {
    score: localScore,
    recommendation,
    risk,
    summary:
      recommendation === "approve"
        ? "The application looks generally credible based on the available signals."
        : recommendation === "reject"
          ? "The application contains enough risk signals to justify rejection."
          : "The application is mixed and would benefit from manual review.",
    project_summary: "Automated summary generated from bio, links, images, and RF score.",
    details:
      `Bio score: ${bioAnalysis.score}/100. ` +
      `Link 1 reachable: ${link1Result.reachable ? "yes" : "no"}. ` +
      `Link 2 reachable: ${link2Result.reachable ? "yes" : "no"}. ` +
      `RF status: ${rfAiResult.status === 1 ? "likely valid" : "suspicious"}.`,
    bio_analysis:
      bioAnalysis.score >= 60
        ? "The bio has a reasonable amount of detail and supports the business identity."
        : "The bio is weak or too short and does not provide enough confidence.",
    link_analysis:
      [link1Result.relevanceHint, link2Result.relevanceHint].filter(Boolean).join(" | ") ||
      "No strong evidence from proof links.",
    strengths,
    weaknesses,
    flags,
    decision_hint:
      recommendation === "approve"
        ? "Approve if the manual documents also look consistent."
        : recommendation === "reject"
          ? "Reject unless there is strong external verification."
          : "Keep this request for manual review before making a final decision.",
    local_score: localScore,
    _meta: {
      bioQuality,
      bioScore: Math.round(bioAnalysis.score),
      link1: {
        url: proof?.proof_link_1 || null,
        reachable: link1Result.reachable,
        platform: link1Result.platform,
        relevanceHint: link1Result.relevanceHint,
        error: link1Result.error,
      },
      link2: {
        url: proof?.proof_link_2 || null,
        reachable: link2Result.reachable,
        platform: link2Result.platform,
        relevanceHint: link2Result.relevanceHint,
        error: link2Result.error,
      },
    },
    image_analysis: imageAnalyses,
  };
}

function normalizeAiReport(raw: unknown, fallback: AIReport): AIReport {
  const parsed = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const score = clampScore(parsed.score, fallback.score);
  const recommendation = normalizeRecommendation(
    parsed.recommendation ?? parsed.recommended_action ?? parsed.verdict,
    score
  );
  const risk = normalizeRisk(parsed.risk, score);

  return {
    score,
    recommendation,
    risk,
    summary: typeof parsed.summary === "string" ? parsed.summary : fallback.summary,
    project_summary:
      typeof parsed.project_summary === "string" ? parsed.project_summary : fallback.project_summary,
    details: typeof parsed.details === "string" ? parsed.details : fallback.details,
    bio_analysis:
      typeof parsed.bio_analysis === "string" ? parsed.bio_analysis : fallback.bio_analysis,
    link_analysis:
      typeof parsed.link_analysis === "string" ? parsed.link_analysis : fallback.link_analysis,
    strengths: asStringArray(parsed.strengths).length ? asStringArray(parsed.strengths) : fallback.strengths,
    weaknesses:
      asStringArray(parsed.weaknesses).length ? asStringArray(parsed.weaknesses) : fallback.weaknesses,
    flags: asStringArray(parsed.flags).length ? asStringArray(parsed.flags) : fallback.flags,
    decision_hint:
      typeof parsed.decision_hint === "string" ? parsed.decision_hint : fallback.decision_hint,
    local_score: fallback.local_score,
    _meta: fallback._meta,
    image_analysis: fallback.image_analysis,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { app } = (await req.json()) as { app?: ApplicationPayload };

    if (!app) {
      return NextResponse.json({ error: "No data" }, { status: 400 });
    }

    const basic = app.data_json?.basic || {};
    const proof = app.proof_json || {};
    const fileUrls: string[] = Array.isArray(proof.file_urls) ? proof.file_urls : [];
    const userBio = typeof basic.bio === "string" ? basic.bio : "";

    const translatedBio = await translateToEnglish(userBio);

    const rfFeatures = {
      bio: translatedBio,
      link_reachable: proof.proof_link_1 || proof.proof_link_2 ? 1 : 0,
      platform_score:
        proof.proof_link_1?.includes("linkedin") || proof.proof_link_2?.includes("linkedin")
          ? 1
          : 0.5,
      has_files: fileUrls.length > 0 ? 1 : 0,
      fields_complete: basic.full_name && userBio.length > 20 ? 1 : 0,
      has_second_link: proof.proof_link_1 && proof.proof_link_2 ? 1 : 0,
      bio_word_count: userBio.trim() ? userBio.trim().split(/\s+/).length : 0,
    };

    const [link1Result, link2Result, bioAnalysis, rfAiResult, imageAnalyses] = await Promise.all([
      proof.proof_link_1
        ? analyzeLinkContent(proof.proof_link_1, app.account_type || "")
        : Promise.resolve({ ...EMPTY_LINK }),
      proof.proof_link_2
        ? analyzeLinkContent(proof.proof_link_2, app.account_type || "")
        : Promise.resolve({ ...EMPTY_LINK }),
      Promise.resolve(analyzeBio(userBio)),
      getRfAiScore(rfFeatures),
      Promise.all(
        fileUrls.map(async (url) => {
          try {
            return await analyzeImage(url, basic.full_name || app.account_type);
          } catch (error) {
            return normalizeImageError(error);
          }
        })
      ),
    ]);

    const localScore = Math.round(
      bioAnalysis.score * 0.3 +
        (link1Result.reachable ? 30 : 0) +
        (link2Result.reachable ? 15 : 0) +
        (rfAiResult.status === 1 ? 40 : 0)
    );

    const imageContext =
      imageAnalyses.length > 0
        ? imageAnalyses
            .map(
              (img, index) =>
                `Image ${index + 1}: authenticity=${img.authenticity}, photoshop=${
                  img.photoshop_detected
                }, description=${img.description}`
            )
            .join("\n")
        : "No images provided";

    const appContext = `
Application analysis:
- Applicant: ${basic.full_name || "Unknown"}
- Account type: ${app.account_type || "Unknown"}
- Bio: ${userBio || "No bio"}
- Link 1: ${proof.proof_link_1 || "Not provided"} (${link1Result.relevanceHint || "No analysis"})
- Link 2: ${proof.proof_link_2 || "Not provided"} (${link2Result.relevanceHint || "No analysis"})
- RF AI Result: ${rfAiResult.status === 1 ? "Likely valid" : "Suspicious"} (confidence: ${Math.round(
      rfAiResult.confidence * 100
    )}%)
- Images:
${imageContext}
- Local score: ${localScore}/100
`;

    const fallbackReport = buildFallbackReport({
      localScore,
      bioAnalysis,
      link1Result,
      link2Result,
      proof,
      imageAnalyses,
      rfAiResult,
    });

    if (!GROQ_API_KEY) {
      return NextResponse.json(fallbackReport);
    }

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
          {
            role: "system",
            content:
              "You are an expert application reviewer. Return valid JSON only. " +
              "Use exactly these keys: score, recommendation, risk, summary, project_summary, details, bio_analysis, link_analysis, strengths, weaknesses, flags, decision_hint. " +
              'recommendation must be one of: "approve", "review", "reject". ' +
              'risk must be one of: "low", "medium", "high". ' +
              "strengths, weaknesses, and flags must be arrays of strings.",
          },
          {
            role: "user",
            content:
              `Analyze this application and return JSON only.\n${appContext}\n` +
              "If the evidence is mixed, use recommendation=review.",
          },
        ],
      }),
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      throw new Error(`Groq request failed: ${groqResponse.status} ${errorText}`);
    }

    const groqData = (await groqResponse.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = groqData.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Groq returned an empty response");
    }

    return NextResponse.json(normalizeAiReport(parseModelJson(content), fallbackReport));
  } catch (error) {
    console.error("Evaluation error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown evaluation error",
      },
      { status: 500 }
    );
  }
}
