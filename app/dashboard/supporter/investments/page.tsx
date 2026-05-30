"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { VerticalBarChart } from "@/components/SimpleCharts";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type Investment = {
  id: string;
  supporter_id: string;
  small_business_id: string;
  amount: number | string;
  currency: string;
  investment_type: string;
  expected_return: number | string | null;
  status: string;
  notes: string | null;
  created_at: string;
};

type PublicProfile = {
  id: string;
  full_name: string | null;
  city: string | null;
  country: string | null;
};

type SmallBusinessProfile = {
  user_id: string;
  project_name: string | null;
  project_field: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  active: "نشط",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const typeLabels: Record<string, string> = {
  funding: "تمويل",
  partnership: "شراكة",
  mentorship: "إرشاد",
  services: "خدمات",
  other: "أخرى",
};

const statusClasses: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  active: "bg-blue-50 text-blue-700 border-blue-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-50 text-red-700 border-red-200",
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });
const dateFormatter = new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function isCountedInvestment(investment: Investment) {
  return investment.status === "active" || investment.status === "completed";
}

function formatAmount(amount: number, currency: string) {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function InvestmentsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "supporter" });
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, PublicProfile>>({});
  const [businessById, setBusinessById] = useState<Record<string, SmallBusinessProfile>>({});
  const [loading, setLoading] = useState(true);
  const [schemaHint, setSchemaHint] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadInvestments = async () => {
      setLoading(true);
      setError("");
      setSchemaHint(false);

      const { data, error: investmentsError } = await supabase
        .from("investments")
        .select("id, supporter_id, small_business_id, amount, currency, investment_type, expected_return, status, notes, created_at")
        .eq("supporter_id", profile.id)
        .order("created_at", { ascending: false });

      if (investmentsError) {
        if (investmentsError.message.toLowerCase().includes("investments")) {
          setSchemaHint(true);
        }
        setError(investmentsError.message);
        setLoading(false);
        return;
      }

      const nextInvestments = (data as Investment[] | null) || [];
      setInvestments(nextInvestments);

      const businessIds = Array.from(new Set(nextInvestments.map((item) => item.small_business_id)));
      if (businessIds.length === 0) {
        setProfilesById({});
        setBusinessById({});
        setLoading(false);
        return;
      }

      const [{ data: profilesData }, { data: businessData }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, city, country").in("id", businessIds),
        supabase.from("small_business_profiles").select("user_id, project_name, project_field").in("user_id", businessIds),
      ]);

      setProfilesById(
        Object.fromEntries(((profilesData as PublicProfile[] | null) || []).map((item) => [item.id, item]))
      );
      setBusinessById(
        Object.fromEntries(((businessData as SmallBusinessProfile[] | null) || []).map((item) => [item.user_id, item]))
      );
      setLoading(false);
    };

    loadInvestments();
  }, [profile?.id]);

  const stats = useMemo(() => {
    const countedInvestments = investments.filter(isCountedInvestment);
    const total = countedInvestments.reduce((sum, item) => sum + toNumber(item.amount), 0);
    const activeCount = countedInvestments.filter((item) => item.status === "active").length;
    const completedCount = countedInvestments.filter((item) => item.status === "completed").length;
    const returns = countedInvestments
      .map((item) => toNumber(item.expected_return))
      .filter((value) => value > 0);
    const averageReturn = returns.length ? returns.reduce((sum, value) => sum + value, 0) / returns.length : 0;

    return {
      count: countedInvestments.length,
      total,
      activeCount,
      completedCount,
      averageReturn,
    };
  }, [investments]);

  const monthlyAnalytics = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), requests: 0, accepted: 0, amount: 0 };
    });

    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    investments.forEach((investment) => {
      const date = new Date(investment.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) return;

      bucket.requests += 1;
      if (isCountedInvestment(investment)) {
        bucket.accepted += 1;
        bucket.amount += toNumber(investment.amount);
      }
    });

    return buckets;
  }, [investments]);

  const primaryCurrency = investments.find(isCountedInvestment)?.currency || investments[0]?.currency || "ILS";
  const monthlyChart = monthlyAnalytics.map((item) => ({
    key: item.key,
    label: item.month,
    value: item.requests,
    hint: `المقبولة: ${item.accepted} | القيمة: ${formatAmount(item.amount, primaryCurrency)}`,
    color: "#52789f",
  }));

  return (
    <div className="space-y-6 p-8" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">لوحة المتابعة</p>
        <h1 className="mt-2 text-3xl font-bold">استثماراتي</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          تابع الاستثمارات المسجلة، قيمتها، حالتها، والعائد المتوقع لكل مشروع.
        </p>
      </section>

      {schemaHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          جدول الاستثمارات غير موجود بعد. نفذ الملف <span className="font-semibold">supabase/supporter-investments.sql</span> في Supabase.
        </div>
      )}

      {error && !schemaHint && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading || accessLoading ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">جاري تحميل الاستثمارات...</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "عدد الاستثمارات", value: stats.count.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "إجمالي المبلغ", value: formatAmount(stats.total, primaryCurrency), color: "border-r-4 border-blue-400" },
              { label: "استثمارات نشطة", value: stats.activeCount.toLocaleString("ar"), color: "border-r-4 border-cyan-400" },
              { label: "متوسط العائد", value: `${stats.averageReturn.toFixed(1)}%`, color: "border-r-4 border-green-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[#e6edf5] bg-white p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-[#273347]">تحليل الاستثمارات الشهرية</h2>
                <p className="mt-1 text-xs text-[#273347]/45">الأعمدة تعرض كل الطلبات، والمبلغ يحسب المقبول والمكتمل فقط.</p>
              </div>
              <Link href="/dashboard/supporter/projects" className="text-sm font-semibold text-[#273347] hover:underline">
                إضافة استثمار
              </Link>
            </div>
            <VerticalBarChart data={monthlyChart} heightClass="h-48" />
          </div>

          <div className="rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h2 className="mb-4 text-sm font-bold text-[#273347]">قائمة الاستثمارات</h2>

            {investments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-10 text-center">
                <p className="text-sm text-[#273347]/55">لا توجد استثمارات بعد.</p>
                <Link
                  href="/dashboard/supporter/projects"
                  className="mt-4 inline-flex rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938]"
                >
                  استعراض المشاريع
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-right text-sm">
                  <thead>
                    <tr className="border-b border-[#e6edf5] text-xs text-[#273347]/50">
                      <th className="py-3 font-semibold">المشروع</th>
                      <th className="py-3 font-semibold">النوع</th>
                      <th className="py-3 font-semibold">المبلغ</th>
                      <th className="py-3 font-semibold">العائد</th>
                      <th className="py-3 font-semibold">الحالة</th>
                      <th className="py-3 font-semibold">التاريخ</th>
                      <th className="py-3 font-semibold">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {investments.map((investment) => {
                      const business = businessById[investment.small_business_id];
                      const publicProfile = profilesById[investment.small_business_id];
                      const title = business?.project_name || publicProfile?.full_name || "مشروع صغير";

                      return (
                        <tr key={investment.id} className="border-b border-[#eef3f8] align-top last:border-0">
                          <td className="py-4">
                            <Link
                              href={`/dashboard/supporter/users/${investment.small_business_id}`}
                              className="font-bold text-[#273347] hover:underline"
                            >
                              {title}
                            </Link>
                            <p className="mt-1 text-xs text-[#273347]/45">{business?.project_field || "مجال غير محدد"}</p>
                          </td>
                          <td className="py-4 text-[#273347]/70">{typeLabels[investment.investment_type] || "أخرى"}</td>
                          <td className="py-4 font-semibold text-[#273347]">
                            {formatAmount(toNumber(investment.amount), investment.currency)}
                          </td>
                          <td className="py-4 text-[#273347]/70">
                            {investment.expected_return ? `${toNumber(investment.expected_return).toFixed(1)}%` : "غير محدد"}
                          </td>
                          <td className="py-4">
                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                statusClasses[investment.status] || statusClasses.pending
                              }`}
                            >
                              {statusLabels[investment.status] || investment.status}
                            </span>
                          </td>
                          <td className="py-4 text-[#273347]/70">{dateFormatter.format(new Date(investment.created_at))}</td>
                          <td className="max-w-[220px] py-4 text-[#273347]/60">
                            <span className="line-clamp-2">{investment.notes || "لا توجد ملاحظات"}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
