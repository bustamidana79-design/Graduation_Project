"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const navItems = [
  { label: "الرئيسية", href: "/dashboard/small-business", icon: "Home" },
  { label: "المستخدمون", href: "/dashboard/small-business/users", icon: "Users" },
  { label: "المنتجات", href: "/dashboard/small-business/products", icon: "Shop" },
  { label: "السلة", href: "/dashboard/small-business/cart", icon: "Cart" },
  { label: "المفضلة", href: "/dashboard/small-business/favorites", icon: "Fav" },
  { label: "طلباتي", href: "/dashboard/small-business/orders", icon: "Orders" },
  { label: "طلبات الاستثمار", href: "/dashboard/small-business/investments", icon: "Fund" },
  { label: "المحادثات", href: "/dashboard/small-business/messages", icon: "Chat" },
  { label: "التحليلات", href: "/dashboard/small-business/analytics", icon: "Stats" },
  { label: "المساعد الذكي", href: "/dashboard/small-business/assistant", icon: "AI" },
  { label: "خدمة العملاء", href: "/dashboard/small-business/customer-service", icon: "Help" },
  { label: "الملف الشخصي", href: "/dashboard/small-business/profile", icon: "Me" },
];

export default function SmallBusinessSidebar({
  sidebarOpen,
  setSidebarOpen,
}: {
  sidebarOpen: boolean;
  setSidebarOpen: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard/small-business") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside
      className={`
        fixed top-0 right-0 z-30 flex h-full w-64 flex-col bg-[#273347] text-white
        transform transition-transform duration-300
        ${sidebarOpen ? "translate-x-0" : "translate-x-full"}
        md:static md:h-screen md:translate-x-0
      `}
    >
      <div className="border-b border-white/10 px-6 py-6">
        <h1 className="text-xl font-bold">منصة الأعمال الذكية</h1>
        <p className="mt-1 text-xs text-white/50">لوحة المشروع الصغير</p>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
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
            <span className="w-10 text-xs font-semibold text-white/60">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-white/70 transition-all hover:bg-white/10 hover:text-white"
        >
          <span className="w-10 text-xs font-semibold text-white/60">Exit</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  );
}
