"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

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
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("اسم المستخدم");
  const [productsCount, setProductsCount] = useState(6);
  const [ordersCount, setOrdersCount] = useState(18);
  const [analytics, setAnalytics] = useState<AnalyticsItem[]>([]);

  useEffect(() => {
    setAnalytics(mockAnalytics);
    setLoading(false);
  }, []);

  const maxOrders =
    analytics.length > 0 ? Math.max(...analytics.map((a) => a.orders), 1) : 1;

  return (
    <>
      <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
        <h2 className="text-2xl font-bold">
          مرحباً، {loading ? "..." : userName} 👋
        </h2>
        <p className="text-white/60 text-sm mt-1">إليك ملخص نشاطك على المنصة</p>
      </div>

      {loading ? (
        <div className="text-center text-[#273347]/40 text-sm py-10">
          جارٍ التحميل...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border border-[#e6edf5] p-5">
              <p className="text-sm text-[#273347]/60 mb-2">نصيحة اليوم</p>
              <h3 className="text-2xl font-bold text-[#273347]">
        
              </h3>
            </div>

            <div className="bg-white rounded-2xl border border-[#e6edf5] p-5">
              <p className="text-sm text-[#273347]/60 mb-2">عدد الطلبات</p>
              <h3 className="text-2xl font-bold text-[#273347]">
                                {ordersCount}

              </h3>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
            <h3 className="text-sm font-bold text-[#273347] mb-4">
              📊 تحليل الطلبات
            </h3>

            <div className="flex items-end gap-2 h-36">
              {analytics.map((item) => (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <p className="text-xs font-bold text-[#273347]/50">
                    {item.orders}
                  </p>
                  <div
                    className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                    style={{ height: `${(item.orders / maxOrders) * 100}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">
                    {item.month.slice(0, 3)}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </>
      )}
    </>
  );
}