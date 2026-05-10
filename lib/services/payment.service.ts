import { createNotification } from "./notification.service";

type SupabaseClient = {
  from: (table: string) => any;
};

async function createTalerPayment(params: { amount: number; paymentId: string; returnUrl?: string }) {
  const baseUrl = process.env.TALER_BACKEND_URL;
  const token = process.env.TALER_BACKEND_TOKEN;

  if (!baseUrl) {
    return {
      providerPaymentId: params.paymentId,
      paymentUrl: `/api/payment/confirm?paymentId=${params.paymentId}`,
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/private/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      order: {
        amount: `USD:${params.amount.toFixed(2)}`,
        summary: "Graduation Project order payment",
        fulfillment_url: params.returnUrl || `${process.env.NEXT_PUBLIC_APP_URL || ""}/dashboard/small-business/orders`,
      },
    }),
  });

  if (!response.ok) throw new Error(`Taler payment failed: ${response.status}`);
  const data = await response.json();
  return {
    providerPaymentId: data.order_id || data.provider_payment_id || params.paymentId,
    paymentUrl: data.taler_pay_uri || data.payment_url || data.order_status_url,
  };
}

export async function createPayment(
  supabase: SupabaseClient,
  buyerId: string,
  orderIds: string[],
  returnUrl?: string
) {
  const ids = Array.from(new Set(orderIds.filter(Boolean)));
  if (ids.length === 0) throw new Error("ORDER_REQUIRED");

  const { data: orders, error } = await supabase
    .from("orders")
    .select("id, buyer_id, total_amount, status")
    .in("id", ids)
    .eq("buyer_id", buyerId);

  if (error) throw new Error(error.message);
  if (!orders || orders.length !== ids.length) throw new Error("ORDER_NOT_FOUND");

  const amount = orders.reduce((sum: number, order: any) => sum + Number(order.total_amount || 0), 0);
  const paymentRows = [];

  for (const order of orders) {
    const inserted = await supabase
      .from("payments")
      .insert({
        order_id: order.id,
        amount: Number(order.total_amount || 0),
        payment_provider: "taler",
        payment_status: "pending",
      })
      .select("*")
      .single();

    if (inserted.error || !inserted.data) throw new Error(inserted.error?.message || "Failed to create payment.");
    paymentRows.push(inserted.data);
  }

  const primaryPayment = paymentRows[0];
  const taler = await createTalerPayment({ amount, paymentId: primaryPayment.id, returnUrl });

  for (const payment of paymentRows) {
    await supabase
      .from("payments")
      .update({
        provider_payment_id: taler.providerPaymentId,
        payment_url: taler.paymentUrl,
      })
      .eq("id", payment.id);
  }

  return { payments: paymentRows, amount, payment_url: taler.paymentUrl, provider_payment_id: taler.providerPaymentId };
}

export async function confirmPayment(supabase: SupabaseClient, paymentId?: string | null, providerPaymentId?: string | null) {
  let query = supabase.from("payments").select("*");
  query = paymentId ? query.eq("id", paymentId) : query.eq("provider_payment_id", providerPaymentId);
  const { data: payments, error } = await query;

  if (error) throw new Error(error.message);
  if (!payments || payments.length === 0) throw new Error("PAYMENT_NOT_FOUND");

  for (const payment of payments) {
    const paid = await supabase.from("payments").update({ payment_status: "paid" }).eq("id", payment.id);
    if (paid.error) throw new Error(paid.error.message);

    const orderUpdate = await supabase.from("orders").update({ status: "confirmed" }).eq("id", payment.order_id);
    if (orderUpdate.error) throw new Error(orderUpdate.error.message);

    const tx = await supabase.from("transactions").insert({
      payment_id: payment.id,
      amount: payment.amount,
      transaction_type: "payment",
      status: "completed",
      provider: "taler",
      provider_reference: payment.provider_payment_id,
    });
    if (tx.error) throw new Error(tx.error.message);

    const { data: order } = await supabase
      .from("orders")
      .select("id, buyer_id, supplier_id")
      .eq("id", payment.order_id)
      .single();

    if (order?.buyer_id) {
      await createNotification({
        supabase,
        userId: order.buyer_id,
        title: "تم تأكيد الدفع",
        body: `تم تأكيد الدفع بنجاح للطلب رقم ${order.id}.`,
        type: "payment_confirmed",
      });
    }

    if (order?.supplier_id) {
      await createNotification({
        supabase,
        userId: order.supplier_id,
        title: "تم دفع طلب",
        body: `تم دفع الطلب رقم ${order.id}.`,
        type: "supplier_order_paid",
      });
    }
  }

  return payments;
}
