// app/dashboard/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

type UpgradeRequest = {
  id: string;
  user_id: string;
  requested_type: string;
  status: string;
  created_at: string;
  profiles?: {
    full_name: string;
    email: string;
  };
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
  const [pendingUpgrades, setPendingUpgrades] = useState<UpgradeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const [
      { count: totalUsers },
      { count: merchants },
      { count: smallBusinesses },
      { count: delivery },
      { count: supporters },
      { count: pendingCount },
      { count: approvedCount },
      { count: rejectedCount },
      { data: upgradesData, count: upgradesCount },
    ] = await Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "merchant"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "small_business"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "delivery"),
      supabase.from("profiles").select("*", { count: "exact", head: true }).eq("account_type", "supporter"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "approved"),
      supabase.from("applications").select("*", { count: "exact", head: true }).eq("status", "rejected"),
      supabase.from("upgrade_requests").select("*, profiles(full_name, email)", { count: "exact" }).eq("status", "pending").order("created_at", { ascending: false }).limit(5),
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

    setPendingUpgrades((upgradesData as UpgradeRequest[]) || []);
    setLoading(false);
  };

  // الصف الأول — أنواع المستخدمين
  const userTypeCards = [
    { label: "إجمالي المستخدمين", value: stats.totalUsers, icon: "👥", color: "border-r-4 border-[#273347]" },
    { label: "تجار الجملة", value: stats.merchants, icon: "🏬", color: "border-r-4 border-purple-400" },
    { label: "المشاريع الصغيرة", value: stats.smallBusinesses, icon: "🏪", color: "border-r-4 border-blue-400" },
    { label: "شركات التوصيل", value: stats.delivery, icon: "🚚", color: "border-r-4 border-orange-400" },
    { label: "الداعمون", value: stats.supporters, icon: "🤝", color: "border-r-4 border-green-400" },
    { label: "طلبات الترقية", value: stats.pendingUpgrades, icon: "⬆️", color: "border-r-4 border-yellow-400" },
  ];

  // الصف الثاني — حالات الطلبات
  const applicationStatusCards = [
    { label: "قيد المراجعة", value: stats.pendingApplications, icon: "🕐", color: "border-r-4 border-yellow-400 bg-yellow-50", textColor: "text-yellow-700" },
    { label: "مقبول", value: stats.approvedApplications, icon: "✅", color: "border-r-4 border-green-400 bg-green-50", textColor: "text-green-700" },
    { label: "مرفوض", value: stats.rejectedApplications, icon: "❌", color: "border-r-4 border-red-400 bg-red-50", textColor: "text-red-700" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen" dir="rtl">

      {/* Header */}
      <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-lg font-bold text-[#273347]">لوحة التحكم</h2>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">م</div>
          <div className="text-sm text-right">
            <p className="font-semibold text-[#273347]">المدير</p>
            <p className="text-[#273347]/50 text-xs">مدير النظام</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">

        {/* Welcome Banner */}
        <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
          <h2 className="text-2xl font-bold">مرحباً بك في لوحة الإدارة 👋</h2>
          <p className="text-white/60 text-sm mt-1">إليك ملخص النشاط الحالي للمنصة</p>
        </div>

        {loading ? (
          <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
        ) : (
          <>
            {/* الصف الأول — أنواع المستخدمين */}
            <p className="text-xs font-semibold text-[#273347]/50 mb-3 mt-2">المستخدمون</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              {userTypeCards.map((card) => (
                <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}>
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                  <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
                </div>
              ))}
            </div>

          
           {/* الصف الثاني — حالات الطلبات */}
           <p className="text-xs font-semibold text-[#273347]/50 mb-3">حالات الطلبات</p>
<div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                {applicationStatusCards.map((card) => (
                <div key={card.label} className={`rounded-2xl p-5 shadow-sm ${card.color}`}>
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <p className={`text-2xl font-bold ${card.textColor}`}>{card.value}</p>
                  <p className={`text-xs mt-1 ${card.textColor} opacity-70`}>{card.label}</p>
                </div>
              ))}
            </div>
          </>
        )}

    

      </div>
    </div>
  );
}