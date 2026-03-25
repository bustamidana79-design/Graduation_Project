"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

type Profile = {
  full_name: string;
};

const navItems = [
  { label: "الرئيسية", href: "/dashboard/supplier", icon: "🏠" },
  { label: "المنتجات", href: "/dashboard/supplier/products", icon: "📦" },
  { label: "الطلبات", href: "/dashboard/supplier/orders", icon: "🧾" },
  { label: "المحادثات", href: "/dashboard/supplier/messages", icon: "💬" },
  { label: "لوحة التحكم", href: "/dashboard/supplier/analytics", icon: "📊" },
  { label: "خدمة العملاء", href: "/dashboard/supplier/customer-service", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/supplier/profile", icon: "👤" },
];

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      if (data) setProfile(data);
    };

    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard/supplier") {
      return pathname === href;
    }
    return pathname.startsWith(href);
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
          <h1 className="text-xl font-bold">منصة الموردين</h1>
          <p className="text-xs text-white/50 mt-1">لوحة المورد</p>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                isActive(item.href)
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

      <button
        className="md:hidden fixed top-4 left-4 z-40 bg-white border border-[#e6edf5] text-[#273347] px-3 py-2 rounded-xl shadow-sm"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center gap-3 mr-auto">
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              {profile?.full_name?.charAt(0) || "؟"}
            </div>

            <div className="text-sm text-right">
              <p className="font-semibold text-[#273347]">
                {profile?.full_name || "..."}
              </p>
              <p className="text-[#273347]/50 text-xs">مورد</p>
            </div>
          </div>
        </header>

        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}