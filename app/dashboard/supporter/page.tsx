"use client";

import { useDashboardAccess } from "@/hooks/useDashboardAccess";

const mockAnalytics = [
  { month: "يناير", investments: 2 },
  { month: "فبراير", investments: 4 },
  { month: "مارس", investments: 3 },
  { month: "أبريل", investments: 6 },
  { month: "مايو", investments: 5 },
  { month: "يونيو", investments: 8 },
];

export default function SupporterDashboard() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "supporter" });

  const stats = {
    investmentsCount: 6,
    totalInvestments: 12500,
    returns: 8.5,
    activeChats: 3,
  };

  const statCards = [
    { label: "عدد الاستثمارات", value: stats.investmentsCount, icon: "💼", color: "border-r-4 border-[#273347]" },
    { label: "إجمالي المبلغ المستثمر", value: `${stats.totalInvestments} ₪`, icon: "💰", color: "border-r-4 border-blue-400" },
    { label: "نسبة العائد", value: `${stats.returns}%`, icon: "📈", color: "border-r-4 border-green-400" },
    { label: "محادثات نشطة", value: stats.activeChats, icon: "💬", color: "border-r-4 border-yellow-400" },
  ];

  const maxInvestments = Math.max(...mockAnalytics.map((a) => a.investments));

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl flex-1 px-6 py-8" dir="rtl">
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحباً، {loading ? "..." : profile?.full_name || "الداعم"} 👋</h2>
        <p className="mt-1 text-sm text-white/60">إليك ملخص استثماراتك على المنصة</p>
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
            <h3 className="mb-4 text-sm font-bold text-[#273347]">تحليل الاستثمارات</h3>
            <div className="flex h-36 items-end gap-2">
              {mockAnalytics.map((item) => (
                <div key={item.month} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.investments}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    style={{ height: `${(item.investments / maxInvestments) * 100}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
