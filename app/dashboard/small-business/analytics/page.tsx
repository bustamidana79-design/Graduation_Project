"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type BuyerOrder = {
  id: string;
  status: string;
  total_amount: number | string | null;
  subtotal: number | string | null;
  currency: string | null;
  created_at: string;
  order_items?: {
    quantity: number | string | null;
    unit_price: number | string | null;
    products?: { id: string; name: string | null } | null;
  }[];
  delivery_orders?: {
    status: string | null;
    shipping_fee: number | string | null;
  }[];
};

const statusLabels: Record<string, string> = {
  pending: "قيد المراجعة",
  confirmed: "مؤكد",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  delivered: "تم التسليم",
  cancelled: "ملغي",
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function SmallBusinessAnalyticsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("orders")
        .select("id, status, total_amount, subtotal, currency, created_at, order_items(quantity, unit_price, products(id, name)), delivery_orders(status, shipping_fee)")
        .eq("buyer_id", profile.id)
        .eq("status", "paid")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setOrders([]);
      } else {
        setOrders((data as unknown as BuyerOrder[] | null) || []);
      }

      setLoading(false);
    };

    void loadAnalytics();
  }, [profile?.id]);

  const currency = orders[0]?.currency || "ILS";

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, order) => sum + toNumber(order.total_amount || order.subtotal), 0);
    const shippingFees = orders.reduce(
      (sum, order) => sum + (order.delivery_orders || []).reduce((feeSum, delivery) => feeSum + toNumber(delivery.shipping_fee), 0),
      0
    );
    const itemCount = orders.reduce(
      (sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0),
      0
    );
    const delivered = orders.filter((order) => order.delivery_orders?.some((delivery) => delivery.status === "delivered"));

    return {
      ordersCount: orders.length,
      totalSpent,
      shippingFees,
      itemCount,
      deliveredCount: delivered.length,
      averageOrder: orders.length ? totalSpent / orders.length : 0,
    };
  }, [orders]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), orders: 0, amount: 0 };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) return;
      bucket.orders += 1;
      bucket.amount += toNumber(order.total_amount || order.subtotal);
    });

    return buckets;
  }, [orders]);

  const topProducts = useMemo(() => {
    const totals = new Map<string, { id: string | null; name: string; quantity: number; amount: number }>();
    orders.forEach((order) => {
      (order.order_items || []).forEach((item) => {
        const name = item.products?.name || "منتج غير محدد";
        const key = item.products?.id || name;
        const current = totals.get(key) || { id: item.products?.id || null, name, quantity: 0, amount: 0 };
        const quantity = toNumber(item.quantity);
        current.quantity += quantity;
        current.amount += toNumber(item.unit_price) * quantity;
        totals.set(key, current);
      });
    });
    return Array.from(totals.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [orders]);

  const statusBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => totals.set(order.status, (totals.get(order.status) || 0) + 1));
    return Array.from(totals.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const maxOrders = Math.max(...monthly.map((item) => item.orders), 1);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-6 py-8" dir="rtl">
      <section className="mb-6 rounded-2xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">تحليلات المشروع</p>
        <h1 className="mt-2 text-3xl font-bold">تحليل المشتريات والطلبات</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          راقب مشتريات مشروعك، متوسط الطلب، رسوم الشحن، والمنتجات الأكثر شراءً.
        </p>
      </section>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="rounded-2xl bg-white py-14 text-center text-sm text-[#273347]/45">جاري تحميل التحليلات...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-6">
            {[
              { label: "عدد الطلبات", value: stats.ordersCount.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "إجمالي المشتريات", value: formatAmount(stats.totalSpent, currency), color: "border-r-4 border-blue-400" },
              { label: "متوسط الطلب", value: formatAmount(stats.averageOrder, currency), color: "border-r-4 border-cyan-400" },
              { label: "القطع المشتراة", value: stats.itemCount.toLocaleString("ar"), color: "border-r-4 border-purple-400" },
              { label: "طلبات مسلمة", value: stats.deliveredCount.toLocaleString("ar"), color: "border-r-4 border-emerald-400" },
              { label: "رسوم الشحن", value: formatAmount(stats.shippingFees, currency), color: "border-r-4 border-yellow-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h2 className="mb-4 text-sm font-bold text-[#273347]">الطلبات الشهرية</h2>
            <div className="flex h-40 items-end gap-2">
              {monthly.map((item) => (
                <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.orders}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    title={`القيمة: ${formatAmount(item.amount, currency)}`}
                    style={{ height: `${Math.max((item.orders / maxOrders) * 100, item.orders ? 8 : 2)}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">المنتجات الأكثر شراءً</h2>
              {topProducts.length === 0 ? (
                <p className="text-sm text-[#273347]/45">لا توجد منتجات مشتراة بعد.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((item) => (
                    <Link
                      key={item.id || item.name}
                      href={item.id ? `/dashboard/small-business/products/${item.id}` : "/dashboard/small-business/products"}
                      className="flex items-center justify-between rounded-2xl bg-[#f6f8fb] px-4 py-3 transition hover:bg-[#eef3f8]"
                    >
                      <span className="font-semibold text-[#273347]">{item.name}</span>
                      <span className="text-sm text-[#273347]/60">{item.quantity.toLocaleString("ar")} قطعة</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">حالات الطلبات</h2>
              {statusBreakdown.length === 0 ? (
                <p className="text-sm text-[#273347]/45">لا توجد حالات بعد.</p>
              ) : (
                <div className="space-y-3">
                  {statusBreakdown.map((item) => (
                    <div key={item.status} className="flex items-center justify-between rounded-2xl bg-[#f6f8fb] px-4 py-3">
                      <span className="font-semibold text-[#273347]">{statusLabels[item.status] || item.status}</span>
                      <span className="text-sm text-[#273347]/60">{item.count.toLocaleString("ar")}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          {orders.length > 0 && (
            <section className="mt-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">آخر الطلبات المدفوعة</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {orders.slice(0, 4).map((order) => (
                  <Link
                    key={order.id}
                    href={`/dashboard/small-business/orders/${order.id}`}
                    className="flex items-center justify-between rounded-2xl bg-[#f6f8fb] px-4 py-3 text-sm transition hover:bg-[#eef3f8]"
                  >
                    <span className="font-semibold text-[#273347]">طلب #{order.id.slice(0, 8)}</span>
                    <span className="text-[#273347]/60">
                      {formatAmount(toNumber(order.total_amount || order.subtotal), order.currency || currency)}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
