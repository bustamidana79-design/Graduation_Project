"use client";

import DeliverySidebar from "./components/Shipping-CompanySidebar";
import { getProfileInitial, useDashboardAccess } from "@/hooks/useDashboardAccess";
import NotificationBell from "@/components/NotificationBell";
import OrderRealtimeBridge from "@/components/OrderRealtimeBridge";

export default function DeliveryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "delivery" });

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
      <DeliverySidebar />
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end border-b border-[#e6edf5] bg-white px-6 py-4">
          <div className="flex items-center gap-3">
            <NotificationBell />
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#273347] text-sm font-bold text-white">
              {getProfileInitial(profile?.full_name, "ش")}
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-[#273347]">{profile?.full_name || "شركة الشحن"}</p>
              <p className="text-xs text-[#273347]/50">شركة شحن</p>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
