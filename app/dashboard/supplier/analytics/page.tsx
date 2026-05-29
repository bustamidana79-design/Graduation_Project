"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type SupplierOrder = {
  id: string;
  status: string;
  total_amount: number | string | null;
  subtotal: number | string | null;
  currency: string | null;
  created_at: string;
  buyer_id: string;
  order_items?: {
    quantity: number | string | null;
    unit_price: number | string | null;
    products?: { id: string; name: string | null } | null;
  }[];
};

type Product = {
  id: string;
  name: string | null;
  wholesale_price: number | string | null;
  currency: string | null;
  stock_quantity: number | string | null;
  is_published: boolean | null;
  created_at: string;
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

export default function SupplierAnalyticsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "merchant" });
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadAnalytics = async () => {
      setLoading(true);
      setError("");

      const [ordersResult, productsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, subtotal, currency, created_at, buyer_id, order_items(quantity, unit_price, products(id, name))")
          .eq("supplier_id", profile.id)
          .neq("status", "pending_payment")
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, name, wholesale_price, currency, stock_quantity, is_published, created_at")
          .eq("supplier_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);

      if (ordersResult.error || productsResult.error) {
        setError(ordersResult.error?.message || productsResult.error?.message || "تعذر تحميل التحليلات.");
        setOrders([]);
        setProducts([]);
      } else {
        setOrders((ordersResult.data as unknown as SupplierOrder[] | null) || []);
        setProducts((productsResult.data as unknown as Product[] | null) || []);
      }

      setLoading(false);
    };

    void loadAnalytics();
  }, [profile?.id]);

  const currency = orders[0]?.currency || products[0]?.currency || "ILS";

  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, order) => sum + toNumber(order.total_amount || order.subtotal), 0);
    const soldUnits = orders.reduce(
      (sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0),
      0
    );
    const activeOrders = orders.filter((order) => !["delivered", "cancelled"].includes(order.status));
    const publishedProducts = products.filter((product) => product.is_published);
    const inventoryValue = products.reduce(
      (sum, product) => sum + toNumber(product.wholesale_price) * toNumber(product.stock_quantity),
      0
    );
    const uniqueBuyers = new Set(orders.map((order) => order.buyer_id).filter(Boolean));

    return {
      products: products.length,
      publishedProducts: publishedProducts.length,
      orders: orders.length,
      activeOrders: activeOrders.length,
      totalSales,
      soldUnits,
      inventoryValue,
      uniqueBuyers: uniqueBuyers.size,
    };
  }, [orders, products]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), orders: 0, sales: 0 };
    });
    const byKey = new Map(buckets.map((bucket) => [bucket.key, bucket]));

    orders.forEach((order) => {
      const date = new Date(order.created_at);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const bucket = byKey.get(key);
      if (!bucket) return;
      bucket.orders += 1;
      bucket.sales += toNumber(order.total_amount || order.subtotal);
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
    return Array.from(totals.values()).sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [orders]);

  const lowStockProducts = useMemo(
    () => products.filter((product) => toNumber(product.stock_quantity) <= 5).slice(0, 5),
    [products]
  );

  const statusBreakdown = useMemo(() => {
    const totals = new Map<string, number>();
    orders.forEach((order) => totals.set(order.status, (totals.get(order.status) || 0) + 1));
    return Array.from(totals.entries()).map(([status, count]) => ({ status, count }));
  }, [orders]);

  const maxOrders = Math.max(...monthly.map((item) => item.orders), 1);

  return (
    <main className="mx-auto min-h-screen w-full max-w-6xl flex-1 px-6 py-8" dir="rtl">
      <section className="mb-6 rounded-2xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">تحليلات المورد</p>
        <h1 className="mt-2 text-3xl font-bold">تحليل المبيعات والمنتجات</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          راقب مبيعاتك، الطلبات النشطة، أداء المنتجات، والتنبيهات المهمة للمخزون.
        </p>
      </section>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="rounded-2xl bg-white py-14 text-center text-sm text-[#273347]/45">جاري تحميل التحليلات...</div>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: "إجمالي المبيعات", value: formatAmount(stats.totalSales, currency), color: "border-r-4 border-blue-400" },
              { label: "الطلبات", value: stats.orders.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "طلبات نشطة", value: stats.activeOrders.toLocaleString("ar"), color: "border-r-4 border-cyan-400" },
              { label: "عملاء اشتروا", value: stats.uniqueBuyers.toLocaleString("ar"), color: "border-r-4 border-purple-400" },
              { label: "المنتجات", value: stats.products.toLocaleString("ar"), color: "border-r-4 border-yellow-400" },
              { label: "منشورة", value: stats.publishedProducts.toLocaleString("ar"), color: "border-r-4 border-emerald-400" },
              { label: "القطع المباعة", value: stats.soldUnits.toLocaleString("ar"), color: "border-r-4 border-indigo-400" },
              { label: "قيمة المخزون", value: formatAmount(stats.inventoryValue, currency), color: "border-r-4 border-orange-400" },
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
                    title={`المبيعات: ${formatAmount(item.sales, currency)}`}
                    style={{ height: `${Math.max((item.orders / maxOrders) * 100, item.orders ? 8 : 2)}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">أفضل المنتجات مبيعًا</h2>
              {topProducts.length === 0 ? (
                <p className="text-sm text-[#273347]/45">لا توجد مبيعات منتجات بعد.</p>
              ) : (
                <div className="space-y-3">
                  {topProducts.map((item) => (
                    <Link
                      key={item.id || item.name}
                      href={item.id ? `/dashboard/supplier/products/${item.id}` : "/dashboard/supplier/products"}
                      className="block rounded-2xl bg-[#f6f8fb] px-4 py-3 transition hover:bg-[#eef3f8]"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-[#273347]">{item.name}</span>
                        <span className="text-sm text-[#273347]/60">{formatAmount(item.amount, currency)}</span>
                      </div>
                      <p className="mt-1 text-xs text-[#273347]/45">{item.quantity.toLocaleString("ar")} قطعة</p>
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

            <section className="rounded-2xl border border-[#e6edf5] bg-white p-6">
              <h2 className="mb-4 text-sm font-bold text-[#273347]">تنبيه مخزون منخفض</h2>
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-[#273347]/45">لا توجد منتجات منخفضة المخزون.</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <Link
                      key={product.id}
                      href={`/dashboard/supplier/products/${product.id}`}
                      className="flex items-center justify-between rounded-2xl bg-[#fff8ed] px-4 py-3 transition hover:bg-[#fff1d6]"
                    >
                      <span className="font-semibold text-[#273347]">{product.name || "منتج غير مسمى"}</span>
                      <span className="text-sm text-amber-700">{toNumber(product.stock_quantity).toLocaleString("ar")} متبقي</span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </main>
  );
}
