"use client";

import { useState } from "react";
import SmallBusinessSidebar from "./components/Small-BusinessSidebar";
import { getProfileInitial, useDashboardAccess } from "@/hooks/useDashboardAccess";

export default function SmallBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "small_business" });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-[#273347]/60" dir="rtl">
        جاري تحميل لوحة التحكم...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SmallBusinessSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e6edf5] bg-white px-6 py-4">
          <button
            className="text-xl text-[#273347] md:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="mr-auto flex items-center gap-3">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#273347]">
                {profile?.full_name || "صاحب المشروع"}
              </p>
              <p className="text-xs text-[#273347]/50">صاحب مشروع صغير</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#273347] text-sm font-bold text-white">
              {getProfileInitial(profile?.full_name, "ص")}
            </div>
          </div>
        </header>

        <div className="mx-auto flex-1 w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
