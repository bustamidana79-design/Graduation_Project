"use client";

import Link from "next/link";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

const mockAnalytics = [
  { month: "يناير", sales: 5 },
  { month: "فبراير", sales: 12 },
  { month: "مارس", sales: 8 },
  { month: "أبريل", sales: 18 },
  { month: "مايو", sales: 14 },
  { month: "يونيو", sales: 22 },
];

export default function SupplierDashboardPage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "merchant" });

  const stats = {
    products: 8,
    incomingOrders: 6,
    completedOrders: 14,
    totalSales: 2450,
  };

  const statCards = [
    { label: "المنتجات", value: stats.products, icon: "📦", color: "border-r-4 border-[#273347]" },
    { label: "الطلبات الواردة", value: stats.incomingOrders, icon: "📥", color: "border-r-4 border-blue-400" },
    { label: "طلبات مكتملة", value: stats.completedOrders, icon: "✅", color: "border-r-4 border-green-400" },
    { label: "إجمالي المبيعات", value: `${stats.totalSales} ₪`, icon: "💰", color: "border-r-4 border-yellow-400" },
  ];

  const maxSales = Math.max(...mockAnalytics.map((a) => a.sales));

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#273347] px-8 py-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">مرحباً، {loading ? "..." : profile?.full_name || "المورد"} 👋</h2>
          <p className="mt-1 text-sm text-white/60">مورد</p>
        </div>
        <Link
          href="/dashboard/supplier/assistant"
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#273347] transition hover:bg-[#eef4fa]"
        >
          AI Assistant
        </Link>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جارٍ التحميل...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {statCards.map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <div className="mb-2 text-2xl">{card.icon}</div>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#273347]">تحليل المبيعات</h3>
            <div className="flex h-36 items-end gap-2">
              {mockAnalytics.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.sales}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    style={{ height: `${(item.sales / maxSales) * 100}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
