"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

const navItems = [
  { label: "الرئيسية", href: "/dashboard/supporter", icon: "🏠" },
  { label: "استعراض المشاريع", href: "/dashboard/supporter/projects", icon: "🏢" },
  { label: "استثماراتي", href: "/dashboard/supporter/investments", icon: "💼" },
  { label: "المحادثات", href: "/dashboard/supporter/messages", icon: "💬" },
  { label: "المساعد الذكي", href: "/dashboard/supporter/ai", icon: "🤖" },
  { label: "خدمة العملاء", href: "/dashboard/supporter/customer-service", icon: "🎧" },
  { label: "الملف الشخصي", href: "/dashboard/supporter/profile", icon: "👤" },
];

export default function SupporterSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-[#273347] flex flex-col" dir="rtl">
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="text-xl font-bold text-white">منصة الأعمال الذكية</h1>
        <p className="text-xs text-white/40 mt-1">لوحة الداعم</p>
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