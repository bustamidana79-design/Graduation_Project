"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Product } from "@/types/product";

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    const loadProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, name, description, supplier_id, wholesale_price, min_order_quantity, created_at",
        )
        .order("created_at", { ascending: false });

      if (ignore) return;

      if (error) {
        console.error(error);
        setProducts([]);
      } else {
        setProducts(data ?? []);
      }

      setLoading(false);
    };

    void loadProducts();

    return () => {
      ignore = true;
    };
  }, []);

  const deleteProduct = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);

    if (error) {
      console.error(error);
      return;
    }

    setProducts((prev) => prev.filter((product) => product.id !== id));
  };

  return (
    <div className="space-y-4 p-8" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-[#273347]">كل المنتجات</h1>
        <p className="mt-1 text-sm text-[#273347]/60">
          عرض سريع لجميع المنتجات المضافة من الموردين.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/50">
          جاري تحميل المنتجات...
        </div>
      ) : (
        products.map((product) => (
          <div
            key={product.id}
            className="rounded-2xl border border-[#e6edf5] bg-white p-5"
          >
            <h2 className="text-lg font-bold text-[#273347]">{product.name}</h2>
            <p className="mt-2 text-sm text-[#273347]/70">
              {product.description || "لا يوجد وصف متاح."}
            </p>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-[#273347]">
              <p>سعر الجملة: {product.wholesale_price}</p>
              <p>الحد الأدنى: {product.min_order_quantity}</p>
              <p>المورد: {product.supplier_id}</p>
            </div>

            <button
              type="button"
              onClick={() => deleteProduct(product.id)}
              className="mt-4 rounded-2xl border border-red-200 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
            >
              حذف
            </button>
          </div>
        ))
      )}
    </div>
  );
}
