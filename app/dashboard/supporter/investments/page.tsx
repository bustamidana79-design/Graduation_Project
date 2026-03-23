"use client";

const mockAnalytics = [
  { month: "يناير", investments: 2 },
  { month: "فبراير", investments: 4 },
  { month: "مارس", investments: 3 },
  { month: "أبريل", investments: 6 },
  { month: "مايو", investments: 5 },
  { month: "يونيو", investments: 8 },
];

export default function InvestmentsPage() {
  const maxInvestments = Math.max(...mockAnalytics.map((a) => a.investments));

  return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#273347] mb-6">استثماراتي</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[
          { label: "عدد الاستثمارات", value: "6", icon: "💼", color: "border-r-4 border-[#273347]" },
          { label: "إجمالي المبلغ", value: "12,500 ₪", icon: "💰", color: "border-r-4 border-blue-400" },
          { label: "نسبة العائد", value: "8.5%", icon: "📈", color: "border-r-4 border-green-400" },
        ].map((card) => (
          <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}>
            <div className="text-2xl mb-2">{card.icon}</div>
            <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
            <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
        <h3 className="text-sm font-bold text-[#273347] mb-4">📊 تحليل الاستثمارات الشهرية</h3>
        <div className="flex items-end gap-2 h-40">
          {mockAnalytics.map((item) => (
            <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
              <p className="text-xs font-bold text-[#273347]/50">{item.investments}</p>
              <div
                className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                style={{ height: `${(item.investments / maxInvestments) * 100}%` }}
              />
              <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-[#e6edf5] p-6">
        <h3 className="text-sm font-bold text-[#273347] mb-4">قائمة الاستثمارات</h3>
        <p className="text-sm text-[#273347]/40 text-center py-6">لا توجد استثمارات بعد.</p>
      </div>
    </div>
  );
}