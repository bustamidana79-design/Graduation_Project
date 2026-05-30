"use client";

import { useEffect, useMemo, useState } from "react";
import DailyTipCard from "@/components/DailyTipCard";
import { VerticalBarChart } from "@/components/SimpleCharts";
import SmallBusinessUpgradeRequestCard from "@/components/SmallBusinessUpgradeRequestCard";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import { supabase } from "@/lib/supabase";

type BuyerOrder = {
  id: string;
  status: string;
  total_amount: number | string | null;
  subtotal: number | string | null;
  currency: string | null;
  created_at: string;
  order_items?: { quantity: number | string | null }[];
};

type ShowcaseItem = {
  id: string;
};

const monthFormatter = new Intl.DateTimeFormat("ar", { month: "short" });

function toNumber(value: number | string | null | undefined) {
  const nextValue = Number(value || 0);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function formatAmount(amount: number, currency = "ILS") {
  return `${amount.toLocaleString("ar")} ${currency}`;
}

export default function SmallBusinessDashboardPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [cartItemsCount, setCartItemsCount] = useState(0);
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadDashboard = async () => {
      setLoading(true);
      setError("");

      const cartResult = await supabase.from("carts").select("id").eq("user_id", profile.id).maybeSingle();
      const cartId = cartResult.data?.id;

      const [ordersResult, showcaseResult, favoritesResult, cartItemsResult] = await Promise.all([
        supabase
          .from("orders")
          .select("id, status, total_amount, subtotal, currency, created_at, order_items(quantity)")
          .eq("buyer_id", profile.id)
          .order("created_at", { ascending: false }),
        supabase.from("small_business_showcase_items").select("id").eq("user_id", profile.id),
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", profile.id),
        cartId
          ? supabase.from("cart_items").select("id", { count: "exact", head: true }).eq("cart_id", cartId)
          : Promise.resolve({ count: 0, error: null }),
      ]);

      if (ordersResult.error || showcaseResult.error || favoritesResult.error || cartItemsResult.error) {
        setError(
          ordersResult.error?.message ||
            showcaseResult.error?.message ||
            favoritesResult.error?.message ||
            cartItemsResult.error?.message ||
            "تعذر تحميل بيانات الداشبورد."
        );
        setOrders([]);
        setShowcaseItems([]);
        setFavoritesCount(0);
        setCartItemsCount(0);
      } else {
        setOrders((ordersResult.data as unknown as BuyerOrder[] | null) || []);
        setShowcaseItems((showcaseResult.data as ShowcaseItem[] | null) || []);
        setFavoritesCount(favoritesResult.count || 0);
        setCartItemsCount(cartItemsResult.count || 0);
      }

      setLoading(false);
    };

    void loadDashboard();
  }, [profile?.id]);

  const currency = orders[0]?.currency || "ILS";

  const stats = useMemo(() => {
    const totalSpent = orders.reduce((sum, order) => sum + toNumber(order.total_amount || order.subtotal), 0);
    const itemCount = orders.reduce(
      (sum, order) => sum + (order.order_items || []).reduce((itemSum, item) => itemSum + toNumber(item.quantity), 0),
      0
    );

    return {
      productsCount: showcaseItems.length,
      ordersCount: orders.length,
      totalSpent,
      itemCount,
      activeOrders: orders.filter((order) => !["delivered", "cancelled"].includes(order.status)).length,
    };
  }, [orders, showcaseItems.length]);

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

  const monthlyChart = monthly.map((item) => ({
    key: item.key,
    label: item.month,
    value: item.orders,
    hint: formatAmount(item.amount, currency),
    color: "#52789f",
  }));

  return (
    <>
      <div className="mb-8 rounded-2xl bg-[#273347] px-8 py-6 text-white">
        <h2 className="text-2xl font-bold">مرحبا، {accessLoading ? "..." : profile?.full_name || "صاحب المشروع"}</h2>
        <p className="mt-1 text-sm text-white/60">ملخص مشترياتك ونشاط مشروعك من البيانات الفعلية</p>
      </div>

      {error && <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading || accessLoading ? (
        <div className="py-10 text-center text-sm text-[#273347]/40">جاري التحميل...</div>
      ) : (
        <>
          <DailyTipCard />

          <SmallBusinessUpgradeRequestCard />

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              { label: "طلبات الشراء", value: stats.ordersCount.toLocaleString("ar"), color: "border-r-4 border-[#273347]" },
              { label: "إجمالي المشتريات", value: formatAmount(stats.totalSpent, currency), color: "border-r-4 border-blue-400" },
              { label: "عناصر بالسلة", value: cartItemsCount.toLocaleString("ar"), color: "border-r-4 border-yellow-400" },
              { label: "منتجات مفضلة", value: favoritesCount.toLocaleString("ar"), color: "border-r-4 border-rose-400" },
            ].map((card) => (
              <div key={card.label} className={`rounded-2xl bg-white p-5 shadow-sm ${card.color}`}>
                <p className="text-2xl font-bold text-[#273347]">{card.value}</p>
                <p className="mt-1 text-xs text-[#273347]/50">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">منتجات معرض المشروع</p>
              <h3 className="text-2xl font-bold text-[#273347]">{stats.productsCount.toLocaleString("ar")}</h3>
            </div>
            <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
              <p className="mb-2 text-sm text-[#273347]/60">طلبات نشطة</p>
              <h3 className="text-2xl font-bold text-[#273347]">{stats.activeOrders.toLocaleString("ar")}</h3>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-[#e6edf5] bg-white p-6">
            <h3 className="mb-4 text-sm font-bold text-[#273347]">طلبات الشراء خلال آخر 6 أشهر</h3>
            <VerticalBarChart data={monthlyChart} heightClass="h-40" />
          </div>
        </>
      )}
    </>
  );
}
