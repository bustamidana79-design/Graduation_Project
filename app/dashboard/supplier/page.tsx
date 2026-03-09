"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase";

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

const navItems = [
  { label: "الرئيسية", href: "/merchant", icon: "🏠" },
  { label: "المنتجات", href: "/merchant/products", icon: "📦" },
  { label: "الطلبات", href: "/merchant/orders", icon: "🧾" },
  { label: "المحادثات", href: "/merchant/chat", icon: "💬" },
  { label: "لوحة التحكم", href: "/merchant/analytics", icon: "📊" },
  { label: "الملف الشخصي", href: "/merchant/profile", icon: "👤" },
];

export default function MerchantDashboard() {
  const router = useRouter();
  const pathname = usePathname();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [stats, setStats] = useState<Stats>({
    products: 0,
    incomingOrders: 0,
    completedOrders: 0,
    totalSales: 0,
  });
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    // fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profileData) {
      if (profileData.status !== "approved") { router.push("/pending"); return; }
      if (profileData.account_type !== "merchant") { router.push("/"); return; }
      setProfile(profileData);
    }

    const { count: productsCount } = await supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    const { count: incomingCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", user.id)
      .eq("status", "pending");

    const { count: completedCount } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("merchant_id", user.id)
      .eq("status", "completed");

    const { data: salesData } = await supabase
      .from("orders")
      .select("total_price")
      .eq("merchant_id", user.id)
      .eq("status", "completed");

    const totalSales = salesData?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;

    setStats({
      products: productsCount || 0,
      incomingOrders: incomingCount || 0,
      completedOrders: completedCount || 0,
      totalSales,
    });

    setLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const statCards = [
    { label: "المنتجات", value: stats.products, icon: "📦", color: "border-r-4 border-[#273347]" },
    { label: "الطلبات الواردة", value: stats.incomingOrders, icon: "📥", color: "border-r-4 border-blue-400" },
    { label: "طلبات مكتملة", value: stats.completedOrders, icon: "✅", color: "border-r-4 border-green-400" },
    { label: "إجمالي المبيعات", value: `${stats.totalSales} ₪`, icon: "💰", color: "border-r-4 border-yellow-400" },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">

      {/* Overlay للموبايل */}
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
          <p className="text-xs text-white/50 mt-1">لوحة التاجر</p>
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

        {/* Top Bar */}
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            className="md:hidden text-[#273347] text-xl"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex items-center gap-3 mr-auto">
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              {profile?.full_name?.charAt(0) || "؟"}
            </div>
            <div className="text-sm text-right">
              <p className="font-semibold text-[#273347]">{profile?.full_name || "..."}</p>
              <p className="text-[#273347]/50 text-xs">تاجر جملة</p>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">

          {/* Welcome */}
          <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
            <h2 className="text-2xl font-bold">
              مرحباً، {loading ? "..." : profile?.full_name} 👋
            </h2>
            <p className="text-white/60 text-sm mt-1">تاجر جملة</p>
          </div>

          {/* Stats */}
          {loading ? (
            <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {statCards.map((card) => (
                <div
                  key={card.label}
                  className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}
                >
                  <div className="text-2xl mb-2">{card.icon}</div>
                  <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                  <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-[#e6edf5] p-6">
            <h3 className="text-sm font-bold text-[#273347] mb-4">إجراءات سريعة</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "إضافة منتج", href: "/merchant/products/new", icon: "➕" },
                { label: "عرض الطلبات", href: "/merchant/orders", icon: "🧾" },
                { label: "المحادثات", href: "/merchant/chat", icon: "💬" },
                { label: "التحليلات", href: "/merchant/analytics", icon: "📊" },
                { label: "الملف الشخصي", href: "/merchant/profile", icon: "👤" },
              ].map((action) => (
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
        </div>
      </main>
    </div>
  );
}