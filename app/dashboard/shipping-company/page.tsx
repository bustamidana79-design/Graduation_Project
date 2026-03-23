"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

type Profile = {
  full_name: string;
  account_type: string;
  status: string;
};


const mockAnalytics = [
  { month: "يناير", deliveries: 8 },
  { month: "فبراير", deliveries: 15 },
  { month: "مارس", deliveries: 12 },
  { month: "أبريل", deliveries: 20 },
  { month: "مايو", deliveries: 18 },
  { month: "يونيو", deliveries: 25 },
];

export default function DeliveryDashboard() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const stats = {
    incoming: 5,
    inProgress: 3,
    completed: 42,
    rating: 4.8,
  };

  useEffect(() => {
    // fetchProfile();
    setLoading(false);
  }, []);

  const fetchProfile = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) { router.push("/login"); return; }

    const { data } = await supabase
      .from("profiles")
      .select("full_name, account_type, status")
      .eq("id", user.id)
      .single();

    if (data) {
      if (data.status !== "approved") { router.push("/pending"); return; }
      if (data.account_type !== "delivery") { router.push("/"); return; }
      setProfile(data);
    }

    setLoading(false);
  };

  const maxDeliveries = Math.max(...mockAnalytics.map((a) => a.deliveries));

  const statCards = [
    { label: "طلبات واردة", value: stats.incoming, icon: "📥", color: "border-r-4 border-[#273347]" },
    { label: "قيد التوصيل", value: stats.inProgress, icon: "🚚", color: "border-r-4 border-blue-400" },
    { label: "مكتملة", value: stats.completed, icon: "✅", color: "border-r-4 border-green-400" },
    { label: "تقييم الخدمة", value: `${stats.rating} ⭐`, icon: "🏅", color: "border-r-4 border-yellow-400" },
  ];

  return (
        <div className="p-8" dir="rtl">

      {/* Main Content */}

        <div className="flex-1 px-6 py-8 max-w-5xl w-full mx-auto">

          {/* Welcome Banner */}
          <div className="bg-[#273347] text-white rounded-2xl px-8 py-6 mb-8">
            <h2 className="text-2xl font-bold">
              مرحباً، {loading ? "..." : profile?.full_name} 👋
            </h2>
            <p className="text-white/60 text-sm mt-1">إليك ملخص نشاط شركتك</p>
          </div>

          {loading ? (
            <div className="text-center text-[#273347]/40 text-sm py-10">جارٍ التحميل...</div>
          ) : (
            <>
              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {statCards.map((card) => (
                  <div key={card.label} className={`bg-white rounded-2xl p-5 shadow-sm ${card.color}`}>
                    <div className="text-2xl mb-2">{card.icon}</div>
                    <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                    <p className="text-xs text-[#273347]/50 mt-1">{card.label}</p>
                  </div>
                ))}
              </div>

              {/* التحليلات */}
              <div className="bg-white rounded-2xl border border-[#e6edf5] p-6 mb-6">
                <h3 className="text-sm font-bold text-[#273347] mb-4">📊 تحليل التوصيلات</h3>
                <div className="flex items-end gap-2 h-36">
                  {mockAnalytics.map((item) => (
                    <div key={item.month} className="flex-1 flex flex-col items-center gap-1">
                      <p className="text-xs font-bold text-[#273347]/50">{item.deliveries}</p>
                      <div
                        className="w-full bg-[#bbd0e4] rounded-t-md hover:bg-[#273347] transition"
                        style={{ height: `${(item.deliveries / maxDeliveries) * 100}%` }}
                      />
                      <p className="text-[10px] text-[#273347]/50">{item.month.slice(0, 3)}</p>
                    </div>
                  ))}
                </div>
              </div>

        
            </>
          )}
        </div>
</div>
  );
}