"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import SupplierSidebar from "./components/SupplierSidebar";

type Profile = {
  full_name: string;
};

export default function SupplierLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();
      if (data) setProfile(data);
    };
    fetchProfile();
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex" dir="rtl">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <SupplierSidebar
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />

      <button
        className="md:hidden fixed top-4 left-4 z-40 bg-white border border-[#e6edf5] text-[#273347] px-3 py-2 rounded-xl shadow-sm"
        onClick={() => setSidebarOpen(true)}
      >
        ☰
      </button>

      <main className="flex-1 flex flex-col min-h-screen">
        <header className="bg-white border-b border-[#e6edf5] px-6 py-4 sticky top-0 z-10">
          <div className="flex items-center justify-end gap-3">
            <div className="text-sm">
              <p className="font-semibold text-[#273347]">
                {profile?.full_name || "اسم المستخدم"}
              </p>
              <p className="text-[#273347]/50 text-xs">مورد</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-[#273347] text-white flex items-center justify-center text-sm font-bold">
              {profile?.full_name?.charAt(0) || "م"}
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