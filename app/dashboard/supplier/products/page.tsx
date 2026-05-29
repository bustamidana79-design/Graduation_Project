"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";
import { formatMoney, normalizeCurrency } from "@/lib/currency";
import { categories, getCategoryLabel } from "@/lib/categories";
import type { Product } from "@/types/product";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token || ""}`,
  };
}

function getPublicImage(path?: string | null) {
  if (!path) return "/window.svg";
  return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
}

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    wholesale_price: "",
    currency: "ILS",
    min_order_quantity: "1",
    stock_quantity: "1",
    category_id: "",
  });

  useEffect(() => {
    const loadCurrency = async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user?.id) return;
      const { data } = await supabase
        .from("profiles")
        .select("preferred_currency")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (data?.preferred_currency) {
        setForm((prev) => ({ ...prev, currency: normalizeCurrency(data.preferred_currency) }));
      }
    };

    void loadCurrency();
  }, []);

  const fetchMyProducts = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;

    const { data, error } = await supabase
      .from("products")
      .select("*, product_images(id, image_url, is_primary)")
      .eq("supplier_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(error.message);
      setProducts([]);
    } else {
      const mapped = (data || []).map((product) => ({
        ...product,
        primary_image:
          product.product_images?.find((image: { is_primary: boolean }) => image.is_primary) ||
          product.product_images?.[0] ||
          null,
      }));
      setProducts(mapped);
    }

    setLoading(false);
  };

  useEffect(() => {
    void fetchMyProducts();
  }, []);

  const handleCreateProduct = async () => {
    if (images.length === 0) {
      setMessage("يجب رفع صورة واحدة على الأقل للمنتج.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const headers = await getAuthHeaders();
      const createResponse = await fetch("/api/products", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ...form,
          wholesale_price: Number(form.wholesale_price),
          min_order_quantity: Number(form.min_order_quantity),
          stock_quantity: Number(form.stock_quantity),
          category_id: form.category_id || null,
        }),
      });

      const createResult = await createResponse.json();
      if (!createResponse.ok) {
        throw new Error(createResult.error || "فشل إنشاء المنتج.");
      }

      const imageForm = new FormData();
      imageForm.append("productId", createResult.product.id);
      for (const image of images) {
        imageForm.append("images", image);
      }

      const { data } = await supabase.auth.getSession();
      const uploadResponse = await fetch("/api/products/images", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: imageForm,
      });

      const uploadResult = await uploadResponse.json();
      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error || "فشل رفع الصور.");
      }

      setForm({
        name: "",
        description: "",
        wholesale_price: "",
        currency: form.currency,
        min_order_quantity: "1",
        stock_quantity: "1",
        category_id: "",
      });
      setImages([]);
      setShowForm(false);
      setMessage("تم إنشاء المنتج ورفعه بنجاح.");
      await fetchMyProducts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع.");
    } finally {
      setSaving(false);
    }
  };

  const handleImagesChange = async (files: File[]) => {
    setImages(files);
    if (files.length === 0) return;

    try {
      const { data } = await supabase.auth.getSession();
      const suggestionForm = new FormData();
      suggestionForm.append("image", files[0]);
      const response = await fetch("/api/products/suggest", {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session?.access_token || ""}` },
        body: suggestionForm,
      });
      const result = await response.json();
      if (!response.ok) return;

      setForm((prev) => ({
        ...prev,
        name: prev.name.trim() ? prev.name : result.suggestion?.name || prev.name,
        description: prev.description.trim() ? prev.description : result.suggestion?.description || prev.description,
      }));
      setMessage("تم اقتراح اسم ووصف للمنتج، ويمكنك تعديلهما قبل الحفظ.");
    } catch {
      setMessage("تعذر توليد اقتراح AI من الصورة، يمكنك إدخال البيانات يدوياً.");
    }
  };

  const handleDelete = async (id: string) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/products/${id}`, {
      method: "DELETE",
      headers,
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "فشل حذف المنتج.");
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== id));
  };

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">منتجاتي</h1>
          <p className="mt-1 text-sm text-[#273347]/60">
            أضف منتجاتك وارفع صورها ثم عدلها أو احذفها وقت الحاجة.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((value) => !value)}
          className="rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white"
        >
          {showForm ? "إغلاق النموذج" : "إضافة منتج"}
        </button>
      </div>

      {message && (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">
          {message}
        </div>
      )}

      {showForm && (
        <div className="grid gap-4 rounded-3xl border border-[#e6edf5] bg-white p-6">
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-[#273347]">اسم المنتج</label>
            <input
              className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
              placeholder="مثال: عسل طبيعي جبلي"
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-[#273347]">وصف المنتج</label>
            <textarea
              className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
              placeholder="اكتب وصفًا واضحًا للمنتج، الحجم، المميزات، أو المواد."
              rows={4}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#273347]">سعر الجملة</label>
              <input
                className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
                type="number"
                min="1"
                placeholder="مثال: 25"
                value={form.wholesale_price}
                onChange={(event) => setForm((prev) => ({ ...prev, wholesale_price: event.target.value }))}
              />
              <p className="text-xs text-[#546a85]">السعر الذي سيدفعه المشتري لكل وحدة أو طلب جملة.</p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#273347]">العملة</label>
              <select
                className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
                value={form.currency}
                onChange={(event) => setForm((prev) => ({ ...prev, currency: event.target.value }))}
              >
                <option value="ILS">ILS</option>
                <option value="USD">USD</option>
                <option value="JOD">JOD</option>
              </select>
              <p className="text-xs text-[#546a85]">العملة الافتراضية من الحساب ويمكن تغييرها.</p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#273347]">الحد الأدنى للطلب</label>
              <input
                className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
                type="number"
                min="1"
                placeholder="مثال: 10"
                value={form.min_order_quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, min_order_quantity: event.target.value }))}
              />
              <p className="text-xs text-[#546a85]">أقل كمية يجب أن يطلبها التاجر عند الشراء.</p>
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-semibold text-[#273347]">المخزون المتوفر</label>
              <input
                className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
                type="number"
                min="1"
                placeholder="مثال: 120"
                value={form.stock_quantity}
                onChange={(event) => setForm((prev) => ({ ...prev, stock_quantity: event.target.value }))}
              />
              <p className="text-xs text-[#546a85]">عدد القطع أو الوحدات المتاحة حاليًا للبيع.</p>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-[#273347]">الفئة</label>
            <select
              className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
              value={form.category_id}
              onChange={(event) => setForm((prev) => ({ ...prev, category_id: event.target.value }))}
            >
              <option value="">اختر الفئة...</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-semibold text-[#273347]">صور المنتج</label>
            <input
              className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
              type="file"
              multiple
              accept="image/*"
              onChange={(event) => void handleImagesChange(Array.from(event.target.files || []))}
            />
            <p className="text-xs text-[#546a85]">
              يمكنك رفع أكثر من صورة للمنتج، وأول صورة يتم اختيارها ستكون الصورة الرئيسية.
            </p>
            {images.length > 0 && (
              <p className="text-xs font-semibold text-[#273347]">تم اختيار {images.length} صورة.</p>
            )}
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreateProduct()}
            className="rounded-2xl bg-[#bbd0e4] px-5 py-3 text-sm font-semibold text-[#273347] disabled:opacity-60"
          >
            {saving ? "جارٍ الحفظ..." : "حفظ المنتج"}
          </button>
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
                  <h2 className="text-lg font-bold text-[#273347]">{product.name}</h2>
                  <span className="rounded-full bg-[#f3f7fb] px-3 py-1 text-xs font-semibold text-[#546a85]">
                    {product.is_published ? "منشور" : "مخفي"}
                  </span>
                </div>
                {getCategoryLabel(product.category || product.category_id) && (
                  <p className="text-xs font-semibold text-[#546a85]">
                    {getCategoryLabel(product.category || product.category_id)}
                  </p>
                )}
                <p className="line-clamp-3 text-sm text-[#273347]/70">
                  {product.description || "لا يوجد وصف متاح."}
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm text-[#273347]">
                  <div className="rounded-2xl bg-[#f8fafc] p-3">السعر: {formatMoney(product.wholesale_price, product.currency)}</div>
                  <div className="rounded-2xl bg-[#f8fafc] p-3">المخزون: {product.stock_quantity}</div>
                </div>
                <div className="flex gap-3">
                  <Link
                    href={`/dashboard/supplier/products/${product.id}`}
                    className="flex-1 rounded-2xl border border-[#bbd0e4] px-4 py-2 text-center text-sm font-semibold text-[#273347]"
                  >
                    تعديل
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete(product.id)}
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
    </div>
  );
}
