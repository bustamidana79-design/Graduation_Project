"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, CreditCard, MapPin, Package, Phone, RotateCw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { StatusPill, TrackingTimeline } from "@/components/orders/TrackingTimeline";

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  currency?: string;
  products?: { name?: string | null } | null;
};

type Payment = {
  id: string;
  amount: number;
  currency?: string;
  payment_status?: string | null;
};

type DeliveryOrder = {
  id: string;
  status?: string | null;
  tracking_number?: string | null;
  shipping_fee?: number | null;
  avg_delivery_time?: string | null;
  delivery_tracking?: Array<{
    id?: string;
    status?: string | null;
    description?: string | null;
    location?: string | null;
    created_at?: string | null;
  }>;
};

type Order = {
  id: string;
  status?: string | null;
  total_amount: number;
  subtotal?: number | null;
  currency?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  notes?: string | null;
  created_at?: string | null;
  order_items?: OrderItem[];
  delivery_orders?: DeliveryOrder[];
  payments?: Payment[];
};

const ORDERS_PER_PAGE = 3;

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ar", { day: "2-digit", month: "long", year: "numeric" });
}

export default function SmallBusinessOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [trackingSearch, setTrackingSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredOrders = useMemo(() => {
    const query = trackingSearch.trim().toLowerCase();
    if (!query) return orders;

    return orders.filter((order) =>
      order.delivery_orders?.some((delivery) => String(delivery.tracking_number || "").toLowerCase().includes(query))
    );
  }, [orders, trackingSearch]);

  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / ORDERS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const visibleOrders = filteredOrders.slice((safePage - 1) * ORDERS_PER_PAGE, safePage * ORDERS_PER_PAGE);
  const inDeliveryCount = orders.filter((order) =>
    order.delivery_orders?.some((delivery) => delivery.status !== "delivered")
  ).length;

  const loadOrders = async () => {
    setLoading(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/orders", { headers });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحميل الطلبات.");
      setOrders([]);
    } else {
      setOrders(result.orders || []);
      setMessage("");
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      if (payment === "success") setMessage("تم تأكيد الدفع بنجاح. الطلب أصبح جاهزًا للمتابعة.");
      if (payment === "failed") setMessage("تعذر تأكيد الدفع. إذا تم الخصم، انتظر قليلًا ثم حدّث الصفحة.");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const reload = () => void loadOrders();
    window.addEventListener("orders:changed", reload);
    window.addEventListener("delivery-orders:changed", reload);
    window.addEventListener("delivery-tracking:changed", reload);
    return () => {
      window.removeEventListener("orders:changed", reload);
      window.removeEventListener("delivery-orders:changed", reload);
      window.removeEventListener("delivery-tracking:changed", reload);
    };
  }, []);

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">طلباتي</h1>
          <p className="mt-1 text-sm text-[#273347]/60">تظهر هنا الطلبات المدفوعة فقط مع بيانات الشحن والتتبع.</p>
        </div>
        <button
          type="button"
          onClick={() => void loadOrders()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#bbd0e4] bg-white px-4 py-2 text-sm font-semibold text-[#273347]"
        >
          <RotateCw size={16} />
          تحديث
        </button>
      </div>

      {message && <div className="rounded-lg border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">الطلبات المدفوعة</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">قيد التوصيل</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{inDeliveryCount}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">نتائج البحث</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{filteredOrders.length}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e6edf5] bg-white p-4">
        <label className="relative min-w-64 flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#7b8ca3]" size={18} />
          <input
            value={trackingSearch}
            onChange={(event) => {
              setTrackingSearch(event.target.value);
              setPage(1);
            }}
            placeholder="ابحث برقم التتبع"
            className="w-full rounded-lg border border-[#d8e1ec] bg-white py-2 pl-4 pr-10 text-sm text-[#273347] outline-none focus:border-[#273347]"
          />
        </label>
        <div className="flex items-center gap-2 text-sm font-semibold text-[#273347]">
          <button
            type="button"
            disabled={safePage <= 1}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e1ec] disabled:opacity-40"
            title="الصفحة السابقة"
          >
            <ChevronRight size={18} />
          </button>
          <span>
            صفحة {safePage} من {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount}
            onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#d8e1ec] disabled:opacity-40"
            title="الصفحة التالية"
          >
            <ChevronLeft size={18} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل الطلبات...</div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-8 text-center">
          <Package className="mx-auto text-[#9aaabd]" size={34} />
          <p className="mt-3 font-bold text-[#273347]">لا توجد طلبات مدفوعة مطابقة</p>
          <Link href="/dashboard/small-business/products" className="mt-4 inline-flex rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleOrders.map((order) => {
            const currency = normalizeCurrency(order.currency);
            const delivery = order.delivery_orders?.[0];
            const payment = order.payments?.[0];

            return (
              <article key={order.id} className="rounded-lg border border-[#e6edf5] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef3f8] pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">{formatDate(order.created_at)}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#273347]">طلب #{order.id.slice(0, 8)}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={order.status} />
                    <StatusPill status={payment?.payment_status || "paid"} />
                  </div>
                </div>

                <div className="grid gap-4 py-4 lg:grid-cols-[1fr_280px]">
                  <div className="space-y-3">
                    {(order.order_items || []).map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-[#f8fafc] px-3 py-2 text-sm">
                        <span className="font-semibold text-[#273347]">{item.products?.name || "منتج"}</span>
                        <span className="text-[#546a85]">
                          {item.quantity} × {formatMoney(Number(item.unit_price || 0), normalizeCurrency(item.currency || currency))}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-[#e6edf5] p-4 text-sm text-[#273347]">
                    <div className="flex items-center gap-2">
                      <CreditCard size={16} />
                      <span className="font-bold">{formatMoney(Number(order.total_amount || 0), currency)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={16} />
                      <span>{order.phone || "لا يوجد رقم"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin size={16} />
                      <span>{[order.country, order.city, order.area].filter(Boolean).join(" - ") || "لا يوجد عنوان"}</span>
                    </div>
                    {delivery?.tracking_number && (
                      <Link
                        href={`/dashboard/small-business/orders/${order.id}`}
                        className="block rounded-lg bg-[#f6fbff] p-2 text-xs font-semibold text-[#273347] transition hover:bg-[#eaf5ff]"
                      >
                        رقم التتبع: {delivery.tracking_number}
                      </Link>
                    )}
                    <Link
                      href={`/dashboard/small-business/orders/${order.id}`}
                      className="block rounded-lg bg-[#273347] px-3 py-2 text-center text-xs font-semibold text-white"
                    >
                      عرض التفاصيل
                    </Link>
                  </div>
                </div>

                {delivery && <TrackingTimeline status={delivery.status} tracking={delivery.delivery_tracking || []} />}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
