"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type ReportsPayload = {
  summary: {
    users: number;
    approvedUsers: number;
    pendingApplications: number;
    pendingUpgrades: number;
    products: number;
    publishedProducts: number;
    orders: number;
    totalOrderAmount: number;
    deliveryOrders: number;
    totalShippingFees: number;
    investments: number;
    totalInvestments: number;
  };
  breakdowns: {
    profileTypes: { key: string; value: number }[];
    orderStatuses: { key: string; value: number }[];
    deliveryStatuses: { key: string; value: number }[];
    investmentStatuses: { key: string; value: number }[];
  };
  monthly: { key: string; month: string; users: number; orders: number; deliveryOrders: number; investments: number }[];
};

const accountTypeLabels: Record<string, string> = {
  merchant: "مورد",
  small_business: "مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم",
  admin: "إدارة",
  unknown: "غير محدد",
};

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  picked_up: "تم الاستلام",
  in_transit: "قيد النقل",
  out_for_delivery: "خارج للتسليم",
  active: "نشط",
  completed: "مكتمل",
  rejected: "مرفوض",
  approved: "مقبول",
  unknown: "غير محدد",
};

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<ReportsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadReports = async () => {
      setLoading(true);
      setError("");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setError("يجب تسجيل الدخول كإدارة لعرض التقارير.");
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/reports", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "تعذر تحميل التقارير.");
        setLoading(false);
        return;
      }

      setReports(result);
      setLoading(false);
    };

    void Promise.resolve().then(loadReports);
  }, []);

  const maxMonthly = useMemo(() => {
    if (!reports) return 1;
    return Math.max(...reports.monthly.map((item) => item.users + item.orders + item.deliveryOrders + item.investments), 1);
  }, [reports]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-6 py-8" dir="rtl">
      <section className="mb-6 rounded-2xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">لوحة الإدارة</p>
        <h1 className="mt-2 text-3xl font-bold">التقارير العامة</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          ملخص تنفيذي لنشاط المنصة: المستخدمون، الطلبات، الشحن، المنتجات، والاستثمارات.
        </p>
      </section>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || !reports ? (
        <div className="rounded-2xl bg-white py-14 text-center text-sm text-[#273347]/45">جاري تحميل التقارير...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "إجمالي المستخدمين", value: reports.summary.users.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "مستخدمون معتمدون", value: reports.summary.approvedUsers.toLocaleString("ar"), color: "border-r-4 border-emerald-400" },
              { label: "طلبات تسجيل معلقة", value: reports.summary.pendingApplications.toLocaleString("ar"), color: "border-r-4 border-yellow-400" },
              { label: "طلبات ترقية معلقة", value: reports.summary.pendingUpgrades.toLocaleString("ar"), color: "border-r-4 border-amber-400" },
              { label: "المنتجات", value: reports.summary.products.toLocaleString("ar"), color: "border-r-4 border-purple-400" },
              { label: "الطلبات التجارية", value: reports.summary.orders.toLocaleString("ar"), color: "border-r-4 border-blue-400" },
              { label: "قيمة الطلبات", value: formatAmount(reports.summary.totalOrderAmount), color: "border-r-4 border-cyan-400" },
              { label: "قيمة الاستثمارات", value: formatAmount(reports.summary.totalInvestments), color: "border-r-4 border-green-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h2 className="mb-4 text-sm font-bold text-[#273347]">النشاط الشهري</h2>
            <div className="flex h-44 items-end gap-2">
              {reports.monthly.map((item) => {
                const total = item.users + item.orders + item.deliveryOrders + item.investments;
                return (
                  <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                    <p className="text-xs font-bold text-[#273347]/50">{total}</p>
                    <div
                      className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                      title={`مستخدمون: ${item.users} | طلبات: ${item.orders} | شحن: ${item.deliveryOrders} | استثمارات: ${item.investments}`}
                      style={{ height: `${Math.max((total / maxMonthly) * 100, total ? 8 : 2)}%` }}
                    />
                    <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {[
              { title: "المستخدمون حسب النوع", data: reports.breakdowns.profileTypes, labels: accountTypeLabels },
              { title: "حالات الطلبات", data: reports.breakdowns.orderStatuses, labels: statusLabels },
              { title: "حالات الشحن", data: reports.breakdowns.deliveryStatuses, labels: statusLabels },
              { title: "حالات الاستثمار", data: reports.breakdowns.investmentStatuses, labels: statusLabels },
            ].map((section) => (
              <section key={section.title} className="rounded-2xl border border-[#e6edf5] bg-white p-6">
                <h2 className="mb-4 text-sm font-bold text-[#273347]">{section.title}</h2>
                {section.data.length === 0 ? (
                  <p className="text-sm text-[#273347]/45">لا توجد بيانات بعد.</p>
                ) : (
                  <div className="space-y-3">
                    {section.data.map((item) => (
                      <div key={item.key} className="flex items-center justify-between rounded-2xl bg-[#f6f8fb] px-4 py-3">
                        <span className="font-semibold text-[#273347]">{section.labels[item.key] || item.key}</span>
                        <span className="text-sm text-[#273347]/60">{item.value.toLocaleString("ar")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
