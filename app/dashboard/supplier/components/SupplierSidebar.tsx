"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

type Profile = {
  full_name: string;
};

const navItems = [
  { label: "الرئيسية", href: "/dashboard/supplier", icon: "🏠" },
  { label: "المستخدمون", href: "/dashboard/supplier/users", icon: "👥" },
  { label: "المنتجات", href: "/dashboard/supplier/products", icon: "📦" },
  { label: "الطلبات", href: "/dashboard/supplier/orders", icon: "🧾" },
  { label: "المحادثات", href: "/dashboard/supplier/messages", icon: "💬" },
  { label: "التحليلات", href: "/dashboard/supplier/analytics", icon: "📊" },
  { label: "المساعد الذكي", href: "/dashboard/supplier/assistant", icon: "AI" },
  { label: "خدمة العملاء", href: "/dashboard/supplier/customer-service", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/supplier/profile", icon: "👤" },
];

export default function SupplierSidebar({
  sidebarOpen,
  setSidebarOpen,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
      if (data) setProfile(data);
    };

    fetchProfile();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard/supplier") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`
        fixed top-0 right-0 z-30 flex min-h-dvh w-64 flex-col bg-[#273347] text-white
        transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        md:static md:translate-x-0
      `}
    >
      <div className="border-b border-white/10 px-6 py-6">
        <h1 className="text-xl font-bold">منصة الموردين</h1>
        <p className="mt-1 text-xs text-white/50">لوحة المورد</p>
      </div>

      <nav className="flex-1 space-y-1 px-4 py-6">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all ${
              isActive(item.href)
                ? "bg-white/15 font-semibold text-white"
                : "text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-lg">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-6">
        <div className="mb-3 px-4 text-xs text-white/45">{profile?.full_name || "المورد"}</div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
        >
          <span className="text-lg">🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
