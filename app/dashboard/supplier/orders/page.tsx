"use client";

import { useEffect, useMemo, useState } from "react";
import { Package, RotateCw, Save } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { StatusPill, TrackingTimeline } from "@/components/orders/TrackingTimeline";

type Order = {
  id: string;
  status?: string | null;
  total_amount: number;
  currency?: string | null;
  phone?: string | null;
  city?: string | null;
  area?: string | null;
  notes?: string | null;
  created_at?: string | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    currency?: string | null;
    products?: { name?: string | null; sku?: string | null } | null;
  }>;
  delivery_orders?: Array<{
    id: string;
    status?: string | null;
    tracking_number?: string | null;
    delivery_tracking?: Array<{
      id?: string;
      status?: string | null;
      description?: string | null;
      location?: string | null;
      created_at?: string | null;
    }>;
  }>;
};

const supplierStatuses = ["paid", "processing", "shipped"];

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

export default function SupplierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => orders.filter((order) => order.status !== "shipped" && order.status !== "delivered").length,
    [orders]
  );

  const loadOrders = async () => {
    setLoading(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/supplier/orders", { headers });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحميل طلبات المورد.");
      setOrders([]);
    } else {
      setOrders(result.orders || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
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

  const updateStatus = async (orderId: string, status: string) => {
    setSavingId(orderId);
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/supplier/orders/${orderId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحديث حالة الطلب.");
    } else {
      setOrders((current) => current.map((order) => (order.id === orderId ? { ...order, status } : order)));
      setMessage("تم تحديث حالة الطلب.");
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">طلبات المورد</h1>
          <p className="mt-1 text-sm text-[#273347]/60">راجع المنتجات المطلوبة وحدّث حالة التجهيز للمشتري.</p>
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
          <p className="text-xs font-semibold text-[#273347]/55">كل الطلبات</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">قيد المتابعة</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">تم شحنها</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{orders.filter((order) => order.status === "shipped").length}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل الطلبات...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-8 text-center">
          <Package className="mx-auto text-[#9aaabd]" size={34} />
          <p className="mt-3 font-bold text-[#273347]">لا توجد طلبات حالياً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const currency = normalizeCurrency(order.currency);
            const delivery = order.delivery_orders?.[0];

            return (
              <article key={order.id} className="rounded-lg border border-[#e6edf5] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef3f8] pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">{formatDate(order.created_at)}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#273347]">طلب #{order.id.slice(0, 8)}</h2>
                  </div>
                  <StatusPill status={order.status} />
                </div>

                <div className="grid gap-4 py-4 lg:grid-cols-[1fr_260px]">
                  <div className="space-y-3">
                    {(order.order_items || []).map((item) => (
                      <div key={item.id} className="rounded-lg bg-[#f8fafc] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <p className="font-bold text-[#273347]">{item.products?.name || "منتج"}</p>
                          <p className="text-[#546a85]">
                            {item.quantity} × {formatMoney(Number(item.unit_price || 0), normalizeCurrency(item.currency || currency))}
                          </p>
                        </div>
                        {item.products?.sku && <p className="mt-1 text-xs text-[#273347]/45">SKU: {item.products.sku}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-3 rounded-lg border border-[#e6edf5] p-4 text-sm text-[#273347]">
                    <p className="font-bold">{formatMoney(Number(order.total_amount || 0), currency)}</p>
                    <p>{[order.city, order.area].filter(Boolean).join(" - ") || "لا يوجد عنوان"}</p>
                    <p>{order.phone || "لا يوجد رقم هاتف"}</p>
                    {order.notes && <p className="rounded-lg bg-[#f8fafc] p-2 text-xs">{order.notes}</p>}
                    <label className="grid gap-2 text-xs font-bold text-[#273347]">
                      حالة التجهيز
                      <select
                        value={order.status || "pending"}
                        onChange={(event) => void updateStatus(order.id, event.target.value)}
                        disabled={savingId === order.id}
                        className="rounded-lg border border-[#d8e1ec] bg-white px-3 py-2 text-sm"
                      >
                        {supplierStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    {savingId === order.id && (
                      <p className="flex items-center gap-2 text-xs text-[#546a85]">
                        <Save size={14} />
                        جاري الحفظ...
                      </p>
                    )}
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
