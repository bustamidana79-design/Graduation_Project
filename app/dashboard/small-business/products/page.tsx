"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Minus, Plus, Search, ShoppingCart } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { getProfileRoute } from "@/lib/profile-routes";
import { DEFAULT_USD_RATES, convertCurrency, formatMoney, normalizeCurrency, type ExchangeRates } from "@/lib/currency";
import { categories, getCategoryLabel, getRecommendedCategoriesForUserType, normalizeCategory } from "@/lib/categories";
import { ProductRating } from "@/components/products/ProductRating";
import type { Product } from "@/types/product";

type ToastMessage = {
  id: number;
  text: string;
  tone: "success" | "info" | "error";
};

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

function productMatchesUserType(product: Product, userType: string) {
  const recommendedCategories = getRecommendedCategoriesForUserType(userType);
  return recommendedCategories.some(
    (recommendedCategory) => recommendedCategory === normalizeCategory(product.category || product.category_id)
  );
}

function getProductCategory(product: Product) {
  return normalizeCategory(product.category || product.category_id);
}

function sortRecommendedProducts(products: Product[], userType: string, recentlyViewed: Product[]) {
  const recommendedCategories = getRecommendedCategoriesForUserType(userType);
  const recentlyViewedCategories = new Set(
    recentlyViewed.map((product) => getProductCategory(product)).filter(Boolean)
  );

  const score = (product: Product) => {
    let value = 0;
    const productCategory = getProductCategory(product);

    if (recommendedCategories.includes(productCategory as (typeof recommendedCategories)[number])) value += 5;
    if (recentlyViewedCategories.has(productCategory)) value += 3;

    return value;
  };

  return [...products].sort((a, b) => score(b) - score(a));
}

export default function SmallBusinessProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [aiRecommendedProducts, setAiRecommendedProducts] = useState<Product[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [userCurrency, setUserCurrency] = useState("ILS");
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>(DEFAULT_USD_RATES);
  const [userType, setUserType] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [cartCount, setCartCount] = useState(0);
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = (text: string, tone: ToastMessage["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  };

  useEffect(() => {
    const loadRecentlyViewed = () => {
      try {
        const data = JSON.parse(localStorage.getItem("recentlyViewed") || "[]") as Product[];
        setRecentlyViewed(Array.isArray(data) ? data.slice(0, 10) : []);
      } catch {
        setRecentlyViewed([]);
      }
    };

    loadRecentlyViewed();
    window.addEventListener("focus", loadRecentlyViewed);
    window.addEventListener("storage", loadRecentlyViewed);

    return () => {
      window.removeEventListener("focus", loadRecentlyViewed);
      window.removeEventListener("storage", loadRecentlyViewed);
    };
  }, []);

  useEffect(() => {
    const loadProfileAndRates = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user?.id) {
        const [{ data: profile }, { data: businessProfile }] = await Promise.all([
          supabase
            .from("profiles")
            .select("preferred_currency")
            .eq("id", auth.user.id)
            .maybeSingle(),
          supabase
            .from("small_business_profiles")
            .select("project_field")
            .eq("user_id", auth.user.id)
            .maybeSingle(),
        ]);
        setUserCurrency(normalizeCurrency(profile?.preferred_currency));
        setUserType(String(businessProfile?.project_field || "").trim());
      }

      const ratesResponse = await fetch("/api/currency/rates");
      if (ratesResponse.ok) {
        const ratesResult = await ratesResponse.json();
        setExchangeRates(ratesResult.rates || DEFAULT_USD_RATES);
      }
      setProfileLoaded(true);
    };

    void loadProfileAndRates();
  }, []);

  useEffect(() => {
    const loadFavorites = async () => {
      const token = await getAuthToken();
      const response = await fetch("/api/favorites", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) return;

      const ids = ((result.favorites || []) as Array<{ product_id?: string }>)
        .map((favorite) => favorite.product_id)
        .filter((productId): productId is string => Boolean(productId));
      setFavoriteIds(new Set(ids));
    };

    void loadFavorites();
  }, []);

  useEffect(() => {
    const loadCartCount = async () => {
      const token = await getAuthToken();
      const response = await fetch("/api/cart", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) return;
      setCartCount(Array.isArray(result.items) ? result.items.length : 0);
    };

    void loadCartCount();
  }, []);

  useEffect(() => {
    if (!profileLoaded) return;

    const loadRecommendations = async () => {
      const token = await getAuthToken();
      if (!token) return;

      const response = await fetch("/api/products/recommendations?limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();

      if (!response.ok) {
        setAiRecommendedProducts([]);
        return;
      }

      const loadedProducts = (result.products || []) as Product[];
      setAiRecommendedProducts(loadedProducts);
      setQuantities((current) => ({
        ...Object.fromEntries(loadedProducts.map((product) => [product.id, Number(product.min_order_quantity || 1)])),
        ...current,
      }));
    };

    void loadRecommendations();
    window.addEventListener("focus", loadRecommendations);

    return () => {
      window.removeEventListener("focus", loadRecommendations);
    };
  }, [profileLoaded]);

  useEffect(() => {
    if (!profileLoaded) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (search.trim()) params.set("search", search.trim());
        if (category) params.set("category", category);
        if (minPrice) params.set("minPrice", minPrice);
        if (maxPrice) params.set("maxPrice", maxPrice);
        if (userType) params.set("userType", userType);
        const viewedCategories = Array.from(new Set(recentlyViewed.map((product) => getProductCategory(product)).filter(Boolean)));
        if (viewedCategories.length > 0) params.set("recentlyViewedCategories", viewedCategories.join(","));

        const response = await fetch(`/api/products?${params.toString()}`, { signal: controller.signal });
        const result = await response.json();

        if (!response.ok) {
          setMessage(result.error || "فشل تحميل المنتجات.");
          setProducts([]);
          return;
        }

        const loadedProducts = (result.products || []) as Product[];
        setProducts(loadedProducts);
        setQuantities((current) => ({
          ...Object.fromEntries(loadedProducts.map((product) => [product.id, Number(product.min_order_quantity || 1)])),
          ...current,
        }));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setMessage("فشل تحميل المنتجات.");
        setProducts([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [category, maxPrice, minPrice, profileLoaded, recentlyViewed, search, userType]);

  const localRecommendedProducts = useMemo(
    () => sortRecommendedProducts(products, userType, recentlyViewed)
      .filter((product) => {
        const sameCategoryAsRecent = recentlyViewed.some((viewed) => getProductCategory(viewed) === getProductCategory(product));
        return (productMatchesUserType(product, userType) || sameCategoryAsRecent) && !recentlyViewed.some((viewed) => viewed.id === product.id);
      })
      .slice(0, 10),
    [products, recentlyViewed, userType]
  );
  const recommendedProducts = aiRecommendedProducts.length > 0 ? aiRecommendedProducts : localRecommendedProducts;
  const recommendedProductIds = useMemo(
    () => new Set(recommendedProducts.map((product) => product.id)),
    [recommendedProducts]
  );
  const remainingProducts = useMemo(
    () => products.filter((product) => !recommendedProductIds.has(product.id)),
    [products, recommendedProductIds]
  );
  const topCategories = useMemo(() => {
    const recommendedCategories = getRecommendedCategoriesForUserType(userType);
    if (recommendedCategories.length > 0) {
      return recommendedCategories
        .map((value) => categories.find((categoryItem) => categoryItem.value === value))
        .filter((categoryItem): categoryItem is (typeof categories)[number] => Boolean(categoryItem))
        .slice(0, 5);
    }

    return categories.slice(0, 5);
  }, [userType]);

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
    if (!response.ok) {
      showToast(result.error || "تعذر إضافة المنتج للسلة.", "error");
      return;
    }

    setCartCount(Array.isArray(result.cart?.items) ? result.cart.items.length : (current) => current + 1);
    showToast(`تمت إضافة "${product.name}" للسلة 🛒`, "success");
  };

  const toggleFavorite = async (product: Product) => {
    const wasFavorite = favoriteIds.has(product.id);
    setAnimatingId(product.id);
    window.setTimeout(() => setAnimatingId(null), 300);
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (wasFavorite) {
        next.delete(product.id);
      } else {
        next.add(product.id);
      }
      return next;
    });

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
    if (!response.ok) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasFavorite) {
          next.add(product.id);
        } else {
          next.delete(product.id);
        }
        return next;
      });
      showToast(result.error || "تعذر تحديث المفضلة.", "error");
      return;
    }

    setFavoriteIds((current) => {
      const next = new Set(current);
      if (result.favorited) {
        next.add(product.id);
      } else {
        next.delete(product.id);
      }
      return next;
    });
    showToast(result.favorited ? "تمت الإضافة للمفضلة ❤️" : "تمت الإزالة من المفضلة 💔", result.favorited ? "success" : "info");
  };

  const renderProductCard = (product: Product, badge?: string) => {
    const quantity = quantities[product.id] || Number(product.min_order_quantity || 1);
    const minimum = Number(product.min_order_quantity || 1);
    const stock = Number(product.stock_quantity || 0);
    const sourceCurrency = normalizeCurrency(product.currency);
    const sourcePrice = Number(product.price ?? product.wholesale_price ?? 0);
    const convertedPrice = convertCurrency(sourcePrice, sourceCurrency, userCurrency, exchangeRates);
    const isConverted = sourceCurrency !== userCurrency;
    const categoryLabel = getCategoryLabel(product.category || product.category_id);
    const isFavorite = favoriteIds.has(product.id);

    return (
      <div key={product.id} className="overflow-hidden rounded-xl border border-[#e6edf5] bg-white">
        <div className="relative">
          <img src={getPublicImage(product.primary_image?.image_url)} alt={product.name} className="h-56 w-full bg-[#f8fafc] object-contain" />
          {badge && (
            <span className="absolute right-3 top-3 rounded-full bg-purple-500 px-3 py-1 text-xs font-bold text-white shadow">
              {badge}
            </span>
          )}
        </div>
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
              {categoryLabel && <p className="mt-1 text-xs text-[#273347]/45">{categoryLabel}</p>}
            </div>
            <button
              type="button"
              title={isFavorite ? "إزالة من المفضلة" : "إضافة للمفضلة"}
              onClick={() => void toggleFavorite(product)}
              className={`flex h-9 w-9 items-center justify-center rounded-full border border-[#e6edf5] transition-all duration-200 ${
                isFavorite ? "text-red-500" : "text-[#9aa8b8]"
              } ${animatingId === product.id ? "scale-125" : "scale-100"}`}
            >
              <Heart size={17} className={`transition-all duration-200 ${isFavorite ? "fill-red-500" : "fill-transparent"}`} />
            </button>
          </div>

          <p className="line-clamp-3 text-sm text-[#273347]/70">{product.description || "لا يوجد وصف متاح."}</p>
          <ProductRating value={product.rating_average} count={product.rating_count} />

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
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="fixed left-1/2 top-5 z-50 flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-xl border px-4 py-3 text-center text-sm font-semibold shadow-lg transition-all ${
              toast.tone === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : toast.tone === "info"
                  ? "border-[#bbd0e4] bg-white text-[#273347]"
                  : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {toast.text}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">المنتجات</h1>
          <p className="mt-1 text-sm text-[#273347]/60">
            تصفح المنتجات، ابحث وفلتر حسب السعر والفئة، ثم أضف المناسب إلى السلة أو المفضلة.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/small-business/cart" className="relative rounded-xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white">
            السلة
            {cartCount > 0 && (
              <span className="absolute -left-2 -top-2 min-w-5 rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-white">
                {cartCount}
              </span>
            )}
          </Link>
          <Link href="/dashboard/small-business/favorites" className="rounded-xl border border-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347]">
            المفضلة
          </Link>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl border border-[#e6edf5] bg-white p-4 md:grid-cols-[minmax(220px,1.5fr)_minmax(150px,1fr)_120px_120px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#546a85]" size={18} />
          <input
            type="text"
            placeholder="ابحث عن منتج..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 w-full rounded-lg border border-[#d8e1ec] pr-10 pl-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
          />
        </label>
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-11 rounded-lg border border-[#d8e1ec] px-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
        >
          <option value="">كل الفئات</option>
          {categories.map((categoryItem) => (
            <option key={categoryItem.value} value={categoryItem.value}>
              {categoryItem.label}
            </option>
          ))}
        </select>
        <input
          type="number"
          min="0"
          placeholder="من"
          value={minPrice}
          onChange={(event) => setMinPrice(event.target.value)}
          className="h-11 rounded-lg border border-[#d8e1ec] px-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
        />
        <input
          type="number"
          min="0"
          placeholder="إلى"
          value={maxPrice}
          onChange={(event) => setMaxPrice(event.target.value)}
          className="h-11 rounded-lg border border-[#d8e1ec] px-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
        />
      </div>

      {message && <div className="rounded-xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>}

      {topCategories.length > 0 && (
        <section className="space-y-3">
          <div>
            <p className="text-sm text-[#273347]/60">فئات مقترحة حسب نوع مشروعك.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {topCategories.map((categoryItem) => (
              <button
                key={categoryItem.value}
                type="button"
                onClick={() => setCategory((current) => (current === categoryItem.value ? "" : categoryItem.value))}
                className={`rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                  category === categoryItem.value
                    ? "border-[#273347] bg-[#273347] text-white"
                    : "border-[#bbd0e4] bg-white text-[#273347] hover:border-[#273347]"
                }`}
              >
                {categoryItem.label}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">
          جاري تحميل المنتجات...
        </div>
      ) : (
        <>
          {recentlyViewed.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-[#273347]">شو شفت قبل 👀</h2>
                <p className="text-sm text-[#273347]/60">آخر منتجات فتحتها عشان ترجع لها بسرعة.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                {recentlyViewed.map((product) => renderProductCard(product))}
              </div>
            </section>
          )}

          {recommendedProducts.length > 0 && (
            <section className="space-y-3">
              <div>
                <h2 className="text-lg font-bold text-[#273347]">مقترح إلك 🤖</h2>
                <p className="text-sm text-[#273347]/60">منتجات مقترحة بناءً على اهتماماتك وتفاعل المستخدمين المشابهين.</p>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-5">
                {recommendedProducts.map((product) => renderProductCard(product, "موصى به"))}
              </div>
            </section>
          )}

          {recentlyViewed.length === 0 && recommendedProducts.length === 0 && products.length > 0 && (
            <div className="rounded-xl border border-[#e6edf5] bg-white p-5 text-sm text-[#273347]/60">
              ابدأ تصفح المنتجات لنقترح لك 👀
            </div>
          )}

          {products.length === 0 ? (
            <div className="rounded-xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">
              لا توجد منتجات مطابقة للفلاتر الحالية.
            </div>
          ) : (recommendedProducts.length === 0 || remainingProducts.length > 0) ? (
            <section className="space-y-3">
              <h2 className="text-lg font-bold text-[#273347]">باقي المنتجات</h2>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {(recommendedProducts.length > 0 ? remainingProducts : products).map((product) => renderProductCard(product))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
