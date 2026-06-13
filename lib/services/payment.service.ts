import { createNotification } from "./notification.service";
import { clearUserCartProducts } from "./cart.service";
import { normalizeCurrency } from "@/lib/currency";

type SupabaseClient = {
  from: (table: string) => any;
};

function talerOrdersUrl(orderId?: string) {
  const baseUrl = (process.env.TALER_BACKEND_URL || "https://backend.demo.taler.net").replace(/\/$/, "");
  const instance = process.env.TALER_MERCHANT_INSTANCE?.trim() || "sandbox";

  if (!baseUrl || !process.env.TALER_API_KEY) {
    throw new Error("TALER_CONFIG_MISSING");
  }

  const instancePath = instance ? `/instances/${encodeURIComponent(instance)}` : "";
  return `${baseUrl}${instancePath}/private/orders${orderId ? `/${encodeURIComponent(orderId)}` : ""}`;
}

function isLocalUrl(value?: string) {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1";
  } catch {
    return false;
  }
}

function appPublicUrl() {
  const publicUrl = process.env.APP_PUBLIC_URL || process.env.NEXT_PUBLIC_APP_URL;
  console.log("[Taler] APP_PUBLIC_URL check", {
    appPublicUrl: process.env.APP_PUBLIC_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
    selectedPublicUrl: publicUrl,
  });

  if (publicUrl && !isLocalUrl(publicUrl) && !publicUrl.includes("YOUR-NGROK-URL")) {
    return publicUrl.replace(/\/$/, "");
  }

  console.log("[Taler] Missing public fulfillment URL", {
    appPublicUrl: process.env.APP_PUBLIC_URL,
    nextPublicAppUrl: process.env.NEXT_PUBLIC_APP_URL,
  });
  throw new Error("APP_PUBLIC_URL_REQUIRED");
}

function publicReturnUrl(returnUrl?: string) {
  const baseUrl = appPublicUrl();
  if (!returnUrl) return new URL("/payment/return", baseUrl).toString();
  if (!isLocalUrl(returnUrl)) return returnUrl;

  const localUrl = new URL(returnUrl);
  return new URL(`${localUrl.pathname}${localUrl.search}${localUrl.hash}`, baseUrl).toString();
}

function paymentConfirmUrl(paymentId: string, returnUrl?: string) {
  const url = new URL("/api/payment/confirm", appPublicUrl());
  url.searchParams.set("payment_id", paymentId);
  url.searchParams.set("return_url", publicReturnUrl(returnUrl));
  return url.toString();
}

function talerHeaders() {
  return {
    Authorization: `Bearer ${process.env.TALER_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function readTalerResponse(response: Response, endpoint: string, label: string) {
  const responseText = await response.text();
  const logBody = responseText.length > 2000 ? `${responseText.slice(0, 2000)}... [truncated]` : responseText;
  console.log(`[Taler] ${label} response`, {
    endpoint,
    status: response.status,
    statusText: response.statusText,
    body: logBody,
  });

  if (!response.ok) {
    throw new Error(`TALER_${label.toUpperCase().replace(/\s+/g, "_")}_FAILED: ${response.status} ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}

function isReusableTalerPayment(payment: any) {
  return (
    payment?.payment_provider === "taler" &&
    payment?.payment_method === "taler" &&
    Boolean(payment?.provider_payment_id) &&
    Boolean(payment?.payment_url) &&
    !String(payment.payment_url).startsWith("taler://") &&
    !String(payment.payment_url).includes("/api/payment/confirm")
  );
}

function canReuseTalerPaymentGroup(payments: any[]) {
  const primary = payments[0];
  if (!isReusableTalerPayment(primary)) return false;

  return payments.every(
    (payment) =>
      isReusableTalerPayment(payment) &&
      payment.provider_payment_id === primary.provider_payment_id &&
      payment.payment_url === primary.payment_url
  );
}

async function createTalerPayment(params: { amount: number; paymentId: string; currency: string; returnUrl?: string }) {
  let response: Response;
  const endpoint = talerOrdersUrl();
  const talerCurrency = process.env.TALER_CURRENCY || params.currency;
  console.log("[Taler] Using create order endpoint", {
    method: "POST",
    endpoint,
  });

  const requestBody = {
    order: {
      amount: `${talerCurrency}:${params.amount.toFixed(2)}`,
      summary: "Order payment",
      fulfillment_url: paymentConfirmUrl(params.paymentId, params.returnUrl),
    },
    create_token: false,
  };

  console.log("[Taler] Creating order", {
    method: "POST",
    endpoint,
    amount: requestBody.order.amount,
    fulfillment_url: requestBody.order.fulfillment_url,
  });

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: talerHeaders(),
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    const cause = error instanceof Error && "cause" in error ? error.cause : undefined;
    console.log("[Taler] Request failed before response", {
      endpoint,
      error: error instanceof Error ? error.message : error,
      cause,
    });
    throw error instanceof Error ? error : new Error("TALER_REQUEST_FAILED");
  }

  const data = await readTalerResponse(response, endpoint, "create order");
  if (!data.order_id) throw new Error("TALER_ORDER_ID_MISSING");
  let paymentUrl = data.payment_redirect_url || data.order_status_url || data.taler_pay_uri;

  if (!paymentUrl) {
    const statusEndpoint = talerOrdersUrl(data.order_id);
    const statusResponse = await fetch(statusEndpoint, {
      method: "GET",
      headers: talerHeaders(),
    });
    const statusData = await readTalerResponse(statusResponse, statusEndpoint, "order status");
    paymentUrl = statusData.payment_redirect_url || statusData.order_status_url || statusData.taler_pay_uri;
  }

  if (!paymentUrl) throw new Error("TALER_PAYMENT_URL_MISSING");

  return {
    providerPaymentId: data.order_id,
    provider: "taler",
    paymentUrl,
  };
}

async function verifyTalerPayment(providerPaymentId: string) {
  let response: Response;

  try {
    response = await fetch(talerOrdersUrl(providerPaymentId), {
      method: "GET",
      headers: talerHeaders(),
    });
  } catch {
    throw new Error("Taler service unavailable");
  }

  if (!response.ok) {
    const details = await response.text();
    if (response.status >= 500) throw new Error("Taler service unavailable");
    throw new Error(`TALER_CONFIRM_FAILED: ${response.status} ${details}`);
  }

  const data = await response.json();
  const status = String(data.order_status || "").toLowerCase();
  const isPaid = status === "paid" || data.paid === true;

  if (!isPaid) {
    throw new Error("PAYMENT_NOT_PAID");
  }

  return data;
}

async function getPaymentsForConfirmation(
  supabase: SupabaseClient,
  paymentId?: string | null,
  providerPaymentId?: string | null
) {
  if (providerPaymentId) {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("provider_payment_id", providerPaymentId);

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("PAYMENT_NOT_FOUND");
    return data;
  }

  if (!paymentId) throw new Error("PAYMENT_NOT_FOUND");

  const { data: primaryPayment, error: primaryError } = await supabase
    .from("payments")
    .select("*")
    .eq("id", paymentId)
    .single();

  if (primaryError || !primaryPayment) throw new Error("PAYMENT_NOT_FOUND");

  const talerPaymentId = primaryPayment.provider_payment_id;
  if (!talerPaymentId) return [primaryPayment];

  const { data: relatedPayments, error: relatedError } = await supabase
    .from("payments")
    .select("*")
    .eq("provider_payment_id", talerPaymentId);

  if (relatedError) throw new Error(relatedError.message);
  return relatedPayments?.length ? relatedPayments : [primaryPayment];
}

export async function createPayment(
  supabase: SupabaseClient,
  buyerId: string,
  orderIds: string[],
  returnUrl?: string,
  requestedCurrency?: string
) {
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) throw new Error("ORDER_REQUIRED");

  const { data: orders, error } = await supabase
    .from("orders")
    .select("*")
    .in("id", ids)
    .eq("buyer_id", buyerId);

  if (error) throw new Error(error.message);
  if (!orders || orders.length !== ids.length) throw new Error("ORDER_NOT_FOUND");

  const currency = normalizeCurrency(requestedCurrency || orders[0]?.currency);
  const amount = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const paymentRows = [];

  for (const order of orders) {
    const existing = await supabase
      .from("payments")
      .select("*")
      .eq("order_id", order.id)
      .neq("payment_status", "paid")
      .limit(1)
      .maybeSingle();

    if (existing.error && existing.error.code !== "PGRST116") throw new Error(existing.error.message);
    if (existing.data) {
      paymentRows.push(existing.data);
      continue;
    }

    const inserted = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        amount: Number(order.total_amount || 0),
        currency: normalizeCurrency(order.currency || currency),
        payment_provider: "taler",
        payment_method: "taler",
        payment_status: "pending",
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "Failed to create payment.");
    paymentRows.push(inserted.data);
  }

  const primaryPayment = paymentRows[0];
  if (canReuseTalerPaymentGroup(paymentRows)) {
    return {
      payments: paymentRows,
      amount,
      currency,
      payment_url: primaryPayment.payment_url,
      provider_payment_id: primaryPayment.provider_payment_id,
      primary_payment_id: primaryPayment.id,
      provider: primaryPayment.payment_provider || "taler",
    };
  }

  const taler = await createTalerPayment({ amount, paymentId: primaryPayment.id, currency, returnUrl });

  for (const payment of paymentRows) {
    const updated = await supabase
      .from("payments")
      .update({
        payment_provider: taler.provider,
        payment_method: "taler",
        provider_payment_id: taler.providerPaymentId,
        payment_url: taler.paymentUrl,
      })
      .eq("id", payment.id);

    if (updated.error) throw new Error(updated.error.message);
  }

  const updatedPaymentRows = paymentRows.map((payment) => ({
    ...payment,
    payment_provider: taler.provider,
    payment_method: "taler",
    provider_payment_id: taler.providerPaymentId,
    payment_url: taler.paymentUrl,
  }));

  return {
    payments: updatedPaymentRows,
    amount,
    currency,
    payment_url: taler.paymentUrl,
    provider_payment_id: taler.providerPaymentId,
    primary_payment_id: primaryPayment.id,
    provider: taler.provider,
  };
}

export async function confirmPayment(supabase: SupabaseClient, paymentId?: string | null, providerPaymentId?: string | null) {
  const payments = await getPaymentsForConfirmation(supabase, paymentId, providerPaymentId);

  const talerPaymentId = providerPaymentId || payments[0]?.provider_payment_id;
  if (!talerPaymentId) throw new Error("PAYMENT_PROVIDER_REFERENCE_MISSING");
  const talerVerification = await verifyTalerPayment(talerPaymentId);
  const paidProductsByBuyer = new Map<string, Set<string>>();

  for (const payment of payments) {
    const wasAlreadyPaid = payment.payment_status === "paid";
    const paid = await supabase.from("payments").update({ payment_status: "paid" }).eq("id", payment.id);
    if (paid.error) throw new Error(paid.error.message);

    const orderUpdate = await supabase.from("orders").update({ status: "paid" }).eq("id", payment.order_id);
    if (orderUpdate.error) throw new Error(orderUpdate.error.message);

    const existingTx = await supabase
      .from("transactions")
      .select("id")
      .eq("payment_id", payment.id)
      .maybeSingle();
    if (existingTx.error && existingTx.error.code !== "PGRST116") throw new Error(existingTx.error.message);

    if (!existingTx.data) {
      const tx = await supabase.from("transactions").insert({
        payment_id: payment.id,
        provider_reference: payment.provider_payment_id || talerPaymentId,
        transaction_status: "completed",
        response_payload: {
          provider: payment.payment_method || payment.payment_provider || "taler",
          transaction_type: "payment",
          amount: payment.amount,
          currency: payment.currency,
          taler_order_id: talerPaymentId,
          taler_status: talerVerification?.order_status || null,
        },
      });
      if (tx.error) throw new Error(tx.error.message);
    }

    if (wasAlreadyPaid) continue;

    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, supplier_id, shipping_company_id")
      .eq("id", payment.order_id)
      .single();

    if (order?.buyer_id) {
      const { data: orderItems, error: orderItemsError } = await supabase
        .from("order_items")
        .select("product_id")
        .eq("order_id", order.id);

      if (orderItemsError) throw new Error(orderItemsError.message);

      const productIds = (orderItems || []).map((item: any) => String(item.product_id || "")).filter(Boolean);
      if (productIds.length > 0) {
        const existing = paidProductsByBuyer.get(order.buyer_id) || new Set<string>();
        productIds.forEach((productId) => existing.add(productId));
        paidProductsByBuyer.set(order.buyer_id, existing);
      }
    }

    if (order?.buyer_id) {
      await createNotification({
        supabase,
        userId: order.buyer_id,
        title: "Payment confirmed",
        body: `Payment was confirmed successfully for order ${order.id}.`,
        type: "payment_confirmed",
        data: { order_id: order.id, route: `/dashboard/small-business/orders/${order.id}` },
      });
    }

    if (order?.supplier_id) {
      await createNotification({
        supabase,
        userId: order.supplier_id,
        title: "Order paid",
        body: `Order ${order.id} was paid.`,
        type: "supplier_order_paid",
        data: { order_id: order.id, route: "/dashboard/supplier/orders" },
      });
    }

    if (order?.shipping_company_id) {
      await createNotification({
        supabase,
        userId: order.shipping_company_id,
        title: "Delivery order ready",
        body: `Order ${order.id} was paid and is ready for delivery follow-up.`,
        type: "shipping_assigned",
        data: { order_id: order.id, route: "/dashboard/shipping-company/orders" },
      });
    }
  }

  for (const [buyerId, productIds] of paidProductsByBuyer.entries()) {
    await clearUserCartProducts(supabase, buyerId, Array.from(productIds));
  }

  return payments;
}
