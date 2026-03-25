"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  id: string;
  full_name: string;
  account_type: string;
  country: string;
  city: string;
  status: string;
};

type Stats = {
  products: number;
  incomingOrders: number;
  completedOrders: number;
  totalSales: number;
};

const mockAnalytics = [
  { month: "يناير", sales: 5 },
  { month: "فبراير", sales: 12 },
  { month: "مارس", sales: 8 },
  { month: "أبريل", sales: 18 },
  { month: "مايو", sales: 14 },
  { month: "يونيو", sales: 22 },
];

export default function SupplierDashboardPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({
    products: 8,
    incomingOrders: 6,
    completedOrders: 14,
    totalSales: 2450,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setProfile({
      id: "test-user",
      full_name: "المورد التجريبي",
      account_type: "supplier",
      country: "Palestine",
      city: "Nablus",
      status: "approved",
    });
    setLoading(false);
  }, []);

  const statCards = [
    {
      label: "المنتجات",
      value: stats.products,
      icon: "📦",
      color: "border-r-4 border-[#273347]",
    },
    {
      label: "الطلبات الواردة",
      value: stats.incomingOrders,
      icon: "📥",
      color: "border-r-4 border-blue-400",
    },
    {
      label: "طلبات مكتملة",
      value: stats.completedOrders,
      icon: "✅",
      color: "border-r-4 border-green-400",
    },
    {
      label: "إجمالي المبيعات",
      value: `${stats.totalSales} ₪`,
      icon: "💰",
      color: "border-r-4 border-yellow-400",
    },
  ];

  const maxSales = Math.max(...mockAnalytics.map((a) => a.sales));

  return (
    <>
      <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
        <h2 className="text-2xl font-bold">
          مرحباً، {loading ? "..." : profile?.full_name || "المورد"} 👋
        </h2>
        <p className="text-white/60 text-sm mt-1">مورد</p>
      </div>

      {loading ? (
        <div className="text-center text-[#273347]/40 text-sm py-10">
          جارٍ التحميل...
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {statCards.map((card) => (
              <div
                key={card.label}
                className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}
              >
                <div className="text-2xl mb-2">{card.icon}</div>
                <p className="text-2xl font-bold text-[#273347]">
                  {card.value}
                </p>
                <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <Link
              href="/dashboard/supplier/products/new"
              className="flex items-center gap-3 bg-white border border-[#e6edf5] hover:bg-[#eef3f8] transition rounded-2xl px-6 py-4 text-sm text-[#273347] font-medium w-fit"
            >
              <span>➕</span>
              <span>إضافة منتج</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
            <h3 className="text-sm font-bold text-[#273347] mb-4">
              📊 تحليل المبيعات
            </h3>
            <div className="flex items-end gap-2 h-36">
              {mockAnalytics.map((item) => (
                <div
                  key={item.month}
                  className="flex-1 flex flex-col items-center gap-1"
                >
                  <p className="text-xs font-bold text-[#273347]/50">
                    {item.sales}
                  </p>
                  <div
                    className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                    style={{ height: `${(item.sales / maxSales) * 100}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">
                    {item.month.slice(0, 3)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-[#273347] mb-1">
                المساعد الذكي 🤖
              </h3>
              <p className="text-xs text-[#273347]/50">
                احصل على نصائح ومساعدة لتطوير تجارتك
              </p>
            </div>
            <Link
              href="/chat"
              className="bg-[#273347] hover:bg-[#1e2a3a] text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
            >
              ابدأ المحادثة
            </Link>
          </div>
        </>
      )}
    </>
  );
}