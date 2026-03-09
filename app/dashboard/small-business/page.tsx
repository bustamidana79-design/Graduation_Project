"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  full_name: string;
  account_type: string;
  status: string;
};

export default function SmallBusinessDashboard() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { router.push("/login"); return; }

    const { data } = await supabase
      .from("profiles")
      .select("full_name, account_type, status")
      .eq("id", user.id)
      .single();

    setProfile(data);
    setLoading(false);
  };

  const statusLabel = (status: string) => {
    if (status === "approved") return { text: "مقبول ✅", color: "text-green-600 bg-green-50" };
    if (status === "rejected") return { text: "مرفوض ❌", color: "text-red-600 bg-red-50" };
    return { text: "قيد المراجعة 🕐", color: "text-yellow-600 bg-yellow-50" };
  };

  const quickActions = [
    { label: "منتجاتي", href: "/dashboard/small-business/products", icon: "📦" },
    { label: "طلباتي", href: "/dashboard/small-business/orders", icon: "🛒" },
    { label: "المحادثات", href: "/dashboard/small-business/messages", icon: "💬" },
    { label: "ملفي الشخصي", href: "/dashboard/small-business/profile", icon: "👤" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc]" dir="rtl">

      {/* Header */}
      <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <h2 className="text-lg font-bold text-[#273347]">لوحة التحكم</h2>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
            {profile?.full_name?.[0] || "م"}
          </div>
          <div className="text-sm text-right">
            <p className="font-semibold text-[#273347]">{profile?.full_name || "..."}</p>
            <p className="text-[#273347]/50 text-xs">صاحب مشروع صغير</p>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Welcome Banner */}
        <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
          <h2 className="text-2xl font-bold">مرحباً {profile?.full_name} 👋</h2>
          <p className="text-white/60 text-sm mt-1">إليك ملخص نشاطك على المنصة</p>
        </div>

        {loading ? (
          <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
        ) : (
          <>
            {/* حالة الحساب */}
            <div className="bg-white rounded-2xl border border-[#e6edf5] p-5 mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-[#273347]/50 mb-1">حالة الحساب</p>
                <span className={`text-sm font-semibold px-3 py-1 rounded-full ${statusLabel(profile?.status || "pending").color}`}>
                  {statusLabel(profile?.status || "pending").text}
                </span>
              </div>
              <div className="text-4xl">🏢</div>
            </div>

            {/* إجراءات سريعة */}
            <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
              <h3 className="text-sm font-bold text-[#273347] mb-4">إجراءات سريعة</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {quickActions.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 bg-[#f8fafc] hover:bg-[#eef3f8] transition rounded-xl px-4 py-3 text-sm text-[#273347] font-medium"
                  >
                    <span>{action.icon}</span>
                    <span>{action.label}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* المساعد الذكي */}
            <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#273347] mb-1">المساعد التسويقي الذكي 🤖</h3>
                <p className="text-xs text-[#273347]/50">احصل على نصائح تسويقية مخصصة لمشروعك</p>
              </div>
              <Link
                href="/chat"
                className="bg-[#273347] hover:bg-[#1e2a3a] text-white text-sm font-semibold px-5 py-2 rounded-xl transition"
              >
                ابدأ المحادثة
              </Link>
            </div>

            {/* الشات العادي */}
            <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#273347] mb-1">التواصل مع الموردين 💬</h3>
                <p className="text-xs text-[#273347]/50">تواصل مباشرة مع الموردين وشركات التوصيل</p>
              </div>
              <Link
                href="/dashboard/small-business/messages"
                className="bg-[#bbd0e4] hover:bg-[#a9c2d8] text-[#273347] text-sm font-semibold px-5 py-2 rounded-xl transition"
              >
                فتح المحادثات
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}