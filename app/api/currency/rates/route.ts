import { NextResponse } from "next/server";
import { getExchangeRates } from "@/lib/services/currency.service";

export async function GET() {
  const rates = await getExchangeRates();
  return NextResponse.json({ base: "USD", rates });
}
