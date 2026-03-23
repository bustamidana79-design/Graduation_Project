"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
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

const navItems = [
  { label: "الرئيسية", href: "/dashboard/supplier", icon: "🏠" },
  { label: "المنتجات", href: "/dashboard/supplier/products", icon: "📦" },
  { label: "الطلبات", href: "/dashboard/supplier/orders", icon: "🧾" },
  { label: "المحادثات", href: "/dashboard/supplier/messages", icon: "💬" },
  { label: "لوحة التحكم", href: "/dashboard/supplier/analytics", icon: "📊" },
  { label: "خدمة العملاء", href: "/dashboard/customer-service", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/supplier/profile", icon: "👤" },
];

const mockAnalytics = [
  { month: "يناير", sales: 5 },
  { month: "فبراير", sales: 12 },
  { month: "مارس", sales: 8 },
  { month: "أبريل", sales: 18 },
  { month: "مايو", sales: 14 },
  { month: "يونيو", sales: 22 },
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
    setLoading(false);
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

  const maxSales = Math.max(...mockAnalytics.map((a) => a.sales));

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

        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">

          {/* Welcome */}
          <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
            <h2 className="text-2xl font-bold">
              مرحباً، {loading ? "..." : profile?.full_name} 👋
            </h2>
            <p className="text-white/60 text-sm mt-1">تاجر جملة</p>
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

              {/* إضافة منتج */}
              <div className="mb-6">
                <Link
                  href="/merchant/products/new"
                  className="flex items-center gap-3 bg-white border border-[#e6edf5] hover:bg-[#eef3f8] transition rounded-2xl px-6 py-4 text-sm text-[#273347] font-medium w-fit"
                >
                  <span>➕</span>
                  <span>إضافة منتج</span>
                </Link>
              </div>

              {/* التحليلات */}
              <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
                <h3 className="text-sm font-bold text-[#273347] mb-4">📊 تحليل المبيعات</h3>
                <div className="flex items-end gap-2 h-36">
                  {mockAnalytics.map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-xs font-bold text-[#273347]/50">{item.sales}</p>
                      <div
                        className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                        style={{ height: `${(item.sales / maxSales) * 100}%` }}
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
                  <p className="text-xs text-[#273347]/50">احصل على نصائح ومساعدة لتطوير تجارتك</p>
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
