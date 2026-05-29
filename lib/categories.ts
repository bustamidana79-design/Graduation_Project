export const categories = [
  { value: "clothes", label: "ملابس" },
  { value: "electronics", label: "إلكترونيات" },
  { value: "food", label: "مواد غذائية" },
  { value: "home", label: "مستلزمات منزلية" },
  { value: "office", label: "أدوات مكتبية" },
  { value: "packaging", label: "مواد تغليف" },
  { value: "restaurant", label: "مستلزمات مطاعم" },
  { value: "retail", label: "مستلزمات متاجر" },
  { value: "logistics", label: "خدمات شحن" },
  { value: "industrial", label: "أدوات صناعية" },
  { value: "raw", label: "مواد خام" },
  { value: "spare_parts", label: "قطع غيار" },
  { value: "cosmetics", label: "مستحضرات تجميل" },
  { value: "health", label: "منتجات صحية" },
  { value: "gifts", label: "هدايا وإكسسوارات" },
] as const;

export type CategoryValue = (typeof categories)[number]["value"];

export const userTypeToCategories: Record<string, CategoryValue[]> = {
  restaurant: ["food", "restaurant", "packaging"],
  clothing_store: ["clothes", "gifts", "packaging"],
  electronics_store: ["electronics", "spare_parts"],
  food: ["food", "restaurant", "packaging"],
  fashion: ["clothes", "gifts", "cosmetics"],
  ecommerce: ["retail", "packaging", "logistics"],
  services: ["office", "retail"],
  technology: ["electronics", "office"],
  education: ["office", "electronics"],
  health: ["health", "cosmetics"],
  crafts: ["raw", "gifts", "packaging"],
  beauty: ["cosmetics", "health"],
  tourism: ["gifts", "logistics"],
  agriculture: ["raw", "industrial", "packaging"],
};

const categoryAliases: Record<string, CategoryValue[]> = {
  clothes: ["clothes"],
  clothing: ["clothes"],
  fashion: ["clothes"],
  apparel: ["clothes"],
  food: ["food"],
  restaurant: ["restaurant"],
  restaurants: ["restaurant"],
  electronics: ["electronics"],
  technology: ["electronics"],
  perfumes: ["cosmetics"],
  beauty: ["cosmetics"],
  cosmetics: ["cosmetics"],
  furniture: ["home"],
  home: ["home"],
  books: ["office"],
  tools: ["industrial"],
  jewelry: ["gifts"],
  toys: ["gifts"],
  sports: ["gifts"],
  shipping: ["logistics"],
  logistics: ["logistics"],
};

export function normalizeCategory(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return categoryAliases[normalized]?.[0] || normalized;
}

export function getCategoryMatches(value?: string | null) {
  const normalized = String(value || "").trim().toLowerCase();
  return categoryAliases[normalized] || (normalized ? [normalized] : []);
}

export function categoryMatches(productCategory?: string | null, expectedCategory?: string | null) {
  if (!expectedCategory) return true;
  return getCategoryMatches(expectedCategory).includes(normalizeCategory(productCategory) as CategoryValue);
}

export function getRecommendedCategoriesForUserType(userType?: string | null) {
  const normalized = String(userType || "").trim().toLowerCase();
  return userTypeToCategories[normalized] || getCategoryMatches(normalized);
}

export function getCategoryLabel(value?: string | null) {
  const normalized = normalizeCategory(value);
  return categories.find((category) => category.value === normalized)?.label || value || "";
}
