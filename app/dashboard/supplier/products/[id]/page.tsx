"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import ProductForm from "../components/ProductForm";
import type { Product } from "@/types/product";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

export default function EditProductPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
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

  const handleSubmit = async (values: {
    name: string;
    description: string;
    wholesale_price: number;
    currency?: string;
    min_order_quantity: number;
    stock_quantity: number;
    category_id?: string | null;
  }) => {
    const headers = await getAuthHeaders();
    const response = await fetch(`/api/products/${params.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(values),
    });

    const result = await response.json();
    if (!response.ok) {
      setMessage(result.error || "فشل حفظ التعديلات.");
      return;
    }

    router.push("/dashboard/supplier/products");
  };

  if (!product) {
    return (
      <div className="p-6" dir="rtl">
        <p className="text-sm text-[#273347]/60">{message || "جاري تحميل المنتج..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-[#273347]">تعديل المنتج</h1>
        <p className="mt-1 text-sm text-[#273347]/60">حدث بيانات المنتج ثم احفظ التغييرات.</p>
      </div>
      {message && <div className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{message}</div>}
      <ProductForm
        initialData={{
          name: product.name,
          description: product.description || "",
          wholesale_price: product.wholesale_price,
          currency: product.currency || "ILS",
          min_order_quantity: product.min_order_quantity,
          stock_quantity: product.stock_quantity,
          category_id: product.category_id || "",
        }}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
