"use client";

import AdminSidebar from "./components/AdminSidebar";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import NotificationBell from "@/components/NotificationBell";
import OrderRealtimeBridge from "@/components/OrderRealtimeBridge";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loading } = useDashboardAccess({ requiredAccountType: "admin" });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8fafc] text-[#273347]/60" dir="rtl">
        جاري تحميل لوحة الإدارة...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#f8fafc]" dir="rtl">
      <OrderRealtimeBridge />
      <AdminSidebar />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e6edf5] bg-white px-6 py-4">
          <div className="text-sm font-semibold text-[#273347]"></div>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="text-right">
              <p className="text-sm font-semibold text-[#273347]">Admin</p>
              <p className="text-xs text-[#273347]/50">مدير النظام</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#273347] text-sm font-bold text-white">
              A
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
