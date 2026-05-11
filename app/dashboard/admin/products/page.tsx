"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { formatMoney } from "@/lib/currency";
import type { Product } from "@/types/product";

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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const headers = await getAuthHeaders();
      const response = await fetch("/api/admin/products", { headers });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "تعذر تحميل المنتجات.");
        setProducts([]);
      } else {
        setProducts(result.products || []);
      }

      setLoading(false);
    };

    void load();
  }, []);

  const deleteProduct = async () => {
    if (!selected) return;
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/admin/products/${selected.id}`, {
      method: "DELETE",
      headers,
      body: JSON.stringify({ reason: deleteReason }),
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "فشل حذف المنتج.");
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== selected.id));
    setSelected(null);
    setDeleteReason("");
    setMessage("تم حذف المنتج وإنشاء إشعار وتذكرة دعم للمورد.");
  };

  return (
    <div className="space-y-6 p-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-[#273347]">منتجات المنصة</h1>
        <p className="mt-1 text-sm text-[#273347]/60">
          راقب جميع المنتجات، اعرض التفاصيل، واحذف أي منتج مخالف مع توثيق السبب.
        </p>
      </div>

      {message && (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">
          {message}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">
          جاري تحميل المنتجات...
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {products.map((product) => (
            <div key={product.id} className="overflow-hidden rounded-3xl border border-[#e6edf5] bg-white">
              <img
                src={getPublicImage(product.primary_image?.image_url)}
                alt={product.name}
                className="h-56 w-full object-cover"
              />
              <div className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#273347]">{product.name}</h2>
                    <p className="text-xs text-[#546a85]">{product.supplier_store_name}</p>
                  </div>
                  <span className="rounded-full bg-[#f3f7fb] px-3 py-1 text-xs font-semibold text-[#546a85]">
                    {product.is_published ? "منشور" : "غير منشور"}
                  </span>
                </div>

                <p className="line-clamp-3 text-sm text-[#273347]/70">
                  {product.description || "لا يوجد وصف متاح."}
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
                  <div className="rounded-2xl bg-[#f8fafc] p-3">السعر: {formatMoney(product.wholesale_price, product.currency)}</div>
                  <div className="rounded-2xl bg-[#f8fafc] p-3">المخزون: {product.stock_quantity}</div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSelected(product)}
                    className="flex-1 rounded-2xl border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]"
                  >
                    عرض التفاصيل
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(product);
                      setDeleteReason("");
                    }}
                    className="flex-1 rounded-2xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6" dir="rtl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-[#273347]">{selected.name}</h2>
                <p className="mt-1 text-sm text-[#546a85]">{selected.supplier_store_name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="text-2xl text-[#273347]/50">
                ×
              </button>
            </div>

            <img
              src={getPublicImage(selected.primary_image?.image_url)}
              alt={selected.name}
              className="mt-4 h-72 w-full rounded-3xl object-cover"
            />

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#273347]">السعر: {formatMoney(selected.wholesale_price, selected.currency)}</div>
              <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#273347]">المخزون: {selected.stock_quantity}</div>
              <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#273347]">الحد الأدنى: {selected.min_order_quantity}</div>
            </div>

            <div className="mt-4 rounded-2xl bg-[#f8fafc] p-4 text-sm leading-7 text-[#273347]/80">
              {selected.description || "لا يوجد وصف متاح."}
            </div>

            <div className="mt-5 space-y-3">
              <label className="block text-sm font-semibold text-[#273347]">سبب حذف المنتج</label>
              <textarea
                rows={4}
                value={deleteReason}
                onChange={(event) => setDeleteReason(event.target.value)}
                className="w-full rounded-2xl border border-[#d8e1ec] px-4 py-3"
                placeholder="اكتب سبب الحذف، وسيُرسل للمورد مع إشعار وتذكرة دعم."
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void deleteProduct()}
                  disabled={!deleteReason.trim()}
                  className="flex-1 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
                >
                  حذف المنتج
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="flex-1 rounded-2xl border border-[#d8e1ec] px-4 py-3 text-sm font-semibold text-[#273347]"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
