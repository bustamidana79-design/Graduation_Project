"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";

type CartProduct = {
  id: string;
  name: string;
  wholesale_price: number;
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
  const [shippingAddressId, setShippingAddressId] = useState("");

  const itemCount = useMemo(() => items.reduce((sum, item) => sum + Number(item.quantity || 0), 0), [items]);

  useEffect(() => {
    const load = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/cart", { headers });
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
  }, []);

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
      body: JSON.stringify({ productId: item.product_id, quantity }),
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
      body: JSON.stringify({ productId: item.product_id }),
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
    if (!shippingAddressId.trim()) {
      setMessage("أدخل رقم عنوان الشحن قبل المتابعة للدفع.");
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch("/api/orders/create", {
      method: "POST",
      headers,
      body: JSON.stringify({ shippingAddressId: shippingAddressId.trim() }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر إنشاء الطلب.");
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
              const price = Number(product.wholesale_price || 0);
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
                        <p className="text-sm text-[#546a85]">السعر: {price}</p>
                      </div>
                      <p className="font-bold text-[#273347]">المجموع: {lineTotal}</p>
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
              <span>{total}</span>
            </div>
            <input
              value={shippingAddressId}
              onChange={(event) => setShippingAddressId(event.target.value)}
              placeholder="shipping_address_id"
              className="w-full rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347]"
            />
            <button type="button" onClick={() => void checkout()} className="w-full rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white">
              Proceed to Checkout
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
