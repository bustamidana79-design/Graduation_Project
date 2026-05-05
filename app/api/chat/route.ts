import { NextRequest, NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import Groq from "groq-sdk";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";
type ChatRole = "user" | "assistant";

type ChatMessage = {
  role: ChatRole;
  message: string;
};

type KnowledgeItem = {
  title: string;
  content: string;
  category: string | null;
  account_type: AccountType | "all" | null;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "تاجر أو مورد",
  small_business: "صاحب مشروع صغير",
  delivery: "شركة شحن وتوصيل",
  supporter: "داعم أو مستثمر",
  admin: "مدير منصة",
};

const accountTypeGuidance: Record<AccountType, string> = {
  merchant:
    "ساعده في وصف المنتجات، التسعير، تحسين العرض، كتابة ردود العملاء، بناء حملات سوشال ميديا، واقتراح طرق لزيادة الطلبات.",
  small_business:
    "ساعده في إيجاد موردين مناسبين، اختيار منتجات، التسويق بميزانية قليلة، كتابة محتوى للسوشال ميديا، وتحويل الفكرة إلى خطوات عملية.",
  delivery:
    "ساعده في تحسين خدمة العملاء، صياغة ردود الشحن، تسويق خدمات التوصيل للتجار والمشاريع، وتقليل الشكاوى والتأخير.",
  supporter:
    "ساعده في تقييم المشاريع، مقارنة فرص الدعم، تحديد الأسئلة المهمة قبل الدعم، وصياغة رسائل تواصل مهنية.",
  admin:
    "ساعده في تلخيص طلبات التسجيل، كتابة ملاحظات مراجعة، صياغة أسباب القبول أو الرفض، وتحسين رسائل الإدارة والدعم.",
};

function normalizeAccountType(value: string | null | undefined): AccountType | null {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === "merchant" ||
    normalized === "small_business" ||
    normalized === "delivery" ||
    normalized === "supporter" ||
    normalized === "admin"
  ) {
    return normalized;
  }

  return null;
}

function compactRows(rows: unknown[] | null | undefined, max = 5) {
  if (!rows || rows.length === 0) return "لا توجد بيانات متاحة.";
  return JSON.stringify(rows.slice(0, max));
}

async function safeSelect(table: string, query: (tableName: string) => PromiseLike<{ data: unknown[] | null }>) {
  try {
    const { data } = await query(table);
    return data || [];
  } catch {
    return [];
  }
}

function createSupabaseClient(req: NextRequest) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: req.headers.get("authorization") || "",
      },
    },
  });
}

function getSearchTerms(message: string) {
  return message
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 6);
}

async function buildKnowledgeContext(supabase: SupabaseClient, message: string, accountType: AccountType) {
  const terms = getSearchTerms(message);

  try {
    let query = supabase
      .from("ai_knowledge_base")
      .select("title, content, category, account_type")
      .eq("is_active", true)
      .in("account_type", ["all", accountType])
      .limit(6);

    if (terms.length > 0) {
      const orFilter = terms
        .flatMap((term) => [`title.ilike.%${term}%`, `content.ilike.%${term}%`, `category.ilike.%${term}%`])
        .join(",");
      query = query.or(orFilter);
    }

    const { data } = await query;
    const rows = (data || []) as KnowledgeItem[];

    if (rows.length === 0) {
      return "لا توجد مقالات معرفة مطابقة حالياً. استخدم قواعد المنصة العامة ولا تخترع تفاصيل غير موجودة.";
    }

    return rows
      .map(
        (item, index) =>
          `${index + 1}. العنوان: ${item.title}\nالتصنيف: ${item.category || "عام"}\nالمحتوى: ${item.content}`
      )
      .join("\n\n");
  } catch {
    return "تعذر تحميل قاعدة المعرفة حالياً. استخدم قواعد المنصة العامة ولا تخترع تفاصيل غير موجودة.";
  }
}

async function buildPlatformContext(supabase: SupabaseClient, profileId: string, accountType: AccountType) {
  const contextParts: string[] = [];

  const { data: socialAccounts } = await supabase
    .from("social_media_accounts")
    .select("*")
    .eq("profile_id", profileId);

  contextParts.push(
    `حسابات السوشال ميديا: ${
      socialAccounts && socialAccounts.length > 0 ? compactRows(socialAccounts) : "المستخدم لم يضف حسابات سوشال ميديا بعد."
    }`
  );

  if (accountType === "merchant") {
    const products = await safeSelect("products", (table) =>
      supabase.from(table).select("id, name, description, price, category").eq("supplier_id", profileId).limit(5)
    );
    contextParts.push(`منتجات هذا التاجر إن توفرت: ${compactRows(products)}`);
  }

  if (accountType === "small_business") {
    const suppliers = await safeSelect("supplier_profiles", (table) => supabase.from(table).select("*").limit(5));
    const products = await safeSelect("products", (table) =>
      supabase.from(table).select("id, name, description, price, category, supplier_id").limit(8)
    );
    contextParts.push(`أمثلة موردين متاحين: ${compactRows(suppliers)}`);
    contextParts.push(`أمثلة منتجات متاحة: ${compactRows(products, 8)}`);
  }

  if (accountType === "delivery") {
    const company = await safeSelect("shipping_company_profiles", (table) =>
      supabase.from(table).select("*").eq("profile_id", profileId).limit(1)
    );
    contextParts.push(`بيانات شركة الشحن إن توفرت: ${compactRows(company, 1)}`);
  }

  if (accountType === "supporter") {
    const businesses = await safeSelect("small_business_profiles", (table) => supabase.from(table).select("*").limit(5));
    contextParts.push(`أمثلة مشاريع صغيرة على المنصة: ${compactRows(businesses)}`);
  }

  if (accountType === "admin") {
    const applications = await safeSelect("applications", (table) =>
      supabase
        .from(table)
        .select("id, account_type, status, created_at, data_json")
        .order("created_at", { ascending: false })
        .limit(5)
    );
    const upgrades = await safeSelect("upgrade_requests", (table) =>
      supabase.from(table).select("*").order("created_at", { ascending: false }).limit(5)
    );
    contextParts.push(`آخر طلبات التسجيل: ${compactRows(applications)}`);
    contextParts.push(`آخر طلبات الترقية: ${compactRows(upgrades)}`);
  }

  return contextParts.join("\n");
}

function buildSystemPrompt(accountType: AccountType, platformContext: string, knowledgeContext: string) {
  return `
أنت مساعد الأعمال الذكي داخل منصة B2B عربية.
تتحدث بالعربية دائماً، وبأسلوب عملي وواضح ومباشر.

نوع حساب المستخدم: ${accountTypeLabels[accountType]}.
دورك لهذا المستخدم: ${accountTypeGuidance[accountType]}

قدراتك الأساسية:
- الإجابة على أسئلة الدعم واستخدام المنصة.
- تقديم نصائح تسويق واقعية للمشاريع في الحياة وعلى السوشال ميديا.
- كتابة بوستات، Bio، أفكار Reels وStories، وخطط محتوى أسبوعية.
- تحسين وصف المنتجات أو الخدمات.
- اقتراح تسعير أو عروض بشكل إرشادي غير ملزم.
- اقتراح موردين أو منتجات أو شركات شحن أو داعمين عندما تتوفر بيانات.
- مساعدة الإدارة في التلخيص وصياغة الملاحظات والقرارات.

قواعد مهمة:
- اعتمد أولاً على قاعدة معرفة المنصة والسياق المرفق.
- لا تخترع بيانات من المنصة. إذا لم تكن البيانات موجودة، قل ذلك واقترح طريقة عامة أو اسأل المستخدم عن التفاصيل.
- اجعل الإجابة قابلة للتنفيذ: خطوات، أمثلة نصوص جاهزة، أو قائمة قصيرة.
- عندما يكون السؤال عن سعر أو قرار إداري أو دعم مالي، وضّح أن الإجابة إرشادية وتحتاج مراجعة بشرية.
- لا تطلب معلومات حساسة مثل كلمات المرور أو بيانات الدفع.

قاعدة معرفة المنصة:
${knowledgeContext}

سياق مختصر من المنصة:
${platformContext}
`.trim();
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseClient(req);
    const { message, sessionId, profileId, accountType: requestedAccountType } = (await req.json()) as {
      message?: string;
      sessionId?: string;
      profileId?: string;
      accountType?: string;
    };

    if (!message?.trim() || !sessionId || !profileId) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const cleanMessage = message.trim();

    const { data: profile } = await supabase
      .from("profiles")
      .select("account_type, full_name")
      .eq("id", profileId)
      .maybeSingle();

    const accountType =
      normalizeAccountType((profile as { account_type?: string } | null)?.account_type) ||
      normalizeAccountType(requestedAccountType) ||
      "small_business";

    await supabase.from("ai_chat_messages").insert({
      session_id: sessionId,
      role: "user",
      message: cleanMessage,
    });

    const { data: history } = await supabase
      .from("ai_chat_messages")
      .select("role, message")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .limit(20);

    const [platformContext, knowledgeContext] = await Promise.all([
      buildPlatformContext(supabase, profileId, accountType),
      buildKnowledgeContext(supabase, cleanMessage, accountType),
    ]);

    const messages = [
      {
        role: "system" as const,
        content: buildSystemPrompt(accountType, platformContext, knowledgeContext),
      },
      ...(((history || []) as ChatMessage[]).map((item) => ({
        role: item.role,
        content: item.message,
      })) || []),
    ];

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 1100,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || "عذراً، لم أستطع توليد رد مناسب.";

    const { data: assistantMessage } = await supabase
      .from("ai_chat_messages")
      .insert({
        session_id: sessionId,
        role: "assistant",
        message: reply,
      })
      .select("id")
      .single();

    return NextResponse.json({ reply, messageId: assistantMessage?.id || null });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "حدث خطأ غير متوقع في المساعد الذكي" }, { status: 500 });
  }
}
