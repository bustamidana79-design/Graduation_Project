"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { formatMoney, normalizeCurrency } from "@/lib/currency";

type CartProduct = {
  id: string;
  name: string;
  wholesale_price: number;
  currency?: string;
  converted_wholesale_price?: number;
  min_order_quantity: number;
  stock_quantity: number;
  primary_image?: { image_url: string } | null;
};

type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  product?: CartProduct | null;
};

type ShippingCompany = {
  id: string;
  user_id?: string;
  company_name: string;
  delivery_cities?: string[];
  avg_delivery_time?: string;
  shipping_fee?: number;
};

const palestinianCities = ["Nablus", "Ramallah", "Hebron", "Jerusalem", "Bethlehem", "Jenin", "Tulkarm", "Qalqilya", "Jericho", "Gaza"];

function getShippingCompanyKey(company: ShippingCompany) {
  return company.user_id || company.id;
}

function getCityOptionsForCompany(company?: ShippingCompany) {
  const companyCities = company?.delivery_cities?.filter(Boolean) || [];
  return companyCities.length > 0 ? companyCities : palestinianCities;
}

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

function getPublicImage(path?: string | null) {
  if (!path) return "/window.svg";
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function SmallBusinessCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [shippingCompanies, setShippingCompanies] = useState<ShippingCompany[]>([]);
  const [shippingCompanyId, setShippingCompanyId] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items]);
  const selectedShippingCompany = useMemo(
    () => shippingCompanies.find((company) => getShippingCompanyKey(company) === shippingCompanyId),
    [shippingCompanies, shippingCompanyId]
  );
  const cityOptions = useMemo(() => getCityOptionsForCompany(selectedShippingCompany), [selectedShippingCompany]);

  useEffect(() => {
    const loadProfileDefaults = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("phone, country, city, preferred_currency")
        .eq("id", auth.user.id)
        .maybeSingle();

      setPhone(data?.phone || "");
      setCity(data?.city || "");
      if (data?.preferred_currency) setCurrency(normalizeCurrency(data.preferred_currency));
    };

    void loadProfileDefaults();
  }, []);

  useEffect(() => {
    const loadShippingCompanies = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/shipping/companies", { headers });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "Failed to load shipping companies.");
        return;
      }

      const companies = (Array.isArray(result) ? result : result.companies || []) as ShippingCompany[];
      setShippingCompanies(companies);
      setShippingCompanyId((current) => current || (companies[0] ? getShippingCompanyKey(companies[0]) : ""));
    };

    void loadShippingCompanies();
  }, []);

  useEffect(() => {
    const load = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/cart?currency=${currency}`, { headers });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "فشل تحميل السلة.");
        setItems([]);
        setTotal(0);
      } else {
        setItems(result.items || []);
        setTotal(Number(result.total_amount || result.subtotal || 0));
      }
      setLoading(false);
    };

    void load();
  }, [currency]);

  const updateQuantity = async (item: CartItem, nextQuantity: number) => {
    const product = item.product;
    if (!product) return;

    const minimum = Number(product.min_order_quantity || 1);
    const stock = Number(product.stock_quantity || minimum);
    const quantity = Math.min(stock, Math.max(minimum, nextQuantity));
    const headers = await getAuthHeaders();
    const response = await fetch("/api/cart", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ productId: item.product_id, quantity, currency }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحديث الكمية.");
      return;
    }

    setItems(result.cart.items || []);
    setTotal(Number(result.cart.total_amount || result.cart.subtotal || 0));
    setMessage("تم تحديث السلة.");
  };

  const removeItem = async (item: CartItem) => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/cart/remove", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ productId: item.product_id, currency }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر حذف المنتج من السلة.");
      return;
    }

    setItems(result.cart.items || []);
    setTotal(Number(result.cart.total_amount || result.cart.subtotal || 0));
    setMessage("تم حذف المنتج من السلة.");
  };

  const checkout = async () => {
    if (checkoutLoading) return;
    if (!shippingCompanyId) {
      setMessage("Select a shipping company before payment.");
      return;
    }
    if (!city.trim()) {
      setMessage("اختر مدينة الشحن قبل المتابعة للدفع.");
      return;
    }
    if (!phone.trim()) {
      setMessage("أدخل رقم الهاتف قبل المتابعة للدفع.");
      return;
    }
    if (!area.trim()) {
      setMessage("أدخل المنطقة قبل المتابعة للدفع.");
      return;
    }

    setCheckoutLoading(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/orders/create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: phone.trim(),
        city: city.trim(),
        area: area.trim(),
        notes: notes.trim() || null,
        currency,
      }),
    });
    const result = await response.json();

    if (response.ok) {
      const orders = (result.orders || []) as Array<{ id: string }>;
      for (const order of orders) {
        const shippingResponse = await fetch("/api/shipping/select", {
          method: "POST",
          headers,
          body: JSON.stringify({ orderId: order.id, shippingCompanyId }),
        });
        const shippingResult = await shippingResponse.json();

        if (!shippingResponse.ok) {
          setMessage(shippingResult.error || "Failed to select shipping company.");
          setCheckoutLoading(false);
          return;
        }
      }

      const paymentResponse = await fetch("/api/payment/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderIds: orders.map((order) => order.id),
          currency,
          returnUrl: `${window.location.origin}/dashboard/small-business/orders`,
        }),
      });
      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setMessage(paymentResult.error || "Failed to create payment.");
        setCheckoutLoading(false);
        return;
      }

      setItems([]);
      setTotal(0);
      setMessage("Payment created. Redirecting...");
      window.location.href = paymentResult.payment_url || "/dashboard/small-business/orders";
      return;
    }

    if (!response.ok) {
      setMessage(result.error || "تعذر إنشاء الطلب.");
      setCheckoutLoading(false);
      return;
    }

    setItems([]);
    setTotal(0);
    setMessage(`تم إنشاء ${result.orders?.length || 1} طلب بنجاح.`);
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">السلة</h1>
          <p className="mt-1 text-sm text-[#273347]/60">راجع المنتجات والكميات قبل إنشاء الطلب.</p>
        </div>
        <Link href="/dashboard/small-business/products" className="rounded-xl border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]">
          متابعة التسوق
        </Link>
      </div>

      {message && <div className="rounded-xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      {loading ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل السلة...</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-8 text-center">
          <p className="font-semibold text-[#273347]">السلة فارغة</p>
          <Link href="/dashboard/small-business/products" className="mt-4 inline-flex rounded-xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((item) => {
              const product = item.product;
              if (!product) return null;
              const price = Number(product.converted_wholesale_price ?? product.wholesale_price ?? 0);
              const lineTotal = price * Number(item.quantity || 0);
              const minimum = Number(product.min_order_quantity || 1);
              const stock = Number(product.stock_quantity || minimum);

              return (
                <div key={item.id} className="grid gap-4 rounded-xl border border-[#e6edf5] bg-white p-4 md:grid-cols-[112px_1fr]">
                  <img src={getPublicImage(product.primary_image?.image_url)} alt={product.name} className="h-28 w-full rounded-lg object-cover md:w-28" />
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="font-bold text-[#273347]">{product.name}</h2>
                        <p className="text-sm text-[#546a85]">السعر: {formatMoney(price, currency)}</p>
                      </div>
                      <p className="font-bold text-[#273347]">المجموع: {formatMoney(lineTotal, currency)}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 rounded-xl border border-[#e6edf5] p-2">
                        <button
                          type="button"
                          title="إنقاص الكمية"
                          disabled={item.quantity <= minimum}
                          onClick={() => void updateQuantity(item, item.quantity - 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="w-12 text-center text-sm font-semibold text-[#273347]">{item.quantity}</span>
                        <button
                          type="button"
                          title="زيادة الكمية"
                          disabled={item.quantity >= stock}
                          onClick={() => void updateQuantity(item, item.quantity + 1)}
                          className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
                        >
                          <Plus size={16} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeItem(item)}
                        className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                      >
                        <Trash2 size={16} />
                        حذف
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <aside className="h-fit space-y-4 rounded-xl border border-[#e6edf5] bg-white p-5">
            <div className="flex items-center justify-between text-sm text-[#273347]">
              <span>عدد القطع</span>
              <span className="font-bold">{itemCount}</span>
            </div>
            <div className="flex items-center justify-between text-lg font-bold text-[#273347]">
              <span>الإجمالي</span>
              <span>{formatMoney(total, currency)}</span>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              العملة
              <select
                value={currency}
                onChange={(event) => setCurrency(normalizeCurrency(event.target.value))}
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              >
                <option value="ILS">ILS</option>
                <option value="USD">USD</option>
                <option value="JOD">JOD</option>
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              Shipping company
              <select
                value={shippingCompanyId}
                onChange={(event) => {
                  const nextCompanyId = event.target.value;
                  setShippingCompanyId(nextCompanyId);
                }}
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              >
                {shippingCompanies.length === 0 ? (
                  <option value="">No shipping companies available</option>
                ) : (
                  shippingCompanies.map((company) => (
                    <option key={getShippingCompanyKey(company)} value={getShippingCompanyKey(company)}>
                      {company.company_name} - {company.avg_delivery_time || "Delivery time not set"}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              Phone
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone number"
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              City
              <input
                value={city}
                list="shipping-city-options"
                onChange={(event) => setCity(event.target.value)}
                placeholder="City"
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              />
              <datalist id="shipping-city-options">
                {cityOptions.map((cityOption) => (
                  <option key={cityOption} value={cityOption}>
                    {cityOption}
                  </option>
                ))}
              </datalist>
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              Area
              <input
                value={area}
                onChange={(event) => setArea(event.target.value)}
                placeholder="Area"
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              Notes
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              />
            </label>
            <button
              type="button"
              disabled={checkoutLoading}
              onClick={() => void checkout()}
              className="w-full rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {checkoutLoading ? "Processing..." : "Pay"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
