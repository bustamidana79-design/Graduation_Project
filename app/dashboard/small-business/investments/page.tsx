"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type Investment = {
  id: string;
  supporter_id: string;
  small_business_id: string | null;
  project_owner_id: string | null;
  amount: number | string;
  currency: string;
  investment_type: string;
  expected_return: number | string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type SupporterProfile = {
  id: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  active: "مقبول / نشط",
  completed: "مكتمل",
  cancelled: "مرفوض / ملغي",
};

const typeLabels: Record<string, string> = {
  funding: "تمويل",
  partnership: "شراكة",
  mentorship: "إرشاد",
  services: "خدمات",
  other: "أخرى",
};

const statusClasses: Record<string, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  active: "border-blue-200 bg-blue-50 text-blue-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
};

const dateFormatter = new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" });

function toNumber(value: number | string | null | undefined) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatAmount(amount: number | string, currency: string) {
  return `${toNumber(amount).toLocaleString("ar")} ${currency}`;
}

export default function SmallBusinessInvestmentsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [supportersById, setSupportersById] = useState<Record<string, SupporterProfile>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadInvestments = async () => {
      setLoading(true);
      setError("");

      const { data, error: investmentsError } = await supabase
        .from("investments")
        .select("id, supporter_id, small_business_id, project_owner_id, amount, currency, investment_type, expected_return, status, notes, created_at")
        .or(`small_business_id.eq.${profile.id},project_owner_id.eq.${profile.id}`)
        .order("created_at", { ascending: false });

      if (investmentsError) {
        setError(investmentsError.message);
        setLoading(false);
        return;
      }

      const nextInvestments = (data as Investment[] | null) || [];
      setInvestments(nextInvestments);

      const supporterIds = Array.from(new Set(nextInvestments.map((item) => item.supporter_id)));
      if (supporterIds.length === 0) {
        setSupportersById({});
        setLoading(false);
        return;
      }

      const { data: supportersData } = await supabase
        .from("profiles")
        .select("id, full_name, city, country")
        .in("id", supporterIds);

      setSupportersById(
        Object.fromEntries(((supportersData as SupporterProfile[] | null) || []).map((item) => [item.id, item]))
      );
      setLoading(false);
    };

    loadInvestments();
  }, [profile?.id]);

  const stats = useMemo(() => {
    return {
      total: investments.length,
      pending: investments.filter((item) => item.status === "pending").length,
      active: investments.filter((item) => item.status === "active").length,
      totalAmount: investments.reduce((sum, item) => sum + toNumber(item.amount), 0),
      currency: investments[0]?.currency || "ILS",
    };
  }, [investments]);

  const updateStatus = async (investmentId: string, status: "active" | "cancelled" | "completed") => {
    if (savingId) return;

    setSavingId(investmentId);
    setError("");
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch(`/api/investments/${investmentId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({ status }),
    });
    const result = await response.json();

    setSavingId(null);

    if (!response.ok) {
      setError(result.error || "تعذر تحديث حالة الاستثمار.");
      return;
    }

    setInvestments((current) =>
      current.map((item) => (item.id === investmentId ? { ...item, status: result.investment.status } : item))
    );
    setMessage("تم تحديث حالة الاستثمار وإرسال إشعار للداعم.");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">طلبات الداعمين</p>
        <h1 className="mt-2 text-3xl font-bold">طلبات الاستثمار</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          راجع طلبات الاستثمار الواردة من الداعمين، واقبل المناسب منها أو ارفضه.
        </p>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {loading || accessLoading ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">جاري تحميل طلبات الاستثمار...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "كل الطلبات", value: stats.total.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "قيد المراجعة", value: stats.pending.toLocaleString("ar"), color: "border-r-4 border-amber-400" },
              { label: "استثمارات نشطة", value: stats.active.toLocaleString("ar"), color: "border-r-4 border-blue-400" },
              {
                label: "إجمالي المبالغ",
                value: `${stats.totalAmount.toLocaleString("ar")} ${stats.currency}`,
                color: "border-r-4 border-green-400",
              },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          {investments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d9e3ee] bg-white px-4 py-12 text-center text-sm text-[#273347]/55">
              لا توجد طلبات استثمار حاليًا.
            </div>
          ) : (
            <div className="grid gap-4">
              {investments.map((investment) => {
                const supporter = supportersById[investment.supporter_id];
                const canDecide = investment.status === "pending";
                const canComplete = investment.status === "active";

                return (
                  <article key={investment.id} className="rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-bold text-[#273347]">
                            {supporter?.full_name || "داعم / مستثمر"}
                          </h2>
                          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[investment.status] || statusClasses.pending}`}>
                            {statusLabels[investment.status] || investment.status}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#273347]/55">
                          {[supporter?.city, supporter?.country].filter(Boolean).join(" - ") || "داخل المنصة"}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-2xl font-bold text-[#273347]">{formatAmount(investment.amount, investment.currency)}</p>
                        <p className="mt-1 text-xs text-[#273347]/50">{dateFormatter.format(new Date(investment.created_at))}</p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-[#273347]/70 md:grid-cols-3">
                      <p>نوع الدعم: {typeLabels[investment.investment_type] || "أخرى"}</p>
                      <p>
                        العائد المتوقع:{" "}
                        {investment.expected_return ? `${toNumber(investment.expected_return).toFixed(1)}%` : "غير محدد"}
                      </p>
                      <p>الحالة: {statusLabels[investment.status] || investment.status}</p>
                    </div>

                    {investment.notes && (
                      <p className="mt-4 rounded-2xl bg-[#f8fafc] px-4 py-3 text-sm leading-6 text-[#273347]/70">
                        {investment.notes}
                      </p>
                    )}

                    <div className="mt-5 flex flex-wrap gap-2">
                      {canDecide && (
                        <>
                          <button
                            type="button"
                            onClick={() => void updateStatus(investment.id, "active")}
                            disabled={savingId === investment.id}
                            className="rounded-2xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2938] disabled:opacity-60"
                          >
                            قبول الاستثمار
                          </button>
                          <button
                            type="button"
                            onClick={() => void updateStatus(investment.id, "cancelled")}
                            disabled={savingId === investment.id}
                            className="rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                          >
                            رفض الطلب
                          </button>
                        </>
                      )}
                      {canComplete && (
                        <button
                          type="button"
                          onClick={() => void updateStatus(investment.id, "completed")}
                          disabled={savingId === investment.id}
                          className="rounded-2xl border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-60"
                        >
                          تعليم كمكتمل
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
