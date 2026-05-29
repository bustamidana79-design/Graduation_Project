"use client";

import { useState } from "react";
import { categories } from "@/lib/categories";

type ProductFormValues = {
  name: string;
  description: string;
  wholesale_price: number;
  currency?: string;
  min_order_quantity: number;
  stock_quantity: number;
  category_id?: string | null;
};

export default function ProductForm({
  initialData,
  onSubmit,
}: {
  initialData: ProductFormValues;
  onSubmit: (values: ProductFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<ProductFormValues>({
    name: initialData.name || "",
    description: initialData.description || "",
    wholesale_price: initialData.wholesale_price || 0,
    currency: initialData.currency || "ILS",
    min_order_quantity: initialData.min_order_quantity || 1,
    stock_quantity: initialData.stock_quantity || 0,
    category_id: initialData.category_id || "",
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSubmit(form);
    setSaving(false);
  };

  return (
    <div className="grid gap-4 rounded-3xl border border-[#e6edf5] bg-white p-6">
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#273347]">اسم المنتج</label>
        <input
          className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
          placeholder="اسم المنتج"
          value={form.name}
          onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#273347]">وصف المنتج</label>
        <textarea
          className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
          rows={4}
          placeholder="وصف المنتج"
          value={form.description}
          onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
        />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-semibold text-[#273347]">الفئة</label>
        <select
          className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
          value={form.category_id || ""}
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
      <div className="grid gap-4 md:grid-cols-4">
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#273347]">سعر الجملة</label>
          <input
            className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
            type="number"
            min="1"
            value={form.wholesale_price}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, wholesale_price: Number(event.target.value) }))
            }
          />
          <p className="text-xs text-[#546a85]">السعر المعتمد للبيع بالجملة.</p>
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
            <option value="EUR">EUR</option>
            <option value="SAR">SAR</option>
            <option value="AED">AED</option>
            <option value="EGP">EGP</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#273347]">الحد الأدنى للطلب</label>
          <input
            className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
            type="number"
            min="1"
            value={form.min_order_quantity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, min_order_quantity: Number(event.target.value) }))
            }
          />
          <p className="text-xs text-[#546a85]">أقل كمية يسمح بطلبها من المنتج.</p>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-semibold text-[#273347]">المخزون المتوفر</label>
          <input
            className="rounded-2xl border border-[#d8e1ec] px-4 py-3"
            type="number"
            min="0"
            value={form.stock_quantity}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, stock_quantity: Number(event.target.value) }))
            }
          />
          <p className="text-xs text-[#546a85]">عدد الوحدات الجاهزة للبيع.</p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saving}
        className="rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
      </button>
    </div>
  );
}
