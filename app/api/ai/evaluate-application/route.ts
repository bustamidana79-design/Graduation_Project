// app/api/ai-analyze/route.ts

import { NextRequest, NextResponse } from "next/server";

const GROQ_API_KEY = process.env.GROQ_API_KEY || "";

const accountTypeLabel: Record<string, string> = {
  merchant: "تاجر (جملة)",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};

// ============================================================
// Shared Types
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

const EMPTY_LINK: LinkAnalysisResult = {
  reachable: false,
  platform: undefined,
  relevanceHint: undefined,
  error: "لا يوجد رابط",
};

// ============================================================
// Link Analysis Helper
// ============================================================
async function analyzeLinkContent(url: string, accountType: string): Promise<LinkAnalysisResult> {
  if (!url || url === "غير موجود") return { ...EMPTY_LINK };

  // Detect platform
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

    if (!res.ok) {
      const result: LinkAnalysisResult = { reachable: false, platform, relevanceHint: undefined, error: `HTTP ${res.status}` };
      return result;
    }

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      const result: LinkAnalysisResult = { reachable: true, platform, relevanceHint: "الرابط يشير إلى ملف أو محتوى غير نصي" };
      return result;
    }

    // Read first 30KB only
    const reader = res.body?.getReader();
    if (!reader) {
      const result: LinkAnalysisResult = { reachable: true, platform, relevanceHint: undefined };
      return result;
    }

    let html = "";
    let bytesRead = 0;
    const limit = 30_000;

    while (bytesRead < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytesRead += value.length;
    }
    reader.cancel();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim().replace(/\s+/g, " ") : undefined;

    // Extract meta description
    const descMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i) ||
      html.match(/<meta[^>]+content=["']([^"']{1,400})["'][^>]+name=["']description["']/i) ||
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Extract og:title as fallback
    const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i);
    const ogTitle = ogTitleMatch ? ogTitleMatch[1].trim() : undefined;

    // Strip tags and grab visible text snippet
    const stripped = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const contentSnippet = stripped.substring(0, 600);

    // Relevance hint based on account type keywords
    const accountKeywords: Record<string, string[]> = {
      merchant: ["متجر", "بيع", "بضاعة", "جملة", "تجارة", "منتجات", "store", "shop", "wholesale", "products"],
      small_business: ["مشروع", "خدمة", "أعمال", "business", "service", "project"],
      delivery: ["توصيل", "شحن", "نقل", "delivery", "shipping", "logistics", "courier"],
      supporter: ["استثمار", "دعم", "تمويل", "investment", "support", "funding", "investor"],
    };

    const keywords = accountKeywords[accountType] || [];
    const combinedText = `${title || ""} ${ogTitle || ""} ${description || ""} ${contentSnippet}`.toLowerCase();
    const matchedKeywords = keywords.filter((kw) => combinedText.includes(kw));
    const relevanceHint = matchedKeywords.length > 0
      ? `يحتوي على مؤشرات متوافقة: ${matchedKeywords.slice(0, 4).join("، ")}`
      : "لم يُرصد تطابق واضح مع نوع الحساب في محتوى الرابط";

    const result: LinkAnalysisResult = {
      reachable: true,
      platform,
      title: title || ogTitle,
      description,
      contentSnippet,
      relevanceHint,
    };
    return result;
  } catch (err: any) {
    const msg = err?.name === "AbortError" ? "انتهت مهلة الاتصال (timeout)" : err?.message || "خطأ غير معروف";
    const result: LinkAnalysisResult = { reachable: false, platform, relevanceHint: undefined, error: msg };
    return result;
  }
}

// ============================================================
// Bio Quality Analysis (local heuristics)
// ============================================================
function analyzeBio(bio: string, accountType: string): {
  wordCount: number;
  score: number;
  flags: string[];
  quality: "good" | "weak" | "suspicious";
} {
  const flags: string[] = [];
  const words = bio.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;

  if (wordCount < 5) {
    flags.push("النبذة قصيرة جداً ولا تعطي معلومات كافية");
  } else if (wordCount < 15) {
    flags.push("النبذة مقتضبة وتفتقر إلى التفاصيل");
  }

  const genericPhrases = [
    "أفضل", "الأفضل", "رقم واحد", "الأول", "لا مثيل", "فريد من نوعه",
    "نحن نقدم أفضل", "خدمة متميزة", "جودة عالية", "أسعار منافسة",
    "نخدمكم", "في خدمتكم", "تواصل معنا", "للتواصل",
  ];
  const bioLower = bio.toLowerCase();
  const genericMatches = genericPhrases.filter((p) => bioLower.includes(p));
  if (genericMatches.length >= 3) {
    flags.push("النبذة تحتوي على عبارات عامة ومكررة دون تفاصيل حقيقية");
  }

  const typeKeywords: Record<string, string[]> = {
    merchant: ["بضاعة", "تجارة", "متجر", "مورد", "جملة", "منتجات", "بيع", "شراء"],
    small_business: ["مشروع", "خدمة", "ورشة", "محل", "نشاط", "عمل", "زبائن"],
    delivery: ["توصيل", "شحن", "نقل", "سائق", "سيارة", "مواعيد", "سرعة"],
    supporter: ["استثمار", "دعم", "مال", "تمويل", "شراكة", "رأس مال"],
  };
  const relevant = (typeKeywords[accountType] || []).some((kw) => bioLower.includes(kw));
  if (!relevant && wordCount > 5) {
    flags.push("النبذة لا تذكر أي مؤشرات تتوافق مع نوع الحساب المختار");
  }

  if (bio.split("!").length > 4 || bio.split("؟").length > 4) {
    flags.push("أسلوب الكتابة مبالغ فيه (علامات تعجب أو استفهام مفرطة)");
  }

  const score = Math.max(0, Math.min(100,
    (wordCount >= 20 ? 40 : (wordCount / 20) * 40) +
    (relevant ? 30 : 0) +
    (genericMatches.length === 0 ? 20 : genericMatches.length <= 2 ? 10 : 0) +
    (flags.length === 0 ? 10 : 0)
  ));

  const quality: "good" | "weak" | "suspicious" =
    flags.length >= 3 ? "suspicious" : score >= 60 ? "good" : "weak";

  return { wordCount, score, flags, quality };
}

// ============================================================
// Main Handler
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const { app } = await req.json();

    if (!app) {
      return NextResponse.json({ error: "No application data provided" }, { status: 400 });
    }

    const basic = app.data_json?.basic || {};
    const specific = app.data_json?.type_specific || {};
    const proof = app.proof_json || {};

    // ── Run link analysis & bio analysis in parallel ──
    const [link1Result, link2Result, bioAnalysis] = await Promise.all([
      proof.proof_link_1
        ? analyzeLinkContent(proof.proof_link_1, app.account_type)
        : Promise.resolve<LinkAnalysisResult>({ ...EMPTY_LINK }),
      proof.proof_link_2
        ? analyzeLinkContent(proof.proof_link_2, app.account_type)
        : Promise.resolve<LinkAnalysisResult>({ ...EMPTY_LINK }),
      Promise.resolve(analyzeBio(basic.bio || "", app.account_type)),
    ]);

    // ── Local scoring ──
    const basicFields = [basic.full_name, basic.email, basic.phone, basic.country, basic.bio];
    const filledBasic = basicFields.filter(Boolean).length;
    const specificValues = Object.values(specific).filter((v) => v !== null && v !== undefined && v !== "");
    const filledSpecific = specificValues.length;
    const totalSpecific = Math.max(Object.keys(specific).length, 1);
    const completeness = ((filledBasic / basicFields.length) * 0.6 + (filledSpecific / totalSpecific) * 0.4) * 100;

    const hasLink1 = !!proof.proof_link_1;
    const hasLink2 = !!proof.proof_link_2;
    const hasFiles = (proof.file_urls?.length ?? 0) > 0;
    const hasNote = !!proof.note;
    const verificationScore =
      (hasLink1 ? (link1Result.reachable ? 45 : 20) : 0) +
      (hasLink2 ? (link2Result.reachable ? 25 : 10) : 0) +
      (hasFiles ? 20 : 0) +
      (hasNote ? 10 : 0);

    const descriptionScore = bioAnalysis.score;

    const accountTypeBonus: Record<string, number> = {
      merchant: 80, supplier: 80, small_business: 70, delivery: 75, supporter: 65,
    };
    const activityScore = accountTypeBonus[app.account_type] ?? 60;

    const finalScore = Math.round(
      completeness * 0.25 +
      verificationScore * 0.35 +
      descriptionScore * 0.2 +
      activityScore * 0.2
    );

    // ── Build local flags ──
    const localFlags: string[] = [];
    if (!hasLink1 && !hasFiles) localFlags.push("لا يوجد إثبات مرفق");
    if (hasLink1 && !link1Result.reachable) localFlags.push(`الرابط الأول لا يفتح: ${link1Result.error || "غير متاح"}`);
    if (hasLink2 && !link2Result.reachable) localFlags.push(`الرابط الثاني لا يفتح: ${link2Result.error || "غير متاح"}`);
    if (hasLink1 && link1Result.reachable && link1Result.relevanceHint?.includes("لم يُرصد")) {
      localFlags.push("محتوى الرابط الأول لا يتوافق مع نوع الحساب");
    }
    localFlags.push(...bioAnalysis.flags);
    if (filledBasic < 4) localFlags.push("بيانات أساسية غير مكتملة");
    if (!basic.phone) localFlags.push("رقم الهاتف مفقود");

    // ── Build AI context ──
    const linkContext = (label: string, r: LinkAnalysisResult): string => {
      if (!r || r.error === "لا يوجد رابط") return `${label}: غير مرفق`;
      if (!r.reachable) return `${label}: ❌ لا يفتح (${r.error}) — المنصة: ${r.platform || "غير معروف"}`;
      return [
        `${label}: ✅ يفتح — المنصة: ${r.platform || "موقع عام"}`,
        r.title ? `  العنوان: ${r.title}` : null,
        r.description ? `  الوصف: ${r.description.substring(0, 200)}` : null,
        r.contentSnippet ? `  محتوى مقتطف: ${r.contentSnippet.substring(0, 300)}` : null,
        r.relevanceHint ? `  التوافق مع الحساب: ${r.relevanceHint}` : null,
      ].filter(Boolean).join("\n");
    };

    const appContext = `
معلومات الطلب:
- الاسم الكامل: ${basic.full_name || "غير محدد"}
- البريد الإلكتروني: ${basic.email || "غير محدد"}
- رقم الهاتف: ${basic.phone || "غير محدد"}
- الدولة: ${basic.country || "غير محدد"}
- نوع الحساب: ${accountTypeLabel[app.account_type] || app.account_type}
- نبذة عن المشروع: ${basic.bio || "لا يوجد وصف"}
- بيانات إضافية: ${JSON.stringify(specific, null, 2)}

تحليل النبذة:
- عدد الكلمات: ${bioAnalysis.wordCount}
- جودة النبذة: ${bioAnalysis.quality === "good" ? "جيدة" : bioAnalysis.quality === "weak" ? "ضعيفة" : "مشبوهة"}
- نقاط النبذة: ${bioAnalysis.score}/100
- ملاحظات على النبذة: ${bioAnalysis.flags.length > 0 ? bioAnalysis.flags.join("، ") : "لا ملاحظات"}

تحليل الروابط:
${linkContext("الرابط الأول", link1Result)}
${linkContext("الرابط الثاني", link2Result)}
- عدد الملفات المرفوعة: ${proof.file_urls?.length ?? 0}
- ملاحظة الإثبات: ${proof.note || "لا يوجد"}

نتائج الخوارزمية المحلية:
- النقاط المحسوبة: ${finalScore}/100
- اكتمال البيانات الأساسية: ${Math.round((filledBasic / basicFields.length) * 100)}%
- اكتمال البيانات الإضافية: ${Math.round((filledSpecific / totalSpecific) * 100)}%
- درجة التحقق والإثبات: ${verificationScore}/100
- العلامات المرصودة: ${localFlags.length > 0 ? localFlags.join("، ") : "لا توجد"}
`;

    const systemPrompt = `أنت محلل طلبات تسجيل في منصة تجارية متخصص وذو خبرة عالية. مهمتك تحليل طلبات التسجيل وإعطاء تقييم دقيق بلغة عربية واضحة وطبيعية تماماً كما يحكي إنسان خبير.

لديك:
1. بيانات كاملة للطلب
2. تحليل مفصّل للنبذة (الجودة، التوافق، المؤشرات)
3. نتائج فحص الروابط الفعلية (هل تفتح؟ ما محتواها؟ هل تتوافق مع نوع الحساب؟)
4. نتائج خوارزمية حاسوبية

استخدم كل هذه المعطيات معاً لتكوين رأيك. عليك تحديداً:
- تقييم ما إذا كانت النبذة واضحة ومنطقية وتصف نشاطاً حقيقياً
- تقييم الروابط: هل تفتح؟ هل محتواها يؤكد هوية المتقدم ونشاطه؟
- ربط كل هذه المؤشرات ببعضها لاتخاذ موقف واضح

أجب فقط بـ JSON بهذا الشكل بالضبط بدون أي نص خارجه أو markdown:
{
  "score": <رقم من 0 إلى 100>,
  "recommendation": "<approve|review|reject>",
  "risk": "<low|medium|high>",
  "summary": "<جملة أو جملتان تلخصان الطلب بشكل سريع>",
"project_summary": "<جملة واحدة أو اثنتين: اسم الشخص + نوع حسابه + ماذا يبيع أو يعمل (من type_specific) + الدولة والمدينة. مثال: أحمد علي، تاجر جملة متخصص في الملابس الرجالية، من الأردن، عمّان>"  "bio_analysis": "<جملة أو جملتان عن جودة النبذة ومدى منطقيتها وتوافقها مع نوع الحساب>",
  "link_analysis": "<جملة أو جملتان عن نتيجة فحص الروابط ومدى تأكيدها لهوية المتقدم>",
  "strengths": ["<نقطة قوة>"],
  "weaknesses": ["<نقطة ضعف>"],
  "flags": ["<علامة تستحق الانتباه>"],
  "decision_hint": "<جملة واحدة مباشرة للمدير تقول ماذا تنصحه وسبب واضح>"
}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.35,
        max_tokens: 1400,
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

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch {
      return NextResponse.json({ error: "Failed to parse Groq response", raw }, { status: 500 });
    }

    return NextResponse.json({
      score: parsed.score ?? finalScore,
      recommendation: parsed.recommendation ?? "review",
      risk: parsed.risk ?? "medium",
      summary: parsed.summary ?? "—",
project_summary: parsed.project_summary ?? 
  [
    basic.full_name,
    accountTypeLabel[app.account_type],
    Object.values(specific).filter(Boolean).slice(0, 2).join("، "),
    basic.country,
    basic.city,
  ].filter(Boolean).join(" — "),      bio_analysis: parsed.bio_analysis ?? "—",
      link_analysis: parsed.link_analysis ?? "—",
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      flags: [...new Set([...(parsed.flags ?? []), ...localFlags])],
      decision_hint: parsed.decision_hint ?? "—",
      local_score: finalScore,
      _meta: {
        bioQuality: bioAnalysis.quality as "good" | "weak" | "suspicious",
        bioScore: bioAnalysis.score,
        link1: {
          url: (proof.proof_link_1 as string) ?? null,
          reachable: link1Result.reachable,
          platform: link1Result.platform,
          relevanceHint: link1Result.relevanceHint,
          error: link1Result.error,
        },
        link2: {
          url: (proof.proof_link_2 as string) ?? null,
          reachable: link2Result.reachable,
          platform: link2Result.platform,
          relevanceHint: link2Result.relevanceHint,
          error: link2Result.error,
        },
      },
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}