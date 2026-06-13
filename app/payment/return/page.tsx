"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, LogIn, PackageCheck, RotateCw, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

type SyncStatus = "idle" | "checking" | "paid" | "pending" | "error";

const PENDING_CHECKOUT_ORDER_IDS_KEY = "pending_checkout_order_ids";
const PENDING_CHECKOUT_PAYMENT_IDS_KEY = "pending_checkout_payment_ids";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

export default function PaymentReturnPage() {
  const [params, setParams] = useState<URLSearchParams | null>(null);
  const [hasSession, setHasSession] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    setParams(new URLSearchParams(window.location.search));

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session));
    };

    void loadSession();
  }, []);

  const paymentStatus = params?.get("payment") || "";
  const paymentId = params?.get("payment_id") || "";
  const providerPaymentId = params?.get("provider_payment_id") || params?.get("order_id") || "";
  const reason = params?.get("reason") || "";

  const ordersHref = useMemo(() => {
    const nextParams = new URLSearchParams();
    if (paymentStatus) nextParams.set("payment", paymentStatus);
    if (paymentId) nextParams.set("payment_id", paymentId);
    if (providerPaymentId) nextParams.set("provider_payment_id", providerPaymentId);
    return `/dashboard/small-business/orders${nextParams.toString() ? `?${nextParams.toString()}` : ""}`;
  }, [paymentId, paymentStatus, providerPaymentId]);

  const loginHref = `/login?redirect=${encodeURIComponent(ordersHref)}`;
  const resolvedStatus = syncStatus === "paid" ? "success" : paymentStatus;
  const isSuccess = resolvedStatus === "success";
  const isFailed = resolvedStatus === "failed" || syncStatus === "error";

  useEffect(() => {
    if (!isSuccess) return;
    window.localStorage.removeItem(PENDING_CHECKOUT_ORDER_IDS_KEY);
    window.localStorage.removeItem(PENDING_CHECKOUT_PAYMENT_IDS_KEY);
  }, [isSuccess]);

  const checkPayment = async () => {
    if (!hasSession) {
      setMessage("سجل الدخول أولا حتى يتم التحقق من الدفع داخل حسابك.");
      return;
    }

    setSyncStatus("checking");
    setMessage("");

    const headers = await getAuthHeaders();
    const response = await fetch("/api/payment/check-payment", {
      method: "POST",
      headers,
      body: JSON.stringify({
        payment_id: paymentId || undefined,
        provider_payment_id: providerPaymentId || undefined,
      }),
    });
    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setSyncStatus("error");
      setMessage(result.error || "تعذر التحقق من الدفع. حاول مرة أخرى بعد قليل.");
      return;
    }

    if (Number(result.paid_count || 0) > 0) {
      setSyncStatus("paid");
      setMessage("تم تأكيد الدفع وتحديث الطلب بنجاح.");
      return;
    }

    if (Number(result.pending_count || 0) > 0) {
      setSyncStatus("pending");
      setMessage("الدفع ما زال قيد المعالجة.");
      return;
    }

    setSyncStatus("idle");
    setMessage("لم يتم العثور على دفعة تحتاج إلى تحديث.");
  };

  useEffect(() => {
    if (!hasSession || paymentStatus !== "failed") return;
    if (!paymentId && !providerPaymentId) return;
    void checkPayment();
    // Run once when the page has enough return data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSession, paymentId, paymentStatus, providerPaymentId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-10" dir="rtl">
      <section className="w-full max-w-xl rounded-lg border border-[#e6edf5] bg-white p-6 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f3f7fb]">
          {isSuccess ? (
            <CheckCircle2 className="text-green-600" size={34} />
          ) : isFailed ? (
            <XCircle className="text-red-600" size={34} />
          ) : (
            <RotateCw className="text-[#546a85]" size={32} />
          )}
        </div>

        <h1 className="mt-4 text-2xl font-bold text-[#273347]">
          {isSuccess ? "تم تأكيد الدفع" : isFailed ? "تعذر تأكيد الدفع تلقائيا" : "جار التحقق من الدفع"}
        </h1>
        <p className="mt-3 text-sm leading-6 text-[#546a85]">
          {isSuccess
            ? "تم تحديث حالة الطلب. يمكنك متابعة تفاصيل الطلب من صفحة الطلبات."
            : "إذا تم الخصم من المحفظة، سجل الدخول ثم تحقق من حالة الدفع داخل حسابك."}
        </p>

        {(providerPaymentId || paymentId || reason || message) && (
          <div className="mt-5 space-y-2 rounded-lg bg-[#f8fafc] p-4 text-right text-xs text-[#273347]">
            {providerPaymentId && <p className="break-all">مرجع Taler: {providerPaymentId}</p>}
            {paymentId && <p className="break-all">رقم الدفع: {paymentId}</p>}
            {reason && <p className="break-all text-red-700">السبب: {reason}</p>}
            {message && <p className="font-semibold">{message}</p>}
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          {hasSession ? (
            <>
              <Link
                href={ordersHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#273347] px-4 py-3 text-sm font-semibold text-white"
              >
                <PackageCheck size={17} />
                عرض الطلبات
              </Link>
              <button
                type="button"
                onClick={() => void checkPayment()}
                disabled={syncStatus === "checking"}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#bbd0e4] px-4 py-3 text-sm font-semibold text-[#273347] disabled:opacity-60"
              >
                <RotateCw size={17} />
                {syncStatus === "checking" ? "جار التحقق..." : "تحقق من الدفع"}
              </button>
            </>
          ) : (
            <Link
              href={loginHref}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#273347] px-4 py-3 text-sm font-semibold text-white"
            >
              <LogIn size={17} />
              تسجيل الدخول لمتابعة الطلب
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
