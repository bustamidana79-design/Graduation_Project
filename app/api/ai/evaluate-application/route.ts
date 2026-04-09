// app/api/ai-analyze/route.ts
import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";
const RF_AI_SERVER_URL = "http://127.0.0.1:5000/predict";

const accountTypeLabel: Record<string, string> = {
  merchant: "تاجر (جملة)",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};

// =============================
// Random Forest Bridge
// =============================
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

// =============================
// Shared Types
// =============================
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

// =============================
// Link Analyzer
// =============================
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
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)",
        "Accept": "text/html",
      },
      redirect: "follow",
    });

    clearTimeout(timeout);

    if (!res.ok) return { reachable: false, platform, error: `HTTP ${res.status}` };

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return { reachable: true, platform };

    const html = await res.text();
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    const stripped = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const contentSnippet = stripped.substring(0, 600);

    return { reachable: true, platform, title, contentSnippet };
  } catch (err: any) {
    return { reachable: false, platform, error: err.message };
  }
}

// =============================
// Bio Analyzer
// =============================
function analyzeBio(bio: string, accountType: string) {
  const words = bio.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  const score = Math.min(100, (wordCount / 20) * 100);

  return {
    wordCount,
    score,
    flags: wordCount < 5 ? ["النبذة قصيرة جداً"] : [],
    quality: score > 60 ? "good" : "weak",
  };
}

// =============================
// (NEW) Image Analyzer (موجود داخل Promise.all)
// =============================
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

// =============================
// Main Handler
// =============================
export async function POST(req: NextRequest) {
  try {
    const { app, fileUrls = [] } = await req.json();

    if (!app) return NextResponse.json({ error: "No data" }, { status: 400 });

    const basic = app.data_json?.basic || {};
    const proof = app.proof_json || {};

    // ========== الدمج الكامل: LINKS + BIO + RF + IMAGES ==========
    const [link1Result, link2Result, bioAnalysis, rfAiResult, imageAnalyses] =
      await Promise.all([
        proof.proof_link_1
          ? analyzeLinkContent(proof.proof_link_1, app.account_type)
          : Promise.resolve({ ...EMPTY_LINK }),

        proof.proof_link_2
          ? analyzeLinkContent(proof.proof_link_2, app.account_type)
          : Promise.resolve({ ...EMPTY_LINK }),

        Promise.resolve(analyzeBio(basic.bio || "", app.account_type)),

        getRfAiScore(basic.bio || ""),

        // 🔥 جزء الصور
        Promise.all(
          fileUrls.map(async (url: string) => {
            return await analyzeImage(url, basic.full_name || app.account_type);
          })
        ),
      ]);

    // Local score
    const localScore = Math.round(
      bioAnalysis.score * 0.4 +
        (link1Result.reachable ? 40 : 0) +
        (rfAiResult.status === 1 ? 20 : 0)
    );

    const summary = `${basic.full_name} — ${accountTypeLabel[app.account_type]} — ${basic.country}`;

    return NextResponse.json({
      link1Result,
      link2Result,
      bioAnalysis,
      rfAiResult,
      imageAnalyses,
      local_score: localScore,
      project_summary: summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}