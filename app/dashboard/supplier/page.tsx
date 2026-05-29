"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import DailyTipCard from "@/components/DailyTipCard";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import { supabase } from "@/lib/supabase";

type SupplierOrder = {
  id: string;
  status: string;
  total_amount: number | string | null;
  subtotal: number | string | null;
  currency: string | null;
  created_at: string;
};

type Product = {
  id: string;
  is_published: boolean | null;
  stock_quantity: number | string | null;
  currency: string | null;
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function SupplierDashboardPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "merchant" });
  const [orders, setOrders] = useState<SupplierOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      const [ordersResult, productsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, subtotal, currency, created_at")
          .eq("supplier_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("products")
          .select("id, is_published, stock_quantity, currency")
          .eq("supplier_id", profile.id),
      ]);

      if (ordersResult.error || productsResult.error) {
        setError(ordersResult.error?.message || productsResult.error?.message || "تعذر تحميل بيانات الداشبورد.");
        setOrders([]);
        setProducts([]);
      } else {
        setOrders((ordersResult.data as SupplierOrder[] | null) || []);
        setProducts((productsResult.data as Product[] | null) || []);
      }

      setLoading(false);
    };

    void loadDashboard();
  }, [profile?.id]);

  const currency = orders[0]?.currency || products[0]?.currency || "ILS";

  const stats = useMemo(() => {
    const totalSales = orders.reduce((sum, order) => sum + toNumber(order.total_amount || order.subtotal), 0);
    const incomingOrders = orders.filter((order) => ["pending", "confirmed", "paid", "processing"].includes(order.status)).length;
    const completedOrders = orders.filter((order) => ["delivered", "shipped"].includes(order.status)).length;
    const lowStock = products.filter((product) => toNumber(product.stock_quantity) <= 5).length;

    return {
      products: products.length,
      publishedProducts: products.filter((product) => product.is_published).length,
      incomingOrders,
      completedOrders,
      totalSales,
      lowStock,
    };
  }, [orders, products]);

  const monthly = useMemo(() => {
    const now = new Date();
    const buckets = Array.from({ length: 6 }).map((_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return { key, month: monthFormatter.format(date), sales: 0, orders: 0 };
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

  const maxSales = Math.max(...monthly.map((item) => item.sales), 1);

  return (
    <>
      <div className="mb-8 flex flex-col gap-4 rounded-2xl bg-[#273347] px-8 py-6 text-white md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold">مرحبا، {accessLoading ? "..." : profile?.full_name || "المورد"}</h2>
          <p className="mt-1 text-sm text-white/60">ملخص مباشر من بيانات منتجاتك وطلباتك</p>
        </div>
        <Link
          href="/dashboard/supplier/assistant"
          className="inline-flex items-center justify-center rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#273347] transition hover:bg-[#eef4fa]"
        >
          AI Assistant
        </Link>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جاري التحميل...</div>
      ) : (
        <>
          <DailyTipCard />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "المنتجات", value: stats.products.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "منشورة", value: stats.publishedProducts.toLocaleString("ar"), color: "border-r-4 border-emerald-400" },
              { label: "طلبات نشطة", value: stats.incomingOrders.toLocaleString("ar"), color: "border-r-4 border-blue-400" },
              { label: "إجمالي المبيعات", value: formatAmount(stats.totalSales, currency), color: "border-r-4 border-yellow-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">طلبات مكتملة أو مشحونة</p>
              <h3 className="text-2xl font-bold text-[#273347]">{stats.completedOrders.toLocaleString("ar")}</h3>
            </div>
            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">منتجات بمخزون منخفض</p>
              <h3 className="text-2xl font-bold text-[#273347]">{stats.lowStock.toLocaleString("ar")}</h3>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#273347]">المبيعات خلال آخر 6 أشهر</h3>
            <div className="flex h-36 items-end gap-2">
              {monthly.map((item) => (
                <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                  <p className="text-xs font-bold text-[#273347]/50">{item.orders}</p>
                  <div
                    className="w-full rounded-t-md bg-[#bbd0e4] transition hover:bg-[#273347]"
                    title={formatAmount(item.sales, currency)}
                    style={{ height: `${Math.max((item.sales / maxSales) * 100, item.sales ? 8 : 2)}%` }}
                  />
                  <p className="text-[10px] text-[#273347]/50">{item.month}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
