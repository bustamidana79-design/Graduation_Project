"use client";

import { useState } from "react";
import SupplierSidebar from "./components/SupplierSidebar";
import { getProfileInitial, useDashboardAccess } from "@/hooks/useDashboardAccess";
import NotificationBell from "@/components/NotificationBell";
import OrderRealtimeBridge from "@/components/OrderRealtimeBridge";

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "merchant" });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-[#273347]/60" dir="rtl">
        جاري تحميل لوحة التحكم...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]" dir="rtl">
      <OrderRealtimeBridge />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SupplierSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <button
        className="fixed left-4 top-4 z-40 rounded-xl border border-[#e6edf5] bg-white px-3 py-2 text-[#273347] shadow-sm md:hidden"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      <main className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-10 border-b border-[#e6edf5] bg-white px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <NotificationBell />
            <div className="text-sm">
              <p className="font-semibold text-[#273347]">{profile?.full_name || "المورد"}</p>
              <p className="text-xs text-[#273347]/50">مورد</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#273347] text-sm font-bold text-white">
              {getProfileInitial(profile?.full_name, "م")}
            </div>
          </div>
        </header>

        <div className="mx-auto flex-1 w-full max-w-5xl px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
