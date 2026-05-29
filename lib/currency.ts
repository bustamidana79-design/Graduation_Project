export const SUPPORTED_CURRENCIES = ["ILS", "USD", "JOD", "EUR", "SAR", "AED", "EGP"] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];
export type ExchangeRates = Record<SupportedCurrency, number>;

export const DEFAULT_USD_RATES: ExchangeRates = {
  USD: 1,
  ILS: 3.7,
  JOD: 0.71,
  EUR: 0.92,
  SAR: 3.75,
  AED: 3.67,
  EGP: 48,
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

export function convertCurrency(amount: number, from: unknown, to: unknown, rates: ExchangeRates = DEFAULT_USD_RATES) {
  const source = normalizeCurrency(from);
  const target = normalizeCurrency(to);
  const value = Number(amount || 0);
  if (source === target) return value;
  const usdAmount = value / (rates[source] || DEFAULT_USD_RATES[source]);
  return Number((usdAmount * (rates[target] || DEFAULT_USD_RATES[target])).toFixed(2));
}

export function formatMoney(amount: number, currency: unknown) {
  return `${Number(amount || 0).toFixed(2)} ${normalizeCurrency(currency)}`;
}
