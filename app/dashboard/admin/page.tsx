// app/admin/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

type Stats = {
  totalUsers: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    pendingApplications: 0,
    approvedApplications: 0,
    rejectedApplications: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);

    const { count: totalUsers } = await supabase
      .from("profiles")
      .select("*", { count: "exact", head: true });

    const { count: pendingCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "approved");

    const { count: rejectedCount } = await supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    setStats({
      totalUsers: totalUsers || 0,
      pendingApplications: pendingCount || 0,
      approvedApplications: approvedCount || 0,
      rejectedApplications: rejectedCount || 0,
    });

    setLoading(false);
  };

  const statCards = [
    {
      label: "إجمالي المستخدمين",
      value: stats.totalUsers,
      icon: "👥",
      color: "border-r-4 border-[#273347]",
    },
    {
      label: "قيد المراجعة",
      value: stats.pendingApplications,
      icon: "🕐",
      color: "border-r-4 border-yellow-400",
    },
    {
      label: "مقبول",
      value: stats.approvedApplications,
      icon: "✅",
      color: "border-r-4 border-green-400",
    },
    {
      label: "مرفوض",
      value: stats.rejectedApplications,
      icon: "❌",
      color: "border-r-4 border-red-400",
    },
  ];

  const quickActions = [
    { label: "الطلبات", href: "/admin/applications", icon: "📋" },
    { label: "المنتجات", href: "/admin/products", icon: "📦" },
    { label: "المحادثات", href: "/admin/messages", icon: "💬" },
    { label: "الملف الشخصي", href: "/admin/profile", icon: "👤" },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen" dir="rtl">

      {/* Header */}
      <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-lg font-bold text-[#273347]">لوحة التحكم</h2>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
            م
          </div>
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

        {/* Stats */}
        {loading ? (
          <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {statCards.map((card) => (
              <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}>
                <div className="text-2xl mb-2">{card.icon}</div>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
              </div>
            ))}
          </div>
        )}

       
      </div>
    </div>
  );
}