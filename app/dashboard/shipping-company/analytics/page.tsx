"use client";

import { useEffect, useMemo, useState } from "react";
import { HorizontalBarChart, VerticalBarChart } from "@/components/SimpleCharts";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import { supabase } from "@/lib/supabase";

type DeliveryOrder = {
  id: string;
  status: string;
  shipping_fee: number | string | null;
  created_at: string;
  orders?: {
    id: string;
    city: string | null;
    area: string | null;
    total_amount: number | string | null;
    currency: string | null;
    created_at: string;
  } | null;
};

const statusLabels: Record<string, string> = {
  picked_up: "تم الاستلام",
  in_transit: "قيد النقل",
  out_for_delivery: "خارج للتسليم",
  delivered: "تم التسليم",
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function ShippingAnalyticsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "delivery" });
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("delivery_orders")
        .select("id, status, shipping_fee, created_at, orders(id, city, area, total_amount, currency, created_at)")
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

    void loadAnalytics();
  }, [profile?.id]);

  const currency = orders[0]?.orders?.currency || "ILS";

  const stats = useMemo(() => {
    const delivered = orders.filter((order) => order.status === "delivered");
    const active = orders.filter((order) => order.status !== "delivered");
    const totalFees = orders.reduce((sum, order) => sum + toNumber(order.shipping_fee), 0);

    return {
      total: orders.length,
      active: active.length,
      delivered: delivered.length,
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

  const topCities = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => {
      const city = order.orders?.city || "غير محدد";
      totals.set(city, (totals.get(city) || 0) + 1);
    });
    return Array.from(totals.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => totals.set(order.status, (totals.get(order.status) || 0) + 1));
    return Array.from(totals.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const monthlyChart = monthly.map((item) => ({
    key: item.key,
    label: item.month,
    value: item.deliveries,
    hint: `الرسوم: ${formatAmount(item.fees, currency)}`,
    color: "#52789f",
  }));

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-6 py-8" dir="rtl">
      <section className="mb-6 rounded-2xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">تحليلات شركة الشحن</p>
        <h1 className="mt-2 text-3xl font-bold">أداء التوصيل</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          تابع حجم طلبات التوصيل، الرسوم، المدن الأكثر نشاطا، وحالات الشحن الحالية.
        </p>
      </section>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="rounded-2xl bg-white py-14 text-center text-sm text-[#273347]/45">جاري تحميل التحليلات...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
            {[
              { label: "طلبات التوصيل", value: stats.total.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "قيد التوصيل", value: stats.active.toLocaleString("ar"), color: "border-r-4 border-blue-400" },
              { label: "تم تسليمها", value: stats.delivered.toLocaleString("ar"), color: "border-r-4 border-emerald-400" },
              { label: "إجمالي الرسوم", value: formatAmount(stats.totalFees, currency), color: "border-r-4 border-yellow-400" },
              { label: "متوسط الرسوم", value: formatAmount(stats.averageFee, currency), color: "border-r-4 border-cyan-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <section className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h2 className="mb-4 text-sm font-bold text-[#273347]">الطلبات الشهرية</h2>
            <VerticalBarChart data={monthlyChart} heightClass="h-44" />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">المدن الأكثر طلبا</h2>
              <HorizontalBarChart data={topCities.map((item) => ({ key: item.city, label: item.city, value: item.count }))} />
            </section>

            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">حالات التوصيل</h2>
              <HorizontalBarChart
                data={statusBreakdown.map((item) => ({
                  key: item.status,
                  label: statusLabels[item.status] || item.status,
                  value: item.count,
                }))}
              />
            </section>
          </div>
        </>
      )}
    </main>
  );
}
