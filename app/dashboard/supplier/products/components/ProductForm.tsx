"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ProductForm({ initialData, onSubmit }: any) {
  const [categories, setCategories] = useState<any[]>([]);
  const [image, setImage] = useState<File | null>(null);

  const [form, setForm] = useState({
    name: initialData?.name || "",
    description: initialData?.description || "",
    wholesale_price: initialData?.wholesale_price || 0,
    min_order_quantity: initialData?.min_order_quantity || 1,
    stock_quantity: initialData?.stock_quantity || 0,
    category_id: initialData?.category_id || "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("categories").select("*");
      setCategories(data || []);
    })();
  }, []);

  const handleSubmit = async () => {
    let imageUrl = null;

    // رفع الصورة
    if (image) {
      const fileName = `${Date.now()}-${image.name}`;

      const { data, error } = await supabase.storage
        .from("products")
        .upload(fileName, image);

      if (!error) {
        imageUrl = data.path;
      }
    }

    await onSubmit({ ...form, imageUrl });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>

      <input
        placeholder="اسم المنتج"
        value={form.name}
        onChange={e => setForm({ ...form, name: e.target.value })}
      />

      <textarea
        placeholder="الوصف"
        value={form.description}
        onChange={e => setForm({ ...form, description: e.target.value })}
      />

      <input
        type="number"
        placeholder="السعر"
        value={form.wholesale_price}
        onChange={e => setForm({ ...form, wholesale_price: +e.target.value })}
      />

      <input
        type="number"
        placeholder="الحد الأدنى"
        value={form.min_order_quantity}
        onChange={e => setForm({ ...form, min_order_quantity: +e.target.value })}
      />

      <input
        type="number"
        placeholder="المخزون"
        value={form.stock_quantity}
        onChange={e => setForm({ ...form, stock_quantity: +e.target.value })}
      />

      {/* categories */}
      <select
        value={form.category_id}
        onChange={e => setForm({ ...form, category_id: e.target.value })}
      >
        <option value="">اختر فئة</option>
        {categories.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>

      {/* image */}
      <input
        type="file"
        onChange={e => setImage(e.target.files?.[0] || null)}
      />

      <button onClick={handleSubmit}>
        💾 حفظ المنتج
      </button>

    </div>
  );
}