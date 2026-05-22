"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CreditCard, MapPin, Package, Phone, RotateCw } from "lucide-react";
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
  payment_url?: string | null;
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
  city?: string | null;
  area?: string | null;
  notes?: string | null;
  created_at?: string | null;
  order_items?: OrderItem[];
  delivery_orders?: DeliveryOrder[];
  payments?: Payment[];
};

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
  const [payingOrderId, setPayingOrderId] = useState("");

  const paidCount = useMemo(
    () => orders.filter((order) => order.payments?.some((payment) => payment.payment_status === "paid")).length,
    [orders]
  );

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
    }
    setLoading(false);
  };

  const createPaymentForOrder = async (orderId: string, currency?: string | null) => {
    setPayingOrderId(orderId);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/payment/create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        orderIds: [orderId],
        currency: normalizeCurrency(currency),
        returnUrl: `${window.location.origin}/dashboard/small-business/orders`,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر إنشاء الدفع.");
      setPayingOrderId("");
      return;
    }

    window.location.assign(result.payment_url || "/dashboard/small-business/orders");
  };

  useEffect(() => {
    const timer = window.setTimeout(() => void loadOrders(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const payment = params.get("payment");
      if (payment === "success") setMessage("تم تأكيد الدفع بنجاح. الطلب صار جاهز للمتابعة.");
      if (payment === "failed") setMessage("تعذر تأكيد الدفع. يمكنك المحاولة مرة أخرى من رابط الدفع.");
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
          <p className="mt-1 text-sm text-[#273347]/60">تابع الدفع، الشحن، وحالة كل طلب من مكان واحد.</p>
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
          <p className="text-xs font-semibold text-[#273347]/55">مدفوعة</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{paidCount}</p>
        </div>
        <div className="rounded-lg border border-[#e6edf5] bg-white p-4">
          <p className="text-xs font-semibold text-[#273347]/55">قيد التوصيل</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">
            {orders.filter((order) => order.delivery_orders?.some((delivery) => delivery.status !== "delivered")).length}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل الطلبات...</div>
      ) : orders.length === 0 ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-8 text-center">
          <Package className="mx-auto text-[#9aaabd]" size={34} />
          <p className="mt-3 font-bold text-[#273347]">لا توجد طلبات بعد</p>
          <Link href="/dashboard/small-business/products" className="mt-4 inline-flex rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
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
                    <StatusPill status={payment?.payment_status || "pending"} />
                  </div>
                </div>

                <div className="grid gap-4 py-4 lg:grid-cols-[1fr_260px]">
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
                      <span>
                        {[order.city, order.area].filter(Boolean).join(" - ") || "لا يوجد عنوان"}
                      </span>
                    </div>
                    {delivery?.tracking_number && (
                      <p className="rounded-lg bg-[#f6fbff] p-2 text-xs font-semibold text-[#273347]">
                        رقم التتبع: {delivery.tracking_number}
                      </p>
                    )}
                    {payment?.payment_status !== "paid" && payment?.payment_url && (
                      <Link href={payment.payment_url} className="block rounded-lg bg-[#273347] px-3 py-2 text-center text-xs font-semibold text-white">
                        متابعة الدفع
                      </Link>
                    )}
                    {payment?.payment_status !== "paid" && !payment?.payment_url && (
                      <button
                        type="button"
                        disabled={payingOrderId === order.id}
                        onClick={() => void createPaymentForOrder(order.id, order.currency)}
                        className="block w-full rounded-lg bg-[#273347] px-3 py-2 text-center text-xs font-semibold text-white disabled:opacity-60"
                      >
                        {payingOrderId === order.id ? "جاري إنشاء الدفع..." : "إنشاء رابط دفع"}
                      </button>
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
