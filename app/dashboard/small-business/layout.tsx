"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

const navItems = [
  { label: "الرئيسية", href: "/dashboard/small-business", icon: "🏠" },
  { label: "منتجاتي", href: "/dashboard/small-business/products", icon: "📦" },
  { label: "منتجات الموردين", href: "/dashboard/small-business/suppliers-products", icon: "🏪" },
  { label: "طلباتي", href: "/dashboard/small-business/orders", icon: "🛒" },
  { label: "المحادثات", href: "/dashboard/small-business/messages", icon: "💬" },
  { label: "التحليلات", href: "/dashboard/small-business/analytics", icon: "📊" },
  { label: "خدمة العملاء", href: "/dashboard/support", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/small-business/profile", icon: "👤" },
];

export default function SmallBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 right-0 h-full w-64 bg-[#273347] text-white z-30 flex flex-col
          transform transition-transform duration-300
          ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
          md:translate-x-0 md:static md:h-screen
        `}
      >
        <div className="px-6 py-6 border-b border-white/10">
          <h1 className="text-xl font-bold">منصة الأعمال الذكية</h1>
          <p className="text-xs text-white/50 mt-1">لوحة المشروع الصغير</p>
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

        <div className="px-4 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-white/70 hover:bg-white/10 hover:text-white transition-all w-full"
          >
            <span className="text-lg">🚪</span>
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            className="md:hidden text-[#273347] text-xl"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="mr-auto text-sm font-semibold text-[#273347]">
            لوحة المشروع الصغير
          </div>
        </header>

        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}