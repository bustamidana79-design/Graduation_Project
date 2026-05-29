"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowRight, CreditCard, MapPin, Package, Phone } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { StatusPill, TrackingTimeline } from "@/components/orders/TrackingTimeline";

type Order = {
  id: string;
  status?: string | null;
  total_amount?: number | null;
  subtotal?: number | null;
  shipping_cost?: number | null;
  currency?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  area?: string | null;
  address_text?: string | null;
  notes?: string | null;
  created_at?: string | null;
  order_items?: Array<{
    id: string;
    quantity: number;
    unit_price: number;
    total_price?: number | null;
    line_total?: number | null;
    currency?: string | null;
    products?: { name?: string | null; sku?: string | null } | null;
  }>;
  delivery_orders?: Array<{
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
  }>;
  payments?: Array<{
    id: string;
    amount?: number | null;
    payment_status?: string | null;
    provider_payment_id?: string | null;
  }>;
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

function formatDate(value?: string | null) {
  if (!value) return "غير محدد";
  return new Date(value).toLocaleString("ar", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function SmallBusinessOrderDetailsPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadOrder = async () => {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/orders/${params.id}`, { headers });
      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "تعذر تحميل تفاصيل الطلب.");
        setOrder(null);
      } else {
        setOrder(result.order);
        setError("");
      }

      setLoading(false);
    };

    if (params.id) void loadOrder();
  }, [params.id]);

  const currency = normalizeCurrency(order?.currency);
  const delivery = order?.delivery_orders?.[0];
  const payment = order?.payments?.[0];

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/dashboard/small-business/orders" className="inline-flex items-center gap-2 text-sm font-semibold text-[#546a85]">
            <ArrowRight size={16} />
            الرجوع للطلبات
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-[#273347]">تفاصيل الطلب</h1>
        </div>
        {order && (
          <div className="flex flex-wrap gap-2">
            <StatusPill status={order.status} />
            <StatusPill status={payment?.payment_status || "paid"} />
          </div>
        )}
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل تفاصيل الطلب...</div>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">{error}</div>
      ) : order ? (
        <>
          <section className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="rounded-lg border border-[#e6edf5] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#eef3f8] pb-4">
                <div>
                  <p className="text-xs font-semibold text-[#273347]/45">{formatDate(order.created_at)}</p>
                  <h2 className="mt-1 text-lg font-bold text-[#273347]">طلب #{order.id.slice(0, 8)}</h2>
                </div>
                {delivery?.tracking_number && (
                  <p className="rounded-lg bg-[#f6fbff] px-3 py-2 text-xs font-bold text-[#273347]">
                    رقم التتبع: {delivery.tracking_number}
                  </p>
                )}
              </div>

              <div className="mt-4 space-y-3">
                {(order.order_items || []).map((item) => {
                  const lineTotal = Number(item.line_total ?? item.total_price ?? 0);
                  return (
                    <div key={item.id} className="rounded-lg bg-[#f8fafc] p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <p className="font-bold text-[#273347]">{item.products?.name || "منتج"}</p>
                        <p className="text-[#546a85]">
                          {item.quantity} × {formatMoney(Number(item.unit_price || 0), normalizeCurrency(item.currency || currency))}
                        </p>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#273347]/55">
                        <span>{item.products?.sku ? `رمز المنتج: ${item.products.sku}` : "بدون رمز منتج"}</span>
                        <span className="font-bold text-[#273347]">{formatMoney(lineTotal, currency)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <aside className="space-y-4 rounded-lg border border-[#e6edf5] bg-white p-5 text-sm text-[#273347]">
              <div className="flex items-center gap-2">
                <CreditCard size={16} />
                <span className="font-bold">{formatMoney(Number(order.total_amount || 0), currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Package size={16} />
                <span>الشحن: {formatMoney(Number(order.shipping_cost || delivery?.shipping_fee || 0), currency)}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone size={16} />
                <span>{order.phone || "لا يوجد رقم هاتف"}</span>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5" size={16} />
                <span>
                  {[order.country, order.city, order.area].filter(Boolean).join(" - ") || "لا يوجد عنوان"}
                  {order.address_text ? `، ${order.address_text}` : ""}
                </span>
              </div>
              {order.notes && <p className="rounded-lg bg-[#f8fafc] p-3 text-xs leading-6">{order.notes}</p>}
              {payment?.provider_payment_id && (
                <p className="break-all rounded-lg bg-[#f8fafc] p-3 text-xs">مرجع الدفع: {payment.provider_payment_id}</p>
              )}
            </aside>
          </section>

          {delivery && (
            <section className="rounded-lg border border-[#e6edf5] bg-white p-5">
              <h2 className="mb-4 text-lg font-bold text-[#273347]">تتبع الشحنة</h2>
              <TrackingTimeline status={delivery.status} tracking={delivery.delivery_tracking || []} />
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
