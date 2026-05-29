import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { confirmPayment } from "@/lib/services/payment.service";

function verifyWebhookSecret(request: NextRequest) {
  const expectedSecret = process.env.TALER_WEBHOOK_SECRET?.trim();
  if (!expectedSecret) return true;

  const receivedSecret =
    request.headers.get("x-taler-webhook-secret") ||
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  return receivedSecret === expectedSecret;
}

function parseWebhookText(text: string) {
  if (!text.trim()) return {};

  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function getTalerOrderId(payload: Record<string, any>, request: NextRequest) {
  const requestUrl = new URL(request.url);
  return String(
    payload.order_id ||
      payload.orderId ||
      payload.provider_payment_id ||
      payload.providerPaymentId ||
      requestUrl.searchParams.get("order_id") ||
      requestUrl.searchParams.get("provider_payment_id") ||
      ""
  ).trim();
}

async function handleTalerWebhook(request: NextRequest) {
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  const payload = parseWebhookText(await request.text());
  const talerOrderId = getTalerOrderId(payload, request);

  if (!talerOrderId) {
    return NextResponse.json({ error: "Missing Taler order_id." }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const payments = await confirmPayment(supabase, null, talerOrderId);

  return NextResponse.json({
    success: true,
    provider_payment_id: talerOrderId,
    payments_updated: payments.length,
  });
}

export async function POST(request: NextRequest) {
  try {
    return await handleTalerWebhook(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process payment webhook.";
    const status =
      message === "PAYMENT_NOT_FOUND"
        ? 404
        : message === "PAYMENT_NOT_PAID"
          ? 202
          : message === "Taler service unavailable"
            ? 503
            : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

export async function GET(request: NextRequest) {
  try {
    return await handleTalerWebhook(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to process payment webhook.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
