"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SupplierProductsPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);

  // form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [images, setImages] = useState<File[]>([]);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
      .from("products")
      .select(`*, product_images (image_url)`)
      .eq("supplier_id", user?.id);

    setProducts(data || []);
  };

  // 🔥 رفع الصور
  const uploadImages = async (productId: string) => {
    for (let img of images) {
      const fileName = `${Date.now()}-${img.name}`;

      const { error } = await supabase.storage
        .from("products")
        .upload(fileName, img);

      if (!error) {
        await supabase.from("product_images").insert({
          product_id: productId,
          image_url: fileName,
          is_primary: false
        });
      }
    }
  };

  // 🔥 إضافة منتج
  const addProduct = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("products")
      .insert({
        name,
        description,
        wholesale_price: Number(price),
        stock_quantity: Number(quantity),
        supplier_id: user?.id
      })
      .select()
      .single();

    if (!error && data) {
      await uploadImages(data.id);

      setShowForm(false);
      setName("");
      setDescription("");
      setPrice("");
      setQuantity("");
      setImages([]);

      fetchProducts();
    } else {
      console.log(error);
      alert("خطأ بالإضافة ❌");
    }
  };

  return (
    <div style={{ padding: 20 }}>

      {/* 🔥 الهيدر */}
      <div style={header}>
        <h1>منتجاتي</h1>

      <button onClick={() => setShowForm(!showForm)} style={addBtn}>
  إضافة منتج
  <span style={plusIcon}>＋</span>
</button>
      </div>

      {/* 🔥 الفورم */}
      {showForm && (
        <div style={formCard}>
          <h2>إضافة منتج</h2>

          <input
            placeholder="اسم المنتج"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={input}
          />

          <textarea
            placeholder="الوصف"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={input}
          />

          <input
            type="number"
            placeholder="السعر"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            style={input}
          />

          <input
            type="number"
            placeholder="الكمية"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            style={input}
          />

          {/* 🔥 رفع صور */}
          <input
            type="file"
            multiple
            onChange={(e) => setImages(Array.from(e.target.files || []))}
          />

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={addProduct} style={saveBtn}>
              💾 حفظ
            </button>

            <button onClick={() => setShowForm(false)} style={cancelBtn}>
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* 🔥 عرض المنتجات */}
      <div style={grid}>
        {products.map((p) => {
          const imageUrl = p.product_images?.[0]?.image_url
            ? supabase.storage
                .from("products")
                .getPublicUrl(p.product_images[0].image_url).data.publicUrl
            : "/no-image.png";

          return (
            <div key={p.id} style={card}>
              <img src={imageUrl} style={imgStyle} />

              <h3>{p.name}</h3>
              <p>{p.description}</p>
              <p>💰 {p.wholesale_price}</p>

              <button
                onClick={async () => {
                  await supabase.from("products").delete().eq("id", p.id);
                  fetchProducts();
                }}
                style={deleteBtn}
              >
                🗑️ حذف
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* 🎨 styles */

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};
const plusIcon = {
  color: "#6366f1",
  fontSize: 20,
  fontWeight: "bold",
};

const addBtn = {
  background: "#f3f4f6",
  color: "#111827",
  padding: "12px 18px",
  borderRadius: "14px",
  border: "1px solid #e5e7eb",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontWeight: "600",
  fontSize: "14px",
};

const formCard = {
  marginTop: 20,
  padding: 20,
  background: "#fff",
  borderRadius: 15,
  boxShadow: "0 5px 20px rgba(0,0,0,0.1)",
  display: "grid",
  gap: 10,
};

const input = {
  padding: 10,
  borderRadius: 8,
  border: "1px solid #ddd",
};

const saveBtn = {
  background: "#10b981",
  color: "#fff",
  padding: "10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const cancelBtn = {
  background: "#ef4444",
  color: "#fff",
  padding: "10px",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
};

const grid = {
  display: "grid",
  gap: 20,
  marginTop: 20,
};

const card = {
  border: "1px solid #eee",
  padding: 15,
  borderRadius: 12,
  boxShadow: "0 4px 10px rgba(0,0,0,0.05)",
};

const imgStyle: React.CSSProperties = {
  width: 120,
  height: 120,
  objectFit: "cover",
  borderRadius: 10,
};

const deleteBtn = {
  color: "red",
  marginTop: 10,
};