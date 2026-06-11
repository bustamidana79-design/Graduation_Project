"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import CorexLogo from "@/components/CorexLogo";
import { supabase } from "../../../../lib/supabase";

const navItems = [
  { label: "الرئيسية", href: "/dashboard/supporter", icon: "🏠" },
  { label: "المستخدمون", href: "/dashboard/supporter/users", icon: "👥" },
  { label: "استعراض المشاريع", href: "/dashboard/supporter/projects", icon: "🏢" },
  { label: "استثماراتي", href: "/dashboard/supporter/investments", icon: "💼" },
  { label: "المحادثات", href: "/dashboard/supporter/messages", icon: "💬" },
  { label: "المساعد الذكي", href: "/dashboard/supporter/assistant", icon: "AI" },
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

  const isActive = (href: string) => {
    if (href === "/dashboard/supporter") return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <aside className="flex min-h-dvh w-64 flex-col bg-[#273347]" dir="rtl">
      <div className="border-b border-white/10 px-6 py-6">
        <h1>
          <CorexLogo className="h-12 w-40" />
        </h1>
        <p className="mt-1 text-xs text-white/40">لوحة الداعم</p>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
              isActive(item.href)
                ? "bg-white/15 text-white"
                : "text-white/60 hover:bg-white/10 hover:text-white"
            }`}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-white/10 px-3 py-4">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <span>🚪</span>
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
