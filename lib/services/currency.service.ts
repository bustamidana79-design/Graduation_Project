import { DEFAULT_USD_RATES, type ExchangeRates } from "@/lib/currency";

const CACHE_MS = 20 * 60 * 1000;

let cachedRates: ExchangeRates | null = null;
let cachedAt = 0;

function pickSupportedRates(rates: Record<string, unknown>): ExchangeRates {
  return {
    USD: 1,
    ILS: Number(rates.ILS || DEFAULT_USD_RATES.ILS),
    JOD: Number(rates.JOD || DEFAULT_USD_RATES.JOD),
  };
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  if (cachedRates && Date.now() - cachedAt < CACHE_MS) {
    return cachedRates;
  }

  try {
    const response = await fetch("https://api.exchangerate.host/latest?base=USD", {
      next: { revalidate: CACHE_MS / 1000 },
    });
    if (!response.ok) throw new Error(`Exchange API failed: ${response.status}`);

    const data = await response.json();
    const rates = pickSupportedRates(data.rates || {});
    cachedRates = rates;
    cachedAt = Date.now();
    return rates;
  } catch {
    return cachedRates || DEFAULT_USD_RATES;
  }
}
