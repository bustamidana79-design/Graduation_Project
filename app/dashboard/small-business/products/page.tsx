"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { getProfileRoute } from "@/lib/profile-routes";
import { convertCurrency, formatMoney, normalizeCurrency } from "@/lib/currency";
import type { Product } from "@/types/product";

async function getAuthToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

function getPublicImage(path?: string | null) {
  if (!path) return "/window.svg";
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

function clampQuantity(product: Product, value: number) {
  const minimum = Number(product.min_order_quantity || 1);
  const stock = Number(product.stock_quantity || minimum);
  return Math.min(stock, Math.max(minimum, value));
}

export default function SmallBusinessProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userCurrency, setUserCurrency] = useState("ILS");

  useEffect(() => {
    const load = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("preferred_currency")
          .eq("id", auth.user.id)
          .maybeSingle();
        setUserCurrency(normalizeCurrency(profile?.preferred_currency));
      }

      const response = await fetch("/api/products");
      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error || "فشل تحميل المنتجات.");
        setLoading(false);
        return;
      }

      const loadedProducts = (result.products || []) as Product[];
      setProducts(loadedProducts);
      setQuantities(
        Object.fromEntries(loadedProducts.map((product) => [product.id, Number(product.min_order_quantity || 1)]))
      );
      setLoading(false);
    };

    void load();
  }, []);

  const updateQuantity = (product: Product, next: number) => {
    setQuantities((prev) => ({ ...prev, [product.id]: clampQuantity(product, next) }));
  };

  const addToCart = async (product: Product) => {
    const token = await getAuthToken();
    const quantity = quantities[product.id] || Number(product.min_order_quantity || 1);
    const response = await fetch("/api/cart/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: product.id,
        quantity,
      }),
    });

    const result = await response.json();
    setMessage(response.ok ? `تمت إضافة "${product.name}" إلى السلة.` : result.error || "تعذر إضافة المنتج.");
  };

  const toggleFavorite = async (product: Product) => {
    const token = await getAuthToken();
    const response = await fetch("/api/favorites/toggle", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ productId: product.id }),
    });

    const result = await response.json();
    setMessage(response.ok ? "تم تحديث المفضلة." : result.error || "تعذر تحديث المفضلة.");
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">المنتجات</h1>
          <p className="mt-1 text-sm text-[#273347]/60">
            تصفح المنتجات، اختر الكمية المناسبة، ثم أضفها إلى السلة أو المفضلة.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/small-business/cart" className="rounded-xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            السلة
          </Link>
          <Link href="/dashboard/small-business/favorites" className="rounded-xl border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]">
            المفضلة
          </Link>
        </div>
      </div>

      {message && <div className="rounded-xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      {loading ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">
          جاري تحميل المنتجات...
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {products.map((product) => {
            const quantity = quantities[product.id] || Number(product.min_order_quantity || 1);
            const minimum = Number(product.min_order_quantity || 1);
            const stock = Number(product.stock_quantity || 0);
            const sourceCurrency = normalizeCurrency(product.currency);
            const sourcePrice = Number(product.price ?? product.wholesale_price ?? 0);
            const convertedPrice = convertCurrency(sourcePrice, sourceCurrency, userCurrency);
            const isConverted = sourceCurrency !== userCurrency;

            return (
              <div key={product.id} className="overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
                <img src={getPublicImage(product.primary_image?.image_url)} alt={product.name} className="h-56 w-full object-cover" />
                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-[#273347]">{product.name}</h2>
                      <Link
                        href={getProfileRoute(product.supplier_type, product.supplier_id)}
                        className="text-xs font-semibold text-[#546a85] hover:text-[#273347] hover:underline"
                      >
                        {product.supplier_name || product.supplier_store_name}
                      </Link>
                    </div>
                    <button
                      type="button"
                      title="إضافة للمفضلة"
                      onClick={() => void toggleFavorite(product)}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#e6edf5] text-[#273347]"
                    >
                      <Heart size={17} />
                    </button>
                  </div>

                  <p className="line-clamp-3 text-sm text-[#273347]/70">{product.description || "لا يوجد وصف متاح."}</p>

                  <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
                    <div className="rounded-xl bg-[#f8fafc] p-3">السعر: {isConverted ? "≈ " : ""}{formatMoney(convertedPrice, userCurrency)}</div>
                    <div className="rounded-xl bg-[#f8fafc] p-3">الحد الأدنى: {minimum}</div>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-[#e6edf5] p-2">
                    <button
                      type="button"
                      title="إنقاص الكمية"
                      disabled={quantity <= minimum}
                      onClick={() => updateQuantity(product, quantity - 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      aria-label="الكمية"
                      type="number"
                      min={minimum}
                      max={stock}
                      value={quantity}
                      onChange={(event) => updateQuantity(product, Number(event.target.value))}
                      className="w-20 border-0 bg-transparent text-center text-sm font-semibold text-[#273347] outline-none"
                    />
                    <button
                      type="button"
                      title="زيادة الكمية"
                      disabled={quantity >= stock}
                      onClick={() => updateQuantity(product, quantity + 1)}
                      className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <Link href={`/dashboard/small-business/products/${product.id}`} className="flex-1 rounded-xl border border-[#bbd0e4] px-4 py-2 text-center text-sm font-semibold text-[#273347]">
                      التفاصيل
                    </Link>
                    <button
                      type="button"
                      onClick={() => void addToCart(product)}
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
