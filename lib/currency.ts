export const SUPPORTED_CURRENCIES = ["ILS", "USD", "JOD"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

const RATES_TO_ILS: Record<SupportedCurrency, number> = {
  ILS: 1,
  USD: 3.7,
  JOD: 5.22,
};

export function normalizeCurrency(value: unknown): SupportedCurrency {
  const currency = String(value || "").toUpperCase();
  return SUPPORTED_CURRENCIES.includes(currency as SupportedCurrency) ? (currency as SupportedCurrency) : "ILS";
}

export function currencyFromCountry(country?: string | null): SupportedCurrency {
  const normalized = String(country || "").trim().toLowerCase();
  if (["jordan", "الأردن", "الاردن"].includes(normalized)) return "JOD";
  if (["united states", "usa", "us", "الولايات المتحدة"].includes(normalized)) return "USD";
  return "ILS";
}

export function convertCurrency(amount: number, from: unknown, to: unknown) {
  const source = normalizeCurrency(from);
  const target = normalizeCurrency(to);
  const value = Number(amount || 0);
  if (source === target) return value;
  return Number(((value * RATES_TO_ILS[source]) / RATES_TO_ILS[target]).toFixed(2));
}

export function formatMoney(amount: number, currency: unknown) {
  return `${Number(amount || 0).toFixed(2)} ${normalizeCurrency(currency)}`;
}
