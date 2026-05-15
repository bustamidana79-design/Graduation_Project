"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";
type RequestStatus = "pending" | "approved" | "rejected";

type UpgradeRequest = {
  id: string;
  user_id: string;
  status: RequestStatus;
  request_json: {
    current_account_type?: AccountType;
    target_account_type?: AccountType;
    reason?: string;
    experience?: string;
    expected_usage?: string;
  } | null;
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    country: string | null;
    city: string | null;
    account_type: AccountType;
    status: string;
  } | null;
};

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "مورد",
  small_business: "مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم",
  admin: "إدارة",
};

const statusLabels: Record<RequestStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const statusClasses: Record<RequestStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const dateFormatter = new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" });

export default function AdminUpgradeRequestsPage() {
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [filter, setFilter] = useState<"all" | RequestStatus>("pending");
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("يجب تسجيل الدخول كإدارة.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/admin/upgrade-requests", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "تعذر تحميل طلبات الترقية.");
      setLoading(false);
      return;
    }

    setRequests(result.requests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadRequests);
  }, [loadRequests]);

  const stats = useMemo(
    () => ({
      total: requests.length,
      pending: requests.filter((item) => item.status === "pending").length,
      approved: requests.filter((item) => item.status === "approved").length,
      rejected: requests.filter((item) => item.status === "rejected").length,
    }),
    [requests]
  );

  const filteredRequests = useMemo(() => {
    if (filter === "all") return requests;
    return requests.filter((item) => item.status === filter);
  }, [filter, requests]);

  const reviewRequest = async (requestId: string, status: "approved" | "rejected") => {
    setSavingId(requestId);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("يجب تسجيل الدخول كإدارة.");
      setSavingId("");
      return;
    }

    const response = await fetch(`/api/admin/upgrade-requests/${requestId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        status,
        admin_note: notesById[requestId] || "",
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "تعذرت مراجعة الطلب.");
      setSavingId("");
      return;
    }

    setRequests((current) => current.map((item) => (item.id === requestId ? { ...item, ...result.request } : item)));
    setSavingId("");
  };

  const statCards = [
    { key: "all" as const, label: "كل الطلبات", value: stats.total, color: "border-[#273347]" },
    { key: "pending" as const, label: "قيد المراجعة", value: stats.pending, color: "border-amber-400" },
    { key: "approved" as const, label: "مقبولة", value: stats.approved, color: "border-emerald-400" },
    { key: "rejected" as const, label: "مرفوضة", value: stats.rejected, color: "border-red-400" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-6 py-8" dir="rtl">
      <section className="mb-6 rounded-2xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">لوحة الإدارة</p>
        <h1 className="mt-2 text-3xl font-bold">طلبات الترقية</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          راجع طلبات تغيير نوع الحساب، واقبل الطلبات الجاهزة أو ارفضها مع ملاحظة واضحة للمستخدم.
        </p>
      </section>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {statCards.map((card) => (
          <button
            key={card.key}
            onClick={() => setFilter(card.key)}
            className={`rounded-2xl border-r-4 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 ${card.color} ${
              filter === card.key ? "ring-2 ring-[#273347]/10" : ""
            }`}
          >
            <p className="text-2xl font-bold text-[#273347]">{card.value.toLocaleString("ar")}</p>
            <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl bg-white py-14 text-center text-sm text-[#273347]/45">جاري تحميل طلبات الترقية...</div>
      ) : filteredRequests.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9e3ee] bg-white px-4 py-12 text-center text-sm text-[#273347]/50">
          لا توجد طلبات ضمن هذا التصنيف.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => {
            const current = request.request_json?.current_account_type || request.profile?.account_type;
            const target = request.request_json?.target_account_type;
            const canReview = request.status === "pending";

            return (
              <article key={request.id} className="rounded-2xl border border-[#e6edf5] bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#273347]">{request.profile?.full_name || "مستخدم غير معروف"}</h2>
                    <p className="mt-1 text-sm text-[#273347]/55">
                      {request.profile?.email || "بدون بريد"} · {request.profile?.phone || "بدون هاتف"}
                    </p>
                    <p className="mt-1 text-xs text-[#273347]/45">
                      {request.profile?.city || "مدينة غير محددة"}، {request.profile?.country || "دولة غير محددة"} ·{" "}
                      {dateFormatter.format(new Date(request.created_at))}
                    </p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[request.status]}`}>
                    {statusLabels[request.status]}
                  </span>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <div className="rounded-2xl bg-[#f6f8fb] p-4">
                    <p className="text-xs text-[#273347]/45">الحساب الحالي</p>
                    <p className="mt-1 font-bold text-[#273347]">{current ? accountTypeLabels[current] : "غير محدد"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f6f8fb] p-4">
                    <p className="text-xs text-[#273347]/45">الحساب المطلوب</p>
                    <p className="mt-1 font-bold text-[#273347]">{target ? accountTypeLabels[target] : "غير محدد"}</p>
                  </div>
                  <div className="rounded-2xl bg-[#f6f8fb] p-4">
                    <p className="text-xs text-[#273347]/45">حالة ملف المستخدم</p>
                    <p className="mt-1 font-bold text-[#273347]">{request.profile?.status || "غير محدد"}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">سبب الطلب</p>
                    <p className="mt-2 text-sm leading-6 text-[#273347]/70">{request.request_json?.reason || "لا يوجد سبب مرفق."}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">معلومات داعمة</p>
                    <p className="mt-2 text-sm leading-6 text-[#273347]/70">{request.request_json?.experience || "غير مرفق."}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">الاستخدام المتوقع</p>
                    <p className="mt-2 text-sm leading-6 text-[#273347]/70">{request.request_json?.expected_usage || "غير مرفق."}</p>
                  </div>
                </div>

                {canReview ? (
                  <div className="mt-5 flex flex-col gap-3 border-t border-[#eef3f8] pt-5">
                    <textarea
                      value={notesById[request.id] || ""}
                      onChange={(event) => setNotesById((current) => ({ ...current, [request.id]: event.target.value }))}
                      rows={2}
                      className="w-full rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
                      placeholder="ملاحظة الإدارة للمستخدم، خصوصًا عند الرفض."
                    />
                    <div className="flex flex-wrap gap-3">
                      <button
                        onClick={() => void reviewRequest(request.id, "approved")}
                        disabled={savingId === request.id}
                        className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        قبول الترقية
                      </button>
                      <button
                        onClick={() => void reviewRequest(request.id, "rejected")}
                        disabled={savingId === request.id}
                        className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                      >
                        رفض الطلب
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-2xl bg-[#f6f8fb] px-4 py-3 text-sm text-[#273347]/65">
                    ملاحظة الإدارة: {request.admin_note || "لا توجد ملاحظة."}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
