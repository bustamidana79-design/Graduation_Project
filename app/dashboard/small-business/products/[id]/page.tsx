"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Heart, Minus, Plus, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { getProfileRoute } from "@/lib/profile-routes";
import { DEFAULT_USD_RATES, convertCurrency, formatMoney, normalizeCurrency, type ExchangeRates } from "@/lib/currency";
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
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [currentImage, setCurrentImage] = useState(0);
  const [userCurrency, setUserCurrency] = useState("ILS");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_USD_RATES);

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

      const ratesResponse = await fetch("/api/currency/rates");
      if (ratesResponse.ok) {
        const ratesResult = await ratesResponse.json();
        setExchangeRates(ratesResult.rates || DEFAULT_USD_RATES);
      }

      const response = await fetch(`/api/products/${params.id}`);
      const result = await response.json();
      if (!response.ok) {
        setMessage(result.error || "تعذر تحميل المنتج.");
        return;
      }
      const loadedProduct = result.product as Product;
      setProduct(loadedProduct);
      setQuantity(Number(loadedProduct.min_order_quantity || 1));
    };

    void load();
  }, [params.id]);

  const setSafeQuantity = (next: number) => {
    if (!product) return;
    const minimum = Number(product.min_order_quantity || 1);
    const stock = Number(product.stock_quantity || minimum);
    setQuantity(Math.min(stock, Math.max(minimum, next)));
  };

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
        productId: product.id,
        quantity,
      }),
    });
    const result = await response.json();
    setMessage(response.ok ? "تمت إضافة المنتج إلى السلة." : result.error || "تعذر إضافة المنتج.");
  };

  const toggleFavorite = async () => {
    if (!product) return;
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

  if (!product) {
    return (
      <div className="p-6" dir="rtl">
        <p className="text-sm text-[#273347]/60">{message || "جاري تحميل تفاصيل المنتج..."}</p>
      </div>
    );
  }

  const minimum = Number(product.min_order_quantity || 1);
  const stock = Number(product.stock_quantity || 0);
  const images = product.images && product.images.length > 0 ? product.images : product.primary_image ? [product.primary_image] : [];
  const activeImage = images[currentImage] || images[0] || null;
  const sourceCurrency = normalizeCurrency(product.currency);
  const sourcePrice = Number(product.price ?? product.wholesale_price ?? 0);
  const convertedPrice = convertCurrency(sourcePrice, sourceCurrency, userCurrency, exchangeRates);
  const isConverted = sourceCurrency !== userCurrency;
  const prevImage = () => setCurrentImage((index) => (index - 1 + images.length) % images.length);
  const nextImage = () => setCurrentImage((index) => (index + 1) % images.length);

  return (
    <div className="space-y-6 p-6" dir="rtl">
      {message && <div className="rounded-xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="relative overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
          {activeImage && (
            <img
              src={getPublicImage(activeImage.image_url)}
              alt={product.name}
              className="h-[420px] w-full object-cover"
            />
          )}
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={prevImage}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-[#273347] shadow"
                aria-label="الصورة السابقة"
              >
                →
              </button>
              <button
                type="button"
                onClick={nextImage}
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-xl font-bold text-[#273347] shadow"
                aria-label="الصورة التالية"
              >
                ←
              </button>
            </>
          )}
        </div>

        <div className="space-y-4 rounded-xl border border-[#e6edf5] bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-[#273347]">{product.name}</h1>
              <p className="mt-2 text-sm text-[#546a85]">
                المورد:{" "}
                <Link
                  href={getProfileRoute(product.supplier_type || product.supplier?.account_type, product.supplier_id)}
                  className="font-semibold hover:text-[#273347] hover:underline"
                >
                  {product.supplier_name || product.supplier?.store_name || "متجر المورد"}
                </Link>
              </p>
            </div>
            <button
              type="button"
              title="إضافة للمفضلة"
              onClick={() => void toggleFavorite()}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6edf5] text-[#273347]"
            >
              <Heart size={18} />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
            <div className="rounded-xl bg-[#f8fafc] p-4">السعر: {isConverted ? "≈ " : ""}{formatMoney(convertedPrice, userCurrency)}</div>
            <div className="rounded-xl bg-[#f8fafc] p-4">المخزون: {product.stock_quantity}</div>
          </div>

          <div className="rounded-xl bg-[#f8fafc] p-4 text-sm text-[#273347]">الحد الأدنى للطلب: {minimum}</div>

          <div className="flex items-center justify-between rounded-xl border border-[#e6edf5] p-2">
            <button
              type="button"
              title="إنقاص الكمية"
              disabled={quantity <= minimum}
              onClick={() => setSafeQuantity(quantity - 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
            <input
              aria-label="الكمية"
              type="number"
              min={minimum}
              max={stock}
              value={quantity}
              onChange={(event) => setSafeQuantity(Number(event.target.value))}
              className="w-24 border-0 bg-transparent text-center text-base font-semibold text-[#273347] outline-none"
            />
            <button
              type="button"
              title="زيادة الكمية"
              disabled={quantity >= stock}
              onClick={() => setSafeQuantity(quantity + 1)}
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#f3f7fb] text-[#273347] disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>

          <div>
            <h2 className="mb-2 text-lg font-bold text-[#273347]">الوصف</h2>
            <p className="leading-7 text-[#273347]/80">{product.description || "لا يوجد وصف متاح."}</p>
          </div>

          <button
            type="button"
            onClick={() => void addToCart()}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white"
          >
            <ShoppingCart size={17} />
            إضافة إلى السلة
          </button>
        </div>
      </div>
    </div>
  );
}
