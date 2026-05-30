"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { HorizontalBarChart } from "@/components/SimpleCharts";
import { supabase } from "../../../lib/supabase";

type Stats = {
  totalUsers: number;
  merchants: number;
  smallBusinesses: number;
  delivery: number;
  supporters: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  pendingUpgrades: number;
};

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    merchants: 0,
    smallBusinesses: 0,
    delivery: 0,
    supporters: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
    pendingUpgrades: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const [
      { count: totalUsers },
      { count: merchants },
      { count: smallBusinesses },
      { count: delivery },
      { count: supporters },
      { count: pendingCount },
      { count: approvedCount },
      { count: rejectedCount },
      { count: upgradesCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "merchant"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "small_business"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "delivery"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "supporter"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("upgrade_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    ]);

    setStats({
      totalUsers: totalUsers || 0,
      merchants: merchants || 0,
      smallBusinesses: smallBusinesses || 0,
      delivery: delivery || 0,
      supporters: supporters || 0,
      pendingApplications: pendingCount || 0,
      approvedApplications: approvedCount || 0,
      rejectedApplications: rejectedCount || 0,
      pendingUpgrades: upgradesCount || 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(fetchStats);
  }, [fetchStats]);

  const userTypeCards = [
    { label: "إجمالي المستخدمين", value: stats.totalUsers, color: "border-r-4 border-[#273347]" },
    { label: "تجار الجملة", value: stats.merchants, color: "border-r-4 border-purple-400" },
    { label: "المشاريع الصغيرة", value: stats.smallBusinesses, color: "border-r-4 border-blue-400" },
    { label: "شركات التوصيل", value: stats.delivery, color: "border-r-4 border-orange-400" },
    { label: "الداعمون", value: stats.supporters, color: "border-r-4 border-green-400" },
    { label: "طلبات الترقية", value: stats.pendingUpgrades, color: "border-r-4 border-yellow-400" },
  ];

  const applicationStatusCards = [
    { label: "قيد المراجعة", value: stats.pendingApplications, color: "border-r-4 border-yellow-400 bg-yellow-50", textColor: "text-yellow-700" },
    { label: "مقبول", value: stats.approvedApplications, color: "border-r-4 border-green-400 bg-green-50", textColor: "text-green-700" },
    { label: "مرفوض", value: stats.rejectedApplications, color: "border-r-4 border-red-400 bg-red-50", textColor: "text-red-700" },
  ];

  const userTypeChart = useMemo(
    () => [
      { key: "merchant", label: "تجار الجملة", value: stats.merchants, color: "#52789f" },
      { key: "small_business", label: "المشاريع الصغيرة", value: stats.smallBusinesses, color: "#6f9cc3" },
      { key: "delivery", label: "شركات التوصيل", value: stats.delivery, color: "#8fb1cf" },
      { key: "supporter", label: "الداعمون", value: stats.supporters, color: "#546a85" },
    ],
    [stats.delivery, stats.merchants, stats.smallBusinesses, stats.supporters]
  );

  const applicationStatusChart = useMemo(
    () => [
      { key: "pending", label: "قيد المراجعة", value: stats.pendingApplications, color: "#6f9cc3" },
      { key: "approved", label: "مقبول", value: stats.approvedApplications, color: "#52789f" },
      { key: "rejected", label: "مرفوض", value: stats.rejectedApplications, color: "#8fb1cf" },
    ],
    [stats.approvedApplications, stats.pendingApplications, stats.rejectedApplications]
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col" dir="rtl">
      <div className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <section className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
          <h2 className="text-2xl font-bold">مرحبا بك في لوحة الإدارة</h2>
          <p className="mt-1 text-sm text-white/60">إليك ملخص النشاط الحالي للمنصة</p>
        </section>

        {loading ? (
          <div className="py-10 text-center text-sm text-[#273347]/40">جار التحميل...</div>
        ) : (
          <>
            <p className="mb-3 mt-2 text-xs font-semibold text-[#273347]/50">المستخدمون</p>
            <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
              {userTypeCards.map((card) => (
                <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                  <p className="text-2xl font-bold text-[#273347]">{card.value.toLocaleString("ar")}</p>
                  <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
                </div>
              ))}
            </div>

            <div className="mb-8 grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-[#e6edf5] bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#273347]">توزيع المستخدمين</h3>
                <HorizontalBarChart data={userTypeChart} />
              </section>
              <section className="rounded-2xl border border-[#e6edf5] bg-white p-6 shadow-sm">
                <h3 className="mb-4 text-sm font-bold text-[#273347]">حالات طلبات التسجيل</h3>
                <HorizontalBarChart data={applicationStatusChart} />
              </section>
            </div>

            <p className="mb-3 text-xs font-semibold text-[#273347]/50">حالات الطلبات</p>
            <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3">
              {applicationStatusCards.map((card) => (
                <div key={card.label} className={`rounded-2xl p-5 shadow-sm ${card.color}`}>
                  <p className={`text-2xl font-bold ${card.textColor}`}>{card.value.toLocaleString("ar")}</p>
                  <p className={`mt-1 text-xs ${card.textColor} opacity-70`}>{card.label}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
