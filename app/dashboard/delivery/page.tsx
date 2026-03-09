"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  full_name: string;
  account_type: string;
  status: string;
};

const navItems = [
  { label: "الرئيسية", href: "/dashboard/delivery", icon: "🏠" },
  { label: "الطلبات", href: "/dashboard/delivery/orders", icon: "📦" },
  { label: "المحادثات", href: "/dashboard/delivery/messages", icon: "💬" },
  { label: "التحليلات", href: "/dashboard/delivery/analytics", icon: "📊" },
  { label: "الملف الشخصي", href: "/dashboard/delivery/profile", icon: "👤" },
];

const mockAnalytics = [
  { month: "يناير", deliveries: 8 },
  { month: "فبراير", deliveries: 15 },
  { month: "مارس", deliveries: 12 },
  { month: "أبريل", deliveries: 20 },
  { month: "مايو", deliveries: 18 },
  { month: "يونيو", deliveries: 25 },
];

export default function DeliveryDashboard() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const stats = {
    incoming: 5,
    inProgress: 3,
    completed: 42,
    rating: 4.8,
  };

  useEffect(() => {
    // fetchProfile();
    setLoading(false);
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

    if (data) {
      if (data.status !== "approved") { router.push("/pending"); return; }
      if (data.account_type !== "delivery") { router.push("/"); return; }
      setProfile(data);
    }

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const maxDeliveries = Math.max(...mockAnalytics.map((a) => a.deliveries));

  const statCards = [
    { label: "طلبات واردة", value: stats.incoming, icon: "📥", color: "border-r-4 border-[#273347]" },
    { label: "قيد التوصيل", value: stats.inProgress, icon: "🚚", color: "border-r-4 border-blue-400" },
    { label: "مكتملة", value: stats.completed, icon: "✅", color: "border-r-4 border-green-400" },
    { label: "تقييم الخدمة", value: `${stats.rating} ⭐`, icon: "🏅", color: "border-r-4 border-yellow-400" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 right-0 h-full w-64 bg-[#273347] text-white z-30 flex flex-col
        transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        md:translate-x-0 md:static md:h-screen
      `}>
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="text-xl font-bold">منصة الموردين</h1>
          <p className="text-xs text-white/50 mt-1">لوحة شركة الشحن</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                pathname === item.href
                  ? "bg-white/15 text-white font-semibold"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="px-4 py-6 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all w-full"
          >
            <span className="text-lg">🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen">

        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            className="md:hidden text-[#273347] text-xl"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex items-center gap-3 mr-auto">
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              {profile?.full_name?.[0] || "ش"}
            </div>
            <div className="text-sm text-right">
              <p className="font-semibold text-[#273347]">{profile?.full_name || "..."}</p>
              <p className="text-[#273347]/50 text-xs">شركة شحن</p>
            </div>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">

          {/* Welcome Banner */}
          <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
            <h2 className="text-2xl font-bold">
              مرحباً، {loading ? "..." : profile?.full_name} 👋
            </h2>
            <p className="text-white/60 text-sm mt-1">إليك ملخص نشاط شركتك</p>
          </div>

          {loading ? (
            <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {statCards.map((card) => (
                  <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}>
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                    <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* التحليلات */}
              <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
                <h3 className="text-sm font-bold text-[#273347] mb-4">📊 تحليل التوصيلات</h3>
                <div className="flex items-end gap-2 h-36">
                  {mockAnalytics.map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-xs font-bold text-[#273347]/50">{item.deliveries}</p>
                      <div
                        className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                        style={{ height: `${(item.deliveries / maxDeliveries) * 100}%` }}
                      />
                      <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* الشاتبوت */}
              <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#273347] mb-1">المساعد الذكي 🤖</h3>
                  <p className="text-xs text-[#273347]/50">احصل على مساعدة وتحليل لأداء شركتك</p>
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
        </div>
      </main>
    </div>
  );
}
