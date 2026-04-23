"use client";

import { useDashboardAccess } from "@/hooks/useDashboardAccess";

const mockAnalytics = [
  { month: "يناير", deliveries: 8 },
  { month: "فبراير", deliveries: 15 },
  { month: "مارس", deliveries: 12 },
  { month: "أبريل", deliveries: 20 },
  { month: "مايو", deliveries: 18 },
  { month: "يونيو", deliveries: 25 },
];

export default function DeliveryDashboard() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "delivery" });

  const stats = {
    incoming: 5,
    inProgress: 3,
    completed: 42,
    rating: 4.8,
  };

  const maxDeliveries = Math.max(...mockAnalytics.map((a) => a.deliveries));

  const statCards = [
    { label: "طلبات واردة", value: stats.incoming, icon: "📥", color: "border-r-4 border-[#273347]" },
    { label: "قيد التوصيل", value: stats.inProgress, icon: "🚚", color: "border-r-4 border-blue-400" },
    { label: "مكتملة", value: stats.completed, icon: "✅", color: "border-r-4 border-green-400" },
    { label: "تقييم الخدمة", value: `${stats.rating} ⭐`, icon: "🏅", color: "border-r-4 border-yellow-400" },
  ];

  return (
    <div className="mx-auto flex-1 w-full max-w-5xl px-6 py-8" dir="rtl">
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحباً، {loading ? "..." : profile?.full_name || "شركة الشحن"} 👋</h2>
        <p className="mt-1 text-sm text-white/60">إليك ملخص نشاط شركتك</p>
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
            <h3 className="mb-4 text-sm font-bold text-[#273347]">تحليل التوصيلات</h3>
            <div className="flex h-36 items-end gap-2">
              {mockAnalytics.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.deliveries}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    style={{ height: `${(item.deliveries / maxDeliveries) * 100}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
