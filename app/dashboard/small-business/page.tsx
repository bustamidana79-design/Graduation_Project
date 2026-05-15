"use client";

import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import SmallBusinessUpgradeRequestCard from "@/components/SmallBusinessUpgradeRequestCard";

type AnalyticsItem = {
  month: string;
  orders: number;
};

const mockAnalytics: AnalyticsItem[] = [
  { month: "يناير", orders: 3 },
  { month: "فبراير", orders: 7 },
  { month: "مارس", orders: 5 },
  { month: "أبريل", orders: 10 },
  { month: "مايو", orders: 8 },
  { month: "يونيو", orders: 12 },
];

export default function SmallBusinessDashboardPage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const productsCount = 6;
  const ordersCount = 18;
  const analytics: AnalyticsItem[] = mockAnalytics;

  const maxOrders = analytics.length > 0 ? Math.max(...analytics.map((a) => a.orders), 1) : 1;

  return (
    <>
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحباً، {loading ? "..." : profile?.full_name || "صاحب المشروع"} 👋</h2>
        <p className="mt-1 text-sm text-white/60">إليك ملخص نشاطك على المنصة</p>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جارٍ التحميل...</div>
      ) : (
        <>
          <SmallBusinessUpgradeRequestCard />

          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">عدد المنتجات</p>
              <h3 className="text-2xl font-bold text-[#273347]">{productsCount}</h3>
            </div>

            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">عدد الطلبات</p>
              <h3 className="text-2xl font-bold text-[#273347]">{ordersCount}</h3>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#273347]">تحليل الطلبات</h3>

            <div className="flex h-36 items-end gap-2">
              {analytics.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.orders}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    style={{ height: `${(item.orders / maxOrders) * 100}%` }}
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
