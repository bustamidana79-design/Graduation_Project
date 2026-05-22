"use client";

import { useEffect, useMemo, useState } from "react";
import { MapPin, PackageCheck, RotateCw, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { StatusPill, TrackingTimeline } from "@/components/orders/TrackingTimeline";

type DeliveryOrder = {
  id: string;
  status?: string | null;
  tracking_number?: string | null;
  shipping_fee?: number | null;
  avg_delivery_time?: string | null;
  created_at?: string | null;
  orders?: {
    id?: string;
    total_amount?: number | null;
    currency?: string | null;
    phone?: string | null;
    city?: string | null;
    area?: string | null;
    notes?: string | null;
  } | null;
  delivery_tracking?: Array<{
    id?: string;
    status?: string | null;
    description?: string | null;
    location?: string | null;
    created_at?: string | null;
  }>;
};

const deliveryStatuses = ["picked_up", "in_transit", "out_for_delivery", "delivered"];

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

export default function ShippingCompanyOrdersPage() {
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [locations, setLocations] = useState<Record<string, string>>({});

  const activeCount = useMemo(() => orders.filter((order) => order.status !== "delivered").length, [orders]);

  const loadOrders = async () => {
    setLoading(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/delivery/orders", { headers });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحميل طلبات التوصيل.");
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
    window.addEventListener("delivery-orders:changed", reload);
    window.addEventListener("delivery-tracking:changed", reload);
    return () => {
      window.removeEventListener("delivery-orders:changed", reload);
      window.removeEventListener("delivery-tracking:changed", reload);
    };
  }, []);

  const updateStatus = async (deliveryOrderId: string, status: string) => {
    setSavingId(deliveryOrderId);
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/delivery/orders/${deliveryOrderId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        status,
        note: notes[deliveryOrderId] || undefined,
        location: locations[deliveryOrderId] || undefined,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحديث حالة التوصيل.");
    } else {
      setOrders((current) => current.map((order) => (order.id === deliveryOrderId ? { ...order, status } : order)));
      setNotes((current) => ({ ...current, [deliveryOrderId]: "" }));
      setMessage("تم تحديث حالة التوصيل.");
      void loadOrders();
    }
    setSavingId(null);
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">طلبات التوصيل</h1>
          <p className="mt-1 text-sm text-[#273347]/60">حدّث مسار الشحنة وأضف ملاحظات تظهر للمشتري.</p>
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
          <p className="text-xs font-semibold text-[#273347]/55">كل الشحنات</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{orders.length}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">قيد التوصيل</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{activeCount}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">تم تسليمها</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{orders.filter((order) => order.status === "delivered").length}</p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل طلبات التوصيل...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-8 text-center">
          <Truck className="mx-auto text-[#9aaabd]" size={34} />
          <p className="mt-3 font-bold text-[#273347]">لا توجد شحنات مسندة حالياً</p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((deliveryOrder) => {
            const order = deliveryOrder.orders;
            const currency = normalizeCurrency(order?.currency);

            return (
              <article key={deliveryOrder.id} className="rounded-lg border border-[#e6edf5] bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef3f8] pb-4">
                  <div>
                    <p className="text-xs font-semibold text-[#273347]/45">{formatDate(deliveryOrder.created_at)}</p>
                    <h2 className="mt-1 text-lg font-bold text-[#273347]">شحنة #{deliveryOrder.tracking_number || deliveryOrder.id.slice(0, 8)}</h2>
                  </div>
                  <StatusPill status={deliveryOrder.status} />
                </div>

                <div className="grid gap-4 py-4 lg:grid-cols-[1fr_300px]">
                  <div className="space-y-3 text-sm text-[#273347]">
                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-lg bg-[#f8fafc] p-3">
                        <p className="text-xs font-semibold text-[#273347]/55">العنوان</p>
                        <p className="mt-1 font-bold">{[order?.city, order?.area].filter(Boolean).join(" - ") || "غير محدد"}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] p-3">
                        <p className="text-xs font-semibold text-[#273347]/55">الهاتف</p>
                        <p className="mt-1 font-bold">{order?.phone || "غير محدد"}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] p-3">
                        <p className="text-xs font-semibold text-[#273347]/55">قيمة الطلب</p>
                        <p className="mt-1 font-bold">{formatMoney(Number(order?.total_amount || 0), currency)}</p>
                      </div>
                      <div className="rounded-lg bg-[#f8fafc] p-3">
                        <p className="text-xs font-semibold text-[#273347]/55">رسوم الشحن</p>
                        <p className="mt-1 font-bold">{formatMoney(Number(deliveryOrder.shipping_fee || 0), currency)}</p>
                      </div>
                    </div>
                    {order?.notes && <p className="rounded-lg border border-[#e6edf5] p-3">{order.notes}</p>}
                    <TrackingTimeline status={deliveryOrder.status} tracking={deliveryOrder.delivery_tracking || []} />
                  </div>

                  <div className="space-y-3 rounded-lg border border-[#e6edf5] p-4">
                    <label className="grid gap-2 text-xs font-bold text-[#273347]">
                      الحالة الجديدة
                      <select
                        value={deliveryOrder.status || "picked_up"}
                        onChange={(event) => void updateStatus(deliveryOrder.id, event.target.value)}
                        disabled={savingId === deliveryOrder.id}
                        className="rounded-lg border border-[#d8e1ec] bg-white px-3 py-2 text-sm"
                      >
                        {deliveryStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#273347]">
                      الموقع
                      <div className="relative">
                        <MapPin className="absolute right-3 top-3 text-[#9aaabd]" size={15} />
                        <input
                          value={locations[deliveryOrder.id] || ""}
                          onChange={(event) => setLocations((current) => ({ ...current, [deliveryOrder.id]: event.target.value }))}
                          className="w-full rounded-lg border border-[#d8e1ec] py-2 pl-3 pr-9 text-sm"
                          placeholder="مثلاً: رام الله"
                        />
                      </div>
                    </label>
                    <label className="grid gap-2 text-xs font-bold text-[#273347]">
                      ملاحظة التتبع
                      <textarea
                        value={notes[deliveryOrder.id] || ""}
                        onChange={(event) => setNotes((current) => ({ ...current, [deliveryOrder.id]: event.target.value }))}
                        className="min-h-24 rounded-lg border border-[#d8e1ec] px-3 py-2 text-sm"
                        placeholder="مثلاً: تم استلام الطرد من المورد"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => void updateStatus(deliveryOrder.id, deliveryOrder.status || "picked_up")}
                      disabled={savingId === deliveryOrder.id}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      <PackageCheck size={16} />
                      {savingId === deliveryOrder.id ? "جاري الحفظ..." : "إضافة تحديث"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
