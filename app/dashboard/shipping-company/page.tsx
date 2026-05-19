"use client";

import { useEffect, useMemo, useState } from "react";
import DailyTipCard from "@/components/DailyTipCard";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import { supabase } from "@/lib/supabase";

type DeliveryOrder = {
  id: string;
  status: string;
  shipping_fee: number | string | null;
  created_at: string;
  orders?: {
    currency: string | null;
  } | null;
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function DeliveryDashboard() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "delivery" });
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("delivery_orders")
        .select("id, status, shipping_fee, created_at, orders(currency)")
        .eq("shipping_company_id", profile.id)
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setOrders([]);
      } else {
        setOrders((data as unknown as DeliveryOrder[] | null) || []);
      }

      setLoading(false);
    };

    void loadDashboard();
  }, [profile?.id]);

  const currency = orders[0]?.orders?.currency || "ILS";

  const stats = useMemo(() => {
    const active = orders.filter((order) => order.status !== "delivered");
    const delivered = orders.filter((order) => order.status === "delivered");
    const totalFees = orders.reduce((sum, order) => sum + toNumber(order.shipping_fee), 0);

    return {
      incoming: orders.filter((order) => order.status === "picked_up").length,
      inProgress: active.length,
      completed: delivered.length,
      totalFees,
      averageFee: orders.length ? totalFees / orders.length : 0,
    };
  }, [orders]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), deliveries: 0, fees: 0 };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) return;
      bucket.deliveries += 1;
      bucket.fees += toNumber(order.shipping_fee);
    });

    return buckets;
  }, [orders]);

  const maxDeliveries = Math.max(...monthly.map((item) => item.deliveries), 1);

  return (
    <div className="mx-auto flex-1 w-full max-w-5xl px-6 py-8" dir="rtl">
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحبا، {accessLoading ? "..." : profile?.full_name || "شركة الشحن"}</h2>
        <p className="mt-1 text-sm text-white/60">ملخص توصيلاتك ورسوم الشحن من البيانات الفعلية</p>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جاري التحميل...</div>
      ) : (
        <>
          <DailyTipCard />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "طلبات واردة", value: stats.incoming.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "قيد التوصيل", value: stats.inProgress.toLocaleString("ar"), color: "border-r-4 border-blue-400" },
              { label: "مكتملة", value: stats.completed.toLocaleString("ar"), color: "border-r-4 border-green-400" },
              { label: "إجمالي الرسوم", value: formatAmount(stats.totalFees, currency), color: "border-r-4 border-yellow-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-5">
            <p className="mb-2 text-sm text-[#273347]/60">متوسط رسوم التوصيل</p>
            <h3 className="text-2xl font-bold text-[#273347]">{formatAmount(stats.averageFee, currency)}</h3>
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#273347]">التوصيلات خلال آخر 6 أشهر</h3>
            <div className="flex h-36 items-end gap-2">
              {monthly.map((item) => (
                <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.deliveries}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    title={formatAmount(item.fees, currency)}
                    style={{ height: `${Math.max((item.deliveries / maxDeliveries) * 100, item.deliveries ? 8 : 2)}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
