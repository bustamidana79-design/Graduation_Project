"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DailyTipCard from "@/components/DailyTipCard";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import { supabase } from "@/lib/supabase";

type Investment = {
  amount: number | string;
  currency: string;
  expected_return: number | string | null;
  status: string;
  created_at: string;
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function isCountedInvestment(investment: Investment) {
  return investment.status === "active" || investment.status === "completed";
}

export default function SupporterDashboard() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "supporter" });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentsLoading, setInvestmentsLoading] = useState(true);
  const [schemaHint, setSchemaHint] = useState(false);

  useEffect(() => {
    if (!profile?.id) return;

    const loadInvestments = async () => {
      setInvestmentsLoading(true);
      setSchemaHint(false);

      const { data, error } = await supabase
        .from("investments")
        .select("amount, currency, expected_return, status, created_at")
        .eq("supporter_id", profile.id)
        .order("created_at", { ascending: false });

      if (error) {
        if (error.message.toLowerCase().includes("investments")) {
          setSchemaHint(true);
        }
        setInvestments([]);
        setInvestmentsLoading(false);
        return;
      }

      setInvestments((data as Investment[] | null) || []);
      setInvestmentsLoading(false);
    };

    loadInvestments();
  }, [profile?.id]);

  const stats = useMemo(() => {
    const countedInvestments = investments.filter(isCountedInvestment);
    const totalInvestments = countedInvestments.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const returns = countedInvestments.map((item) => toNumber(item.expected_return)).filter((value) => value > 0);
    const averageReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;

    return {
      investmentsCount: countedInvestments.length,
      totalInvestments,
      returns: averageReturn,
      activeInvestments: countedInvestments.filter((item) => item.status === "active").length,
      currency: countedInvestments[0]?.currency || investments[0]?.currency || "ILS",
    };
  }, [investments]);

  const analytics = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), requests: 0, accepted: 0 };
    });

    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    investments.forEach((investment) => {
      const date = new Date(investment.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) return;

      bucket.requests += 1;
      if (isCountedInvestment(investment)) bucket.accepted += 1;
    });

    return buckets;
  }, [investments]);

  const statCards = [
    { label: "عدد الاستثمارات", value: stats.investmentsCount.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
    {
      label: "إجمالي المبلغ المستثمر",
      value: `${stats.totalInvestments.toLocaleString("ar")} ${stats.currency}`,
      color: "border-r-4 border-blue-400",
    },
    { label: "متوسط العائد", value: `${stats.returns.toFixed(1)}%`, color: "border-r-4 border-green-400" },
    { label: "استثمارات نشطة", value: stats.activeInvestments.toLocaleString("ar"), color: "border-r-4 border-yellow-400" },
  ];

  const maxMonthlyRequests = Math.max(...analytics.map((a) => a.requests), 1);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl flex-1 px-6 py-8" dir="rtl">
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحباً، {loading ? "..." : profile?.full_name || "الداعم"}</h2>
        <p className="mt-1 text-sm text-white/60">إليك ملخص استثماراتك على المنصة</p>
      </div>

      {schemaHint && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          جدول الاستثمارات غير موجود بعد. نفذ الملف <span className="font-semibold">supabase/supporter-investments.sql</span> في Supabase.
        </div>
      )}

      {loading || investmentsLoading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جاري التحميل...</div>
      ) : (
        <>
          <DailyTipCard />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#273347]">تحليل الاستثمارات</h3>
                <p className="mt-1 text-xs text-[#273347]/45">عدد الطلبات شهرياً، مع احتساب المقبول والمكتمل ضمن الإحصائيات.</p>
              </div>
              <Link href="/dashboard/supporter/investments" className="text-sm font-semibold text-[#273347] hover:underline">
                عرض التفاصيل
              </Link>
            </div>
            <div className="flex h-36 items-end gap-2">
              {analytics.map((item) => (
                <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.requests}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    title={`الطلبات: ${item.requests} | المقبولة: ${item.accepted}`}
                    style={{ height: `${Math.max((item.requests / maxMonthlyRequests) * 100, item.requests ? 8 : 2)}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                </div>
              ))}
            </div>
          </div>

          {investments.length === 0 && (
            <div className="rounded-2xl border border-dashed border-[#d9e3ee] bg-white px-5 py-8 text-center">
              <p className="text-sm text-[#273347]/55">لم تسجل أي استثمار بعد.</p>
              <Link
                href="/dashboard/supporter/projects"
                className="mt-4 inline-flex rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938]"
              >
                استعراض المشاريع
              </Link>
            </div>
          )}
        </>
      )}
    </main>
  );
}
