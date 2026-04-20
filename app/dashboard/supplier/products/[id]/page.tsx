"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useParams, useRouter } from "next/navigation";
import ProductForm from "../components/ProductForm";

export default function EditProduct() {
  const { id } = useParams();
  const router = useRouter();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();

      setProduct(data);
    })();
  }, []);

  const handleSubmit = async (data: any) => {
    await supabase
      .from("products")
      .update(data)
      .eq("id", id);

    router.push("/supplier/products");
  };

  if (!product) return <p>Loading...</p>;

  return (
    <div>
      <h1>تعديل المنتج</h1>
      <ProductForm initialData={product} onSubmit={handleSubmit} />
    </div>
  );
}