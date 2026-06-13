"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Minus, Plus, Trash2, Truck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { AREAS_BY_CITY, ARAB_COUNTRY_NAMES, getCitiesByCountryName } from "@/lib/locations";
import { Toast } from "@/components/Toast";

type CartProduct = {
  id: string;
  supplier_id?: string;
  name: string;
  wholesale_price: number;
  currency?: string;
  converted_wholesale_price?: number;
  min_order_quantity: number;
  stock_quantity: number;
  supplier_country?: string;
  supplier_shipping_company?: {
    id: string;
    user_id?: string;
    company_name: string;
    avg_delivery_time?: string;
    shipping_fee?: number;
  } | null;
  primary_image?: { image_url: string } | null;
};

type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  product?: CartProduct | null;
};

type CustomerType = "citizen" | "visitor";

function normalizeLocation(value?: string | null) {
  return String(value || "").trim().toLowerCase();
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

const PENDING_CHECKOUT_ORDER_IDS_KEY = "pending_checkout_order_ids";
const PENDING_CHECKOUT_PAYMENT_IDS_KEY = "pending_checkout_payment_ids";

export default function SmallBusinessCartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("");
  const [city, setCity] = useState("");
  const [area, setArea] = useState("");
  const [addressText, setAddressText] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [notes, setNotes] = useState("");
  const [customerType, setCustomerType] = useState<CustomerType>("citizen");
  const [nationalId, setNationalId] = useState("");
  const [passportNumber, setPassportNumber] = useState("");
  const [currency, setCurrency] = useState("ILS");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [shippingRateMap, setShippingRateMap] = useState<Record<string, number>>({});
  const [shippingRateErrors, setShippingRateErrors] = useState<Record<string, string>>({});
  const skipLocationResetCount = useRef(0);

  const selectedItems = useMemo(
    () => items.filter((item) => selectedProductIds.includes(item.product_id)),
    [items, selectedProductIds]
  );
  const itemCount = useMemo(() => selectedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [selectedItems]);
  const selectedSubtotal = useMemo(
    () =>
      selectedItems.reduce((sum, item) => {
        const product = item.product;
        const price = Number(product?.converted_wholesale_price ?? product?.wholesale_price ?? 0);
        return sum + price * Number(item.quantity || 0);
      }, 0),
    [selectedItems]
  );
  const countryOptions = useMemo(() => Object.values(ARAB_COUNTRY_NAMES), []);
  const cityOptions = useMemo(() => getCitiesByCountryName(country), [country]);
  const areaOptions = useMemo(() => AREAS_BY_CITY[city] || [], [city]);
  const supplierCountries = useMemo(
    () =>
      Array.from(
        new Set(selectedItems.map((item) => item.product?.supplier_country).filter((value): value is string => Boolean(value)))
      ),
    [selectedItems]
  );
  const isInternational = useMemo(
    () => supplierCountries.some((supplierCountry) => normalizeLocation(supplierCountry) !== normalizeLocation(country)),
    [supplierCountries, country]
  );
  const shippingAssignments = useMemo(() => {
    const bySupplier = new Map<string, NonNullable<CartProduct["supplier_shipping_company"]> | null>();
    for (const item of selectedItems) {
      const product = item.product;
      if (!product) continue;
      const supplierId = product.supplier_id || product.id;
      if (!bySupplier.has(supplierId)) {
        bySupplier.set(supplierId, product.supplier_shipping_company || null);
      }
    }
    return Array.from(bySupplier.entries()).map(([supplierId, company]) => ({ supplierId, company }));
  }, [selectedItems]);
  const missingSupplierShipping = shippingAssignments.some((assignment) => !assignment.company);
  const missingShippingRate = Boolean(city && area) && shippingAssignments.some((assignment) => assignment.company && shippingRateMap[assignment.supplierId] === undefined);
  const shippingFee = shippingAssignments.reduce((sum, assignment) => sum + Number(shippingRateMap[assignment.supplierId] || 0), 0);
  const payableTotal = selectedSubtotal + shippingFee;

  useEffect(() => {
    const loadProfileDefaults = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/profile", { headers });
      if (!response.ok) return;
      const result = await response.json();
      const data = result.profile || {};

      setPhone(data.phone || "");
      const nextCountry = countryOptions.includes(data.country || "") ? String(data.country) : "";
      skipLocationResetCount.current = 2;
      setCountry(nextCountry);
      const nextCity = getCitiesByCountryName(nextCountry).includes(data.city || "") ? String(data.city) : "";
      setCity(nextCity);
      setArea(String(data.area || data.village || "").trim());
      if (data.preferred_currency) setCurrency(normalizeCurrency(data.preferred_currency));
    };

    void loadProfileDefaults();
  }, [countryOptions]);

  useEffect(() => {
    const load = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/cart?currency=${currency}`, { headers });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "فشل تحميل السلة.");
        setItems([]);
        setSelectedProductIds([]);
      } else {
        const nextItems = (result.items || []) as CartItem[];
        setItems(nextItems);
        setSelectedProductIds(nextItems.map((item) => item.product_id));
      }
      setLoading(false);
    };

    void load();
  }, [currency]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (skipLocationResetCount.current > 0) {
        skipLocationResetCount.current -= 1;
        return;
      }
      setCity((current) => (getCitiesByCountryName(country).includes(current) ? current : ""));
      setArea("");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [country]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (skipLocationResetCount.current > 0) {
        skipLocationResetCount.current -= 1;
        return;
      }
      setArea((current) => (areaOptions.length === 0 || areaOptions.includes(current) ? current : ""));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [city, areaOptions]);

  useEffect(() => {
    const loadShippingRates = async () => {
      if (!city || !area || shippingAssignments.length === 0) {
        setShippingRateMap({});
        setShippingRateErrors({});
        return;
      }

      const headers = await getAuthHeaders();
      const nextRates: Record<string, number> = {};
      const nextErrors: Record<string, string> = {};

      await Promise.all(
        shippingAssignments.map(async (assignment) => {
          if (!assignment.company) return;
          const companyId = assignment.company.user_id || assignment.company.id;
          const params = new URLSearchParams({ shippingCompanyId: companyId, city, area });
          const response = await fetch(`/api/shipping/rates?${params.toString()}`, { headers });
          const result = await response.json();

          if (!response.ok) {
            nextErrors[assignment.supplierId] = result.error || "شركة الشحن لا تغطي هذه المنطقة";
            return;
          }

          nextRates[assignment.supplierId] = Number(result.rate?.price || 0);
        })
      );

      setShippingRateMap(nextRates);
      setShippingRateErrors(nextErrors);
    };

    void loadShippingRates();
  }, [city, area, shippingAssignments]);

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

    const nextItems = (result.cart.items || []) as CartItem[];
    setItems(nextItems);
    setSelectedProductIds((current) => current.filter((id) => nextItems.some((item) => item.product_id === id)));
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

    const nextItems = (result.cart.items || []) as CartItem[];
    setItems(nextItems);
    setSelectedProductIds((current) => current.filter((id) => id !== item.product_id));
    setMessage("تم حذف المنتج من السلة.");
  };

  const checkout = async () => {
    if (checkoutLoading) return;
    if (selectedProductIds.length === 0) return setMessage("حدد منتجًا واحدًا على الأقل قبل إنشاء الطلب.");
    if (!country) return setMessage("اختر الدولة قبل المتابعة للدفع.");
    if (!city) return setMessage("اختر مدينة الشحن قبل المتابعة للدفع.");
    if (!area) return setMessage("اختر القرية أو المنطقة قبل المتابعة للدفع.");
    if (!addressText.trim()) return setMessage("أدخل العنوان التفصيلي قبل المتابعة للدفع.");
    if (!phone.trim()) return setMessage("أدخل رقم الهاتف قبل المتابعة للدفع.");
    if (missingSupplierShipping) return setMessage("هذا المورد لا يملك شركة توصيل حالياً");
    if (Object.values(shippingRateErrors)[0]) return setMessage(Object.values(shippingRateErrors)[0]);
    if (missingShippingRate) return setMessage("جاري تحميل رسوم الشحن لهذه المنطقة.");
    if (isInternational && !postalCode.trim()) return setMessage("أدخل الرمز البريدي للطلبات الدولية.");
    if (isInternational && customerType === "citizen" && !nationalId.trim()) return setMessage("أدخل رقم الهوية للطلبات الدولية.");
    if (isInternational && customerType === "visitor" && !passportNumber.trim()) return setMessage("أدخل رقم جواز السفر للطلبات الدولية.");

    setCheckoutLoading(true);
    const headers = await getAuthHeaders();
    const createPaymentForOrders = async (orderIds: string[]) => {
      const paymentResponse = await fetch("/api/payment/create", {
        method: "POST",
        headers,
        body: JSON.stringify({
          orderIds,
          currency,
          returnUrl: `${window.location.origin}/payment/return`,
        }),
      });
      const paymentResult = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setMessage(paymentResult.error || "تعذر إنشاء الدفع. يمكنك الضغط على الدفع مرة أخرى لإعادة المحاولة.");
        setCheckoutLoading(false);
        return false;
      }

      const paymentIds = Array.isArray(paymentResult.payments)
        ? paymentResult.payments.map((payment: { id?: string }) => String(payment.id || "")).filter(Boolean)
        : paymentResult.primary_payment_id
          ? [String(paymentResult.primary_payment_id)]
          : [];
      window.localStorage.removeItem(PENDING_CHECKOUT_ORDER_IDS_KEY);
      if (paymentIds.length > 0) {
        window.localStorage.setItem(PENDING_CHECKOUT_PAYMENT_IDS_KEY, JSON.stringify(paymentIds));
      } else {
        window.localStorage.removeItem(PENDING_CHECKOUT_PAYMENT_IDS_KEY);
      }
      setItems([]);
      setSelectedProductIds([]);
      setMessage("تم إنشاء الدفع. إذا ظهر رصيد 0 KUDOS، افتح الدفع بنفس المتصفح وتأكد من تفعيل GNU Taler Wallet أو demo wallet.");
      console.log("[Payment] Redirecting to payment_url", paymentResult.payment_url);
      window.setTimeout(() => {
        window.location.assign(paymentResult.payment_url || "/dashboard/small-business/orders");
      }, 1800);
      return true;
    };

    const pendingOrderIds = JSON.parse(window.localStorage.getItem(PENDING_CHECKOUT_ORDER_IDS_KEY) || "[]") as string[];
    if (pendingOrderIds.length > 0) {
      await createPaymentForOrders(pendingOrderIds);
      return;
    }

    const response = await fetch("/api/orders/create", {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: phone.trim(),
        country,
        city,
        area,
        addressText: addressText.trim(),
        postalCode: postalCode.trim() || null,
        customerType,
        nationalId: nationalId.trim() || null,
        passportNumber: passportNumber.trim() || null,
        notes: notes.trim() || null,
        currency,
        productIds: selectedProductIds,
      }),
    });
    const result = await response.json();

    if (response.ok) {
      const orders = (result.orders || []) as Array<{ id: string }>;
      const orderIds = orders.map((order) => order.id);
      window.localStorage.setItem(PENDING_CHECKOUT_ORDER_IDS_KEY, JSON.stringify(orderIds));
      await createPaymentForOrders(orderIds);
      return;
    }

    setMessage(result.error || "تعذر إنشاء الطلب.");
    setCheckoutLoading(false);
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <Toast message={message} onClose={() => setMessage("")} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">السلة</h1>
          <p className="mt-1 text-sm text-[#273347]/60">راجع المنتجات والكميات قبل إنشاء الطلب.</p>
        </div>
        <Link href="/dashboard/small-business/products" className="rounded-lg border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]">
          متابعة التسوق
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل السلة...</div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-[#e6edf5] bg-white p-8 text-center">
          <p className="font-semibold text-[#273347]">السلة فارغة</p>
          <Link href="/dashboard/small-business/products" className="mt-4 inline-flex rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            تصفح المنتجات
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#e6edf5] bg-white p-4">
              <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#273347]">
                <input
                  type="checkbox"
                  checked={items.length > 0 && selectedProductIds.length === items.length}
                  onChange={(event) => setSelectedProductIds(event.target.checked ? items.map((item) => item.product_id) : [])}
                  className="h-4 w-4 accent-[#273347]"
                />
                تحديد كل المنتجات
              </label>
              <p className="text-sm font-semibold text-[#546a85]">
                المحدد: {selectedProductIds.length} من {items.length}
              </p>
            </div>
            {items.map((item) => {
              const product = item.product;
              if (!product) return null;
              const price = Number(product.converted_wholesale_price ?? product.wholesale_price ?? 0);
              const lineTotal = price * Number(item.quantity || 0);
              const minimum = Number(product.min_order_quantity || 1);
              const stock = Number(product.stock_quantity || minimum);

              return (
                <div key={item.id} className="grid gap-4 rounded-lg border border-[#e6edf5] bg-white p-4 md:grid-cols-[28px_112px_1fr]">
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(item.product_id)}
                    onChange={(event) =>
                      setSelectedProductIds((current) =>
                        event.target.checked
                          ? Array.from(new Set([...current, item.product_id]))
                          : current.filter((id) => id !== item.product_id)
                      )
                    }
                    className="mt-2 h-4 w-4 accent-[#273347]"
                    aria-label="تحديد المنتج للطلب"
                  />
                  <Link href={`/dashboard/small-business/products/${product.id}`}>
                    <img src={getPublicImage(product.primary_image?.image_url)} alt={product.name} className="h-28 w-full rounded-lg object-cover md:w-28" />
                  </Link>
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link href={`/dashboard/small-business/products/${product.id}`} className="font-bold text-[#273347] hover:underline">
                          {product.name}
                        </Link>
                        <p className="text-sm text-[#546a85]">السعر: {formatMoney(price, currency)}</p>
                        {product.supplier_country && <p className="text-xs text-[#273347]/45">بلد المورد: {product.supplier_country}</p>}
                      </div>
                      <p className="font-bold text-[#273347]">المجموع: {formatMoney(lineTotal, currency)}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2 rounded-lg border border-[#e6edf5] p-2">
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
                        className="flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
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

          <aside className="h-fit space-y-4 rounded-lg border border-[#e6edf5] bg-white p-5">
            <div className="flex items-center justify-between text-sm text-[#273347]">
              <span>عدد القطع</span>
              <span className="font-bold">{itemCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[#273347]">
              <span>إجمالي المنتجات المحددة</span>
              <span className="font-bold">{formatMoney(selectedSubtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between text-sm text-[#273347]">
              <span>الشحن</span>
              <span className="font-bold">{formatMoney(shippingFee, currency)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[#e6edf5] pt-3 text-lg font-bold text-[#273347]">
              <span>الإجمالي المتوقع</span>
              <span>{formatMoney(payableTotal, currency)}</span>
            </div>

            <label className="grid gap-2 text-sm font-semibold text-[#273347]">
              العملة
              <select
                value={currency}
                onChange={(event) => setCurrency(normalizeCurrency(event.target.value))}
                className="w-full rounded-lg border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
              >
                <option value="ILS">ILS</option>
                <option value="USD">USD</option>
                <option value="JOD">JOD</option>
              </select>
            </label>

            <div className="space-y-3 rounded-lg border border-[#e6edf5] bg-[#f8fafc] p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#273347]">
                <Truck size={16} />
                معلومات الشحن
              </div>

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                الدولة
                <select
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                >
                  <option value="">اختر الدولة</option>
                  {countryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <p className="rounded-lg border border-[#d7eadf] bg-[#f2fbf5] px-3 py-2 text-xs font-semibold text-[#25633f]">
                تم تعبئة الموقع تلقائياً من ملفك الشخصي
              </p>

              {isInternational && (
                <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  <AlertTriangle className="mt-0.5 shrink-0" size={16} />
                  <span>هذا الطلب دولي، قد يتم تطبيق رسوم جمركية.</span>
                </div>
              )}

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                المدينة
                <select
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                >
                  <option value="">اختر المدينة</option>
                  {cityOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                القرية / المنطقة
                {areaOptions.length > 0 ? (
                  <select
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    disabled={!city}
                    className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347] disabled:bg-[#eef3f8]"
                  >
                    <option value="">اختر المنطقة</option>
                    {areaOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={area}
                    onChange={(event) => setArea(event.target.value)}
                    disabled={!city}
                    placeholder="اكتب القرية أو المنطقة"
                    className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347] disabled:bg-[#eef3f8]"
                  />
                )}
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                العنوان التفصيلي
                <textarea
                  value={addressText}
                  onChange={(event) => setAddressText(event.target.value)}
                  rows={3}
                  placeholder="الشارع، رقم المنزل، الشقة، أي تفاصيل إضافية"
                  className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                />
              </label>

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                رقم الهاتف
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                />
              </label>

              {isInternational && (
                <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                    الرمز البريدي
                    <input
                      value={postalCode}
                      onChange={(event) => setPostalCode(event.target.value)}
                      placeholder="Postal Code"
                      className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                    />
                  </label>

                  <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                    نوع المستخدم
                    <select
                      value={customerType}
                      onChange={(event) => setCustomerType(event.target.value as CustomerType)}
                      className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                    >
                      <option value="citizen">مواطن</option>
                      <option value="visitor">زائر</option>
                    </select>
                  </label>

                  {customerType === "citizen" ? (
                    <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                      رقم الهوية
                      <input
                        value={nationalId}
                        onChange={(event) => setNationalId(event.target.value)}
                        placeholder="رقم الهوية"
                        className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                      />
                    </label>
                  ) : (
                    <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                      رقم جواز السفر
                      <input
                        value={passportNumber}
                        onChange={(event) => setPassportNumber(event.target.value)}
                        placeholder="رقم جواز السفر"
                        className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                      />
                    </label>
                  )}
                </div>
              )}

              <div className="space-y-2 rounded-lg bg-white p-3 text-xs text-[#273347]">
                <p className="font-bold">شركة التوصيل</p>
                {shippingAssignments.length === 0 ? (
                  <p className="text-[#273347]/60">ستظهر شركة الشحن بعد تحميل منتجات السلة.</p>
                ) : (
                  shippingAssignments.map((assignment) => (
                    <div key={assignment.supplierId} className="rounded-lg border border-[#e6edf5] p-3">
                      {assignment.company ? (
                        <>
                          <p className="font-bold">{assignment.company.company_name}</p>
                          <p className="mt-1">الوقت المتوقع: {assignment.company.avg_delivery_time || "غير محدد"}</p>
                          {shippingRateErrors[assignment.supplierId] ? (
                            <p className="mt-1 font-semibold text-red-700">{shippingRateErrors[assignment.supplierId]}</p>
                          ) : (
                            <p className="mt-1">
                              رسوم الشحن:{" "}
                              {shippingRateMap[assignment.supplierId] === undefined
                                ? "جاري التحميل..."
                                : formatMoney(Number(shippingRateMap[assignment.supplierId] || 0), currency)}
                            </p>
                          )}
                        </>
                      ) : (
                        <p className="font-semibold text-red-700">هذا المورد لا يملك شركة توصيل حالياً</p>
                      )}
                    </div>
                  ))
                )}
              </div>

              <label className="grid gap-2 text-sm font-semibold text-[#273347]">
                ملاحظات
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="ملاحظات اختيارية"
                  className="w-full rounded-lg border border-[#d8e1ec] bg-white px-4 py-3 text-sm text-[#273347]"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={checkoutLoading || missingSupplierShipping || missingShippingRate || Object.keys(shippingRateErrors).length > 0}
              onClick={() => void checkout()}
              className="w-full rounded-lg bg-[#273347] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {checkoutLoading ? "جاري المعالجة..." : "الدفع"}
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
