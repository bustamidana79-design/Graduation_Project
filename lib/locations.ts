import { City } from "country-state-city";

export const ARAB_COUNTRY_NAMES: Record<string, string> = {
  PS: "فلسطين",
  JO: "الأردن",
  SA: "السعودية",
  EG: "مصر",
  AE: "الإمارات",
  KW: "الكويت",
  QA: "قطر",
  BH: "البحرين",
  OM: "عُمان",
  LB: "لبنان",
  SY: "سوريا",
  IQ: "العراق",
  MA: "المغرب",
  TN: "تونس",
  DZ: "الجزائر",
  LY: "ليبيا",
  YE: "اليمن",
  SD: "السودان",
  TR: "تركيا",
  DE: "ألمانيا",
  GB: "المملكة المتحدة",
  FR: "فرنسا",
  US: "الولايات المتحدة",
  CA: "كندا",
};

export const ARAB_CITIES_MAP: Record<string, string[]> = {
  JO: ["عمّان", "الزرقاء", "إربد", "العقبة", "السلط", "مادبا", "جرش", "الكرك"],
  SA: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الخبر", "تبوك", "أبها"],
  EG: ["القاهرة", "الإسكندرية", "الجيزة", "أسوان", "الأقصر", "بورسعيد", "السويس", "المنصورة"],
  AE: ["دبي", "أبوظبي", "الشارقة", "عجمان", "رأس الخيمة", "الفجيرة", "أم القيوين"],
  KW: ["الكويت", "حولي", "الفروانية", "الأحمدي", "الجهراء", "مبارك الكبير"],
  QA: ["الدوحة", "الوكرة", "الريان", "الخور", "أم صلال", "الشمال"],
  BH: ["المنامة", "المحرق", "الرفاع", "مدينة عيسى", "مدينة حمد", "سترة"],
  OM: ["مسقط", "صلالة", "نزوى", "صحار", "السيب", "مطرح"],
  LB: ["بيروت", "طرابلس", "صيدا", "صور", "زحلة", "جونية"],
  SY: ["دمشق", "حلب", "حمص", "حماة", "اللاذقية", "دير الزور", "درعا"],
  IQ: ["بغداد", "البصرة", "الموصل", "أربيل", "النجف", "كربلاء", "كركوك"],
  MA: ["الرباط", "الدار البيضاء", "فاس", "مراكش", "أكادير", "طنجة", "مكناس"],
  TN: ["تونس", "صفاقس", "سوسة", "قفصة", "بنزرت", "قابس"],
  DZ: ["الجزائر", "وهران", "قسنطينة", "عنابة", "بجاية", "سطيف"],
  LY: ["طرابلس", "بنغازي", "مصراتة", "الزاوية", "البيضاء", "سبها"],
  YE: ["صنعاء", "عدن", "تعز", "الحديدة", "إب", "ذمار"],
  SD: ["الخرطوم", "أم درمان", "بورتسودان", "كسلا", "الأبيض", "وادي حلفا"],
};

export const PALESTINIAN_CITIES = [
  "رام الله",
  "نابلس",
  "الخليل",
  "جنين",
  "طولكرم",
  "قلقيلية",
  "أريحا",
  "بيت لحم",
  "سلفيت",
  "طوباس",
  "غزة",
  "خان يونس",
  "رفح",
  "دير البلح",
  "بيت حانون",
  "القدس",
  "أبو ديس",
  "بيرزيت",
  "عنبتا",
  "يطا",
  "دورا",
  "بيت جالا",
  "بيت ساحور",
];

export const AREAS_BY_CITY: Record<string, string[]> = {};

export function getCountryCodeByArabicName(country?: string | null) {
  const normalized = String(country || "").trim();
  return Object.entries(ARAB_COUNTRY_NAMES).find(([, name]) => name === normalized)?.[0] || "";
}

export function getCountryNameByCode(code?: string | null) {
  return ARAB_COUNTRY_NAMES[String(code || "").trim()] || "";
}

export function getCitiesByCountryCode(countryCode?: string | null) {
  const code = String(countryCode || "").trim();
  if (!code) return [];
  if (code === "PS") return PALESTINIAN_CITIES;
  if (ARAB_CITIES_MAP[code]) return ARAB_CITIES_MAP[code];
  return City.getCitiesOfCountry(code)?.map((city) => city.name) ?? [];
}

export function getCitiesByCountryName(country?: string | null) {
  return getCitiesByCountryCode(getCountryCodeByArabicName(country));
}
