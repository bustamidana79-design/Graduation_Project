"use client";

import { useState } from "react";
import SmallBusinessSidebar from "./components/Small-BusinessSidebar";

export default function SmallBusinessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SmallBusinessSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 flex items-center justify-between sticky top-0 z-10">
          <button
            className="md:hidden text-[#273347] text-xl"
            onClick={() => setSidebarOpen(true)}
          >
            ☰
          </button>

          <div className="flex items-center gap-3 mr-auto">
            <div className="text-right">
              <p className="text-sm font-semibold text-[#273347]">اسم المستخدم</p>
              <p className="text-xs text-[#273347]/50">صاحب مشروع صغير</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              م
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