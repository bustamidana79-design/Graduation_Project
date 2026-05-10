"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { HeartOff, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import type { Product } from "@/types/product";

type FavoriteRow = {
  id: string;
  product_id: string;
  products?: (Product & { product_images?: Array<{ image_url: string; is_primary?: boolean }> }) | null;
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

function getPrimaryImage(product?: FavoriteRow["products"]) {
  const images = product?.product_images || [];
  return images.find((image) => image.is_primary) || images[0] || null;
}

export default function SmallBusinessFavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/favorites", { headers });
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "فشل تحميل المفضلة.");
        setFavorites([]);
      } else {
        setFavorites(result.favorites || []);
      }
      setLoading(false);
    };

    void load();
  }, []);

  const removeFavorite = async (row: FavoriteRow) => {
    const headers = await getAuthHeaders();
    const response = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers,
      body: JSON.stringify({ productId: row.product_id }),
    });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر إزالة المنتج من المفضلة.");
      return;
    }

    setFavorites((prev) => prev.filter((favorite) => favorite.id !== row.id));
    setMessage("تمت إزالة المنتج من المفضلة.");
  };

  const addToCart = async (row: FavoriteRow) => {
    const product = row.products;
    if (!product) return;

    const headers = await getAuthHeaders();
    const response = await fetch("/api/cart/add", {
      method: "POST",
      headers,
      body: JSON.stringify({
        productId: product.id,
        quantity: Number(product.min_order_quantity || 1),
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "تمت إضافة المنتج إلى السلة." : result.error || "تعذر إضافة المنتج إلى السلة.");
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">المفضلة</h1>
          <p className="mt-1 text-sm text-[#273347]/60">المنتجات التي حفظتها للرجوع إليها بسرعة.</p>
        </div>
        <Link href="/dashboard/small-business/products" className="rounded-xl border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]">
          تصفح المنتجات
        </Link>
      </div>

      {message && <div className="rounded-xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      {loading ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">جاري تحميل المفضلة...</div>
      ) : favorites.length === 0 ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-8 text-center">
          <p className="font-semibold text-[#273347]">لا توجد منتجات في المفضلة</p>
          <Link href="/dashboard/small-business/products" className="mt-4 inline-flex rounded-xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            ابدأ التصفح
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {favorites.map((row) => {
            const product = row.products;
            if (!product) return null;
            const image = getPrimaryImage(product);

            return (
              <div key={row.id} className="overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
                <img src={getPublicImage(image?.image_url)} alt={product.name} className="h-52 w-full object-cover" />
                <div className="space-y-3 p-5">
                  <div>
                    <h2 className="text-lg font-bold text-[#273347]">{product.name}</h2>
                    <p className="text-sm text-[#546a85]">السعر: {product.wholesale_price}</p>
                  </div>

                  <p className="line-clamp-3 text-sm text-[#273347]/70">{product.description || "لا يوجد وصف متاح."}</p>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => void removeFavorite(row)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-700"
                    >
                      <HeartOff size={16} />
                      إزالة
                    </button>
                    <button
                      type="button"
                      onClick={() => void addToCart(row)}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white"
                    >
                      <ShoppingCart size={16} />
                      أضف للسلة
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
