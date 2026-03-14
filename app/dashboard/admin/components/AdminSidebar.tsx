// app/dashboard/admin/components/AdminSidebar.tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const navItems = [

  { label: "لوحة التحكم", href: "/dashboard/admin", icon: "⊞" },
  { label: "الطلبات", href: "/dashboard/admin/applications", icon: "📋" },
  { label: "طلبات الترقية", href: "/dashboard/admin/upgrade_requests", icon: "⬆️" },
  { label: "المنتجات", href: "/dashboard/admin/products", icon: "📦" },
  { label: "المحادثات", href: "/dashboard/admin/messages", icon: "💬" },
  { label: "خدمة العملاء", href: "/dashboard/support", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/admin/profile", icon: "👤" },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <aside className="w-64 min-h-screen bg-[#273347] flex flex-col" dir="rtl">
      <div className="px-6 py-6 border-b border-white/10">
        <span className="text-white text-xl font-bold">منصة الموردين</span>
        <p className="text-white/40 text-xs mt-1">لوحة الإدارة</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition ${
                isActive
                  ? "bg-white/15 text-white"
                  : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10 hover:text-white transition"
        >
          <span>🚪</span>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}