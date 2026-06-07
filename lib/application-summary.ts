import { getCategoryLabel } from "./categories";

type BasicApplicationData = {
  full_name?: unknown;
  country?: unknown;
  city?: unknown;
  bio?: unknown;
};

type ApplicationSummaryInput = {
  account_type?: unknown;
  data_json?: {
    basic?: BasicApplicationData;
    type_specific?: Record<string, unknown>;
  } | null;
};

const accountTypeLabels: Record<string, string> = {
  merchant: "تاجر",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};

const projectStageLabels: Record<string, string> = {
  idea: "فكرة",
  running: "يعمل حاليا",
  scaling: "مرحلة توسع",
};

const projectFieldLabels: Record<string, string> = {
  food: "مطاعم وأغذية",
  ecommerce: "التجارة الإلكترونية",
  services: "الخدمات",
  technology: "التقنية والبرمجة",
  education: "التعليم والتدريب",
  health: "الصحة والعناية",
  fashion: "الأزياء والموضة",
  crafts: "الحرف اليدوية",
  beauty: "التجميل",
  tourism: "السياحة والسفر",
  agriculture: "الزراعة",
};

const deliveryScopeLabels: Record<string, string> = {
  local: "محلي",
  international: "دولي",
  international_local: "محلي ودولي",
};

const supportTypeLabels: Record<string, string> = {
  financial: "دعم مالي",
  consulting: "استشارات",
  partnerships: "شراكات",
};

const needLabels: Record<string, string> = {
  suppliers: "موردين",
  marketing: "تسويق",
  funding: "تمويل",
  partnerships: "شراكات",
};

function readString(record: Record<string, unknown> | BasicApplicationData, key: string) {
  const value = record[key as keyof typeof record];
  return typeof value === "string" ? value.trim() : "";
}

function readStringList(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return typeof value === "string" && value.trim() ? [value.trim()] : [];
}

function labelFor(value: string, labels: Record<string, string>) {
  const normalized = value.trim();
  return labels[normalized] || labels[normalized.toLowerCase()] || normalized;
}

function joinArabicList(items: string[]) {
  const cleanItems = items.map((item) => item.trim()).filter(Boolean);
  if (cleanItems.length <= 2) return cleanItems.join("، ");
  return `${cleanItems.slice(0, -1).join("، ")}، و${cleanItems[cleanItems.length - 1]}`;
}

function shorten(text: string, maxLength = 180) {
  const cleanText = text.replace(/\s+/g, " ").trim();
  if (cleanText.length <= maxLength) return cleanText;

  const softCut = cleanText.slice(0, maxLength);
  const lastSpace = softCut.lastIndexOf(" ");
  return `${softCut.slice(0, lastSpace > 80 ? lastSpace : maxLength).trim()}...`;
}

function withPeriod(text: string) {
  const trimmed = text.trim().replace(/[،,\s]+$/u, "");
  return /[.!؟]$/u.test(trimmed) ? trimmed : `${trimmed}.`;
}

function cleanBio(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/^(نبذة\s*(المستخدم|تعريفية|عن\s+النشاط|عن\s+المشروع)?|وصف\s*(النشاط|المشروع)?)\s*[:：-]\s*/iu, "")
    .trim();
}

function summarizeBio(text: string, maxLength = 210) {
  const cleaned = cleanBio(text);
  if (!cleaned) return "";

  const sentenceMatch = cleaned.match(/^(.{70,230}?[.!؟])(?:\s|$)/u);
  return withPeriod(shorten(sentenceMatch?.[1] || cleaned, maxLength));
}

function hasActivityIdentity(text: string, name?: string) {
  const normalized = text.toLowerCase();
  const normalizedName = name?.trim().toLowerCase();

  return Boolean(
    (normalizedName && normalized.includes(normalizedName)) ||
      /(^|\s)(مشروع|متجر|شركة|علامة|منصة|مبادرة|نشاط)(?=$|\s|[،,.!؟])/u.test(text)
  );
}

function buildSummaryFromBio(params: {
  name?: string;
  activityLabel: string;
  field?: string;
  bio: string;
}) {
  const bioSummary = summarizeBio(params.bio);
  if (!bioSummary) return "";
  if (hasActivityIdentity(bioSummary, params.name)) return bioSummary;

  const namePrefix = params.name ? `"${params.name}" ` : "";
  const fieldPart = params.field ? ` في مجال ${params.field}` : "";
  const intro = `${namePrefix}${params.activityLabel}${fieldPart}`;
  return withPeriod(`${intro}، ${bioSummary.replace(/[.!؟]$/u, "")}`);
}

export function buildApplicationProjectSummary(app: ApplicationSummaryInput) {
  const accountType = typeof app.account_type === "string" ? app.account_type : "";
  const basic = app.data_json?.basic || {};
  const typeSpecific = app.data_json?.type_specific || {};
  const fullName = readString(basic, "full_name");
  const country = readString(basic, "country");
  const city = readString(basic, "city");
  const bio = readString(basic, "bio");
  const location = [city, country].filter(Boolean).join("، ");
  const sentences: string[] = [];

  if (accountType === "small_business") {
    const projectName = readString(typeSpecific, "project_name");
    const projectField = labelFor(readString(typeSpecific, "project_field"), projectFieldLabels);
    const projectStage = labelFor(readString(typeSpecific, "project_stage"), projectStageLabels);
    const needs = readStringList(typeSpecific, "needs").map((need) => labelFor(need, needLabels));
    const summaryFromBio = buildSummaryFromBio({
      name: projectName,
      activityLabel: "مشروع",
      field: projectField,
      bio,
    });

    if (summaryFromBio) {
      return summaryFromBio;
    } else if (projectName && projectField) {
      sentences.push(`مشروع "${projectName}" يعمل في مجال ${projectField}.`);
    } else if (projectName) {
      sentences.push(`مشروع "${projectName}".`);
    } else if (projectField) {
      sentences.push(`مشروع صغير في مجال ${projectField}.`);
    }
    if (!sentences.length && projectStage) sentences.push(`مشروع صغير في مرحلة ${projectStage}.`);
    if (!sentences.length && needs.length) sentences.push(`مشروع صغير يحتاج إلى ${joinArabicList(needs)}.`);
  } else if (accountType === "merchant") {
    const storeName = readString(typeSpecific, "store_name");
    const productCategory = getCategoryLabel(readString(typeSpecific, "product_category"));
    const commercialRegNo = readString(typeSpecific, "commercial_reg_no");
    const summaryFromBio = buildSummaryFromBio({
      name: storeName,
      activityLabel: "متجر",
      field: productCategory,
      bio,
    });

    if (summaryFromBio) {
      return summaryFromBio;
    } else if (storeName && productCategory) {
      sentences.push(`متجر "${storeName}" يقدّم منتجات ضمن فئة ${productCategory}.`);
    } else if (storeName) {
      sentences.push(`متجر أو علامة تجارية باسم "${storeName}".`);
    } else if (productCategory) {
      sentences.push(`تاجر يعمل ضمن فئة ${productCategory}.`);
    }
    if (!sentences.length && commercialRegNo) sentences.push(`تاجر قدّم رقم سجل تجاري للمراجعة.`);
  } else if (accountType === "delivery") {
    const companyName = readString(typeSpecific, "company_name");
    const deliveryScope = labelFor(readString(typeSpecific, "delivery_scope"), deliveryScopeLabels);
    const deliveryCities = readStringList(typeSpecific, "delivery_cities");
    const avgDeliveryTime = readString(typeSpecific, "avg_delivery_time");
    const summaryFromBio = buildSummaryFromBio({
      name: companyName,
      activityLabel: "شركة توصيل",
      field: deliveryScope,
      bio,
    });

    if (summaryFromBio) {
      return summaryFromBio;
    } else if (companyName && deliveryScope) {
      sentences.push(`شركة "${companyName}" تقدم خدمات توصيل بنطاق ${deliveryScope}.`);
    } else if (companyName) {
      sentences.push(`شركة توصيل باسم "${companyName}".`);
    } else if (deliveryScope) {
      sentences.push(`شركة توصيل تقدم خدمات بنطاق ${deliveryScope}.`);
    }
    if (deliveryCities.length) sentences.push(`مناطق الخدمة: ${joinArabicList(deliveryCities)}.`);
    if (!sentences.length && avgDeliveryTime) sentences.push(`شركة توصيل بمتوسط وقت تسليم ${avgDeliveryTime}.`);
  } else if (accountType === "supporter") {
    const supportType = labelFor(readString(typeSpecific, "support_type"), supportTypeLabels);
    const fundingRange = readString(typeSpecific, "funding_range");
    const interests = readString(typeSpecific, "interests");
    const previousExperience = readString(typeSpecific, "previous_experience");
    const summaryFromBio = buildSummaryFromBio({
      name: fullName,
      activityLabel: "داعم أو مستثمر",
      field: supportType,
      bio,
    });

    if (summaryFromBio) {
      return summaryFromBio;
    } else if (supportType) {
      sentences.push(`داعم مهتم بتقديم ${supportType}.`);
    }
    if (!sentences.length && fundingRange) sentences.push(`داعم بنطاق تمويل أو دعم ${fundingRange}.`);
    if (interests) sentences.push(`مجال الاهتمام: ${interests}.`);
    if (!sentences.length && previousExperience) sentences.push(`داعم لديه خبرة سابقة: ${shorten(previousExperience, 120)}.`);
  } else if (fullName) {
    sentences.push(`${fullName} تقدم بطلب حساب من نوع ${accountTypeLabels[accountType] || "غير محدد"}.`);
  }

  if (!sentences.length && bio) sentences.push(summarizeBio(bio));
  if (sentences.length === 1 && location && accountType === "delivery") sentences.push(`منطقة العمل: ${location}.`);

  return sentences.join(" ") || "لا توجد تفاصيل كافية عن المشروع في بيانات الطلب.";
}
