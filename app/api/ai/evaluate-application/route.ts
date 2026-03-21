import { NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// كشف الايميلات المؤقتة
function isDisposableEmail(email: string) {
  const disposableDomains = [
    "tempmail.com",
    "10minutemail.com",
    "mailinator.com",
    "guerrillamail.com",
    "trashmail.com"
  ];
  const domain = email.split("@")[1];
  return disposableDomains.includes(domain);
}

// تحليل الموقع
async function analyzeWebsite(url: string) {
  if (!url) return { exists: false };
  try {
    const res = await fetch(url);
    if (!res.ok) return { exists: false };
    const html = await res.text();
    return { exists: true, contentLength: html.length };
  } catch {
    return { exists: false };
  }
}

// تحليل الانستغرام
function analyzeInstagram(link: string) {
  if (!link) return null;
  if (!link.includes("instagram.com")) return { valid: false };
  const username = link.split("instagram.com/")[1];
  return { valid: true, username };
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    const email = data.email || "";
    const website = data.website || "";
    const instagram = data.instagram || "";

    const websiteData = await analyzeWebsite(website);
    const instagramData = analyzeInstagram(instagram);
    const disposableEmail = isDisposableEmail(email);

    const enrichedData = {
      ...data,
      website_analysis: websiteData,
      instagram_analysis: instagramData,
      disposable_email: disposableEmail
    };

    const prompt = `
أنت نظام ذكاء اصطناعي متخصص في تقييم طلبات التسجيل لمنصة تجارية.

قم بتحليل الطلب التالي وحدد:

1. نقاط التقييم من 0 إلى 100
2. القرار (approve أو review أو reject) — أبقِ هذه القيم بالإنجليزي فقط
3. مستوى الخطر (low أو medium أو high) — أبقِ هذه القيم بالإنجليزي فقط
4. العلامات المشبوهة (بالعربي)
5. سبب القرار (بالعربي)

معايير التقييم:
- جودة وصف النشاط التجاري
- صحة اسم النشاط
- اكتمال البيانات
- وضوح التصنيف
- المحتوى المشبوه
- مصداقية الموقع الإلكتروني
- الحضور على وسائل التواصل الاجتماعي
- مصداقية البريد الإلكتروني
- صحة إثباتات النشاط

العلامات المشبوهة التي يجب اكتشافها (اكتبها بالعربي):
- روابط احتيالية
- نشاط تجاري وهمي
- وصف غير واضح
- وعود غير واقعية
- معلومات ناقصة
- حسابات تواصل اجتماعي مزيفة
- بريد إلكتروني مؤقت
- موقع إلكتروني غير متاح

بيانات الطلب:
${JSON.stringify(enrichedData)}

أرجع JSON فقط بدون أي نص إضافي أو backticks بهذا الشكل:

{
  "score": رقم,
  "decision": "approve | review | reject",
  "risk": "low | medium | high",
  "flags": ["علامة مشبوهة بالعربي"],
  "reason": "سبب القرار بالعربي"
}
`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    });

    const text = completion.choices[0].message.content;

    let result;
    try {
      const match = text?.match(/\{[\s\S]*\}/);
      result = JSON.parse(match ? match[0] : "{}");
    } catch {
      result = {
        score: 50,
        decision: "review",
        risk: "medium",
        flags: ["تعذر تحليل رد الذكاء الاصطناعي"],
        reason: "تعذر تحليل رد الذكاء الاصطناعي"
      };
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error("AI Error:", error);
    return NextResponse.json({
      score: 50,
      decision: "review",
      risk: "medium",
      flags: ["خطأ في الذكاء الاصطناعي"],
      reason: "فشل تقييم الذكاء الاصطناعي"
    });
  }
}