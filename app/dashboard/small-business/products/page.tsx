"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import type { Product } from "@/types/product";

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function getPublicImage(path?: string | null) {
  if (!path) return "/window.svg";
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function SmallBusinessProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch("/api/products");
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "فشل تحميل المنتجات.");
        setLoading(false);
        return;
      }

      setProducts(result.products || []);
      setLoading(false);
    };

    void load();
  }, []);

  const addToCart = async (product: Product) => {
    const token = await getAuthToken();
    const response = await fetch("/api/cart/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        product_id: product.id,
        quantity: product.min_order_quantity || 1,
      }),
    });

    const result = await response.json();
    setMessage(
      response.ok ? `تمت إضافة "${product.name}" إلى السلة.` : result.error || "تعذر إضافة المنتج."
    );
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-[#273347]">المنتجات</h1>
        <p className="mt-1 text-sm text-[#273347]/60">
          تصفح المنتجات الجاهزة للشراء وأضف ما يناسبك إلى السلة.
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
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                    متاح
                  </span>
                </div>

                <p className="line-clamp-3 text-sm text-[#273347]/70">
                  {product.description || "لا يوجد وصف متاح."}
                </p>

                <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
                  <div className="rounded-2xl bg-[#f8fafc] p-3">السعر: {product.wholesale_price}</div>
                  <div className="rounded-2xl bg-[#f8fafc] p-3">الحد الأدنى: {product.min_order_quantity}</div>
                </div>

                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/small-business/products/${product.id}`}
                    className="flex-1 rounded-2xl border border-[#bbd0e4] px-4 py-2 text-center text-sm font-semibold text-[#273347]"
                  >
                    التفاصيل
                  </Link>
                  <button
                    type="button"
                    onClick={() => void addToCart(product)}
                    className="flex-1 rounded-2xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white"
                  >
                    أضف للسلة
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
