"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

export default function SmallBusinessProductDetailsPage() {
  const params = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`/api/products/${params.id}`);
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "تعذر تحميل المنتج.");
        return;
      }
      setProduct(result.product);
    };

    void load();
  }, [params.id]);

  const addToCart = async () => {
    if (!product) return;
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
    setMessage(response.ok ? "تمت إضافة المنتج إلى السلة." : result.error || "تعذر إضافة المنتج.");
  };

  if (!product) {
    return (
      <div className="p-6" dir="rtl">
        <p className="text-sm text-[#273347]/60">{message || "جاري تحميل تفاصيل المنتج..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {message && <div className="rounded-2xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-4">
          {(product.images || []).map((image, index) => (
            <img
              key={`${image.image_url}-${index}`}
              src={getPublicImage(image.image_url)}
              alt={`${product.name}-${index + 1}`}
              className="h-72 w-full rounded-3xl object-cover"
            />
          ))}
        </div>

        <div className="space-y-4 rounded-3xl border border-[#e6edf5] bg-white p-6">
          <div>
            <h1 className="text-3xl font-bold text-[#273347]">{product.name}</h1>
            <p className="mt-2 text-sm text-[#546a85]">
              المورد: {product.supplier?.store_name || "متجر المورد"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
            <div className="rounded-2xl bg-[#f8fafc] p-4">السعر: {product.wholesale_price}</div>
            <div className="rounded-2xl bg-[#f8fafc] p-4">المخزون: {product.stock_quantity}</div>
          </div>

          <div className="rounded-2xl bg-[#f8fafc] p-4 text-sm text-[#273347]">
            الحد الأدنى للطلب: {product.min_order_quantity}
          </div>

          <div>
            <h2 className="mb-2 text-lg font-bold text-[#273347]">الوصف</h2>
            <p className="leading-7 text-[#273347]/80">{product.description || "لا يوجد وصف متاح."}</p>
          </div>

          <button
            type="button"
            onClick={() => void addToCart()}
            className="w-full rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white"
          >
            إضافة إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
}
