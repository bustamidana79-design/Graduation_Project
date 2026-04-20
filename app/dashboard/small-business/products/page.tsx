"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";
import { useRouter } from "next/navigation";

// ─── Types ─────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  supplier_id: string;
  price: number;
  min_order: number;
  created_at: string;
}

interface CartItem {
  product_id: string;
  quantity: number;
}

// ─── Component ─────────────────────────────

export default function SmallBusinessProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartId, setCartId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  // ─── INIT ───────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUser({ id: user.id });

      // ✅ get or create cart
      let { data: cart } = await supabase
        .from("carts")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!cart) {
        const { data: newCart } = await supabase
          .from("carts")
          .insert({ user_id: user.id })
          .select()
          .single();

        cart = newCart;
      }

      setCartId(cart.id);

      await Promise.all([
        fetchProducts(),
        fetchCart(cart.id)
      ]);

      setLoading(false);
    })();
  }, []);

  // ─── FETCH PRODUCTS ─────────────────────

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`
        id,
        name,
        description,
        supplier_id,
        wholesale_price,
        min_order_quantity,
        created_at
      `);

    if (error) return;

    const mapped = (data ?? []).map(p => ({
      id: p.id,
      name: p.name,
      description: p.description,
      supplier_id: p.supplier_id,
      price: p.wholesale_price,
      min_order: p.min_order_quantity,
      created_at: p.created_at,
    }));

    setProducts(mapped);
  };

  // ─── FETCH CART ─────────────────────────

  const fetchCart = async (cartId: string) => {
    const { data } = await supabase
      .from("cart_items")
      .select("product_id, quantity")
      .eq("cart_id", cartId);

    setCart(data ?? []);
  };

  // ─── ADD TO CART ───────────────────────

  const addToCart = async (product: Product) => {
    if (!cartId) return;

    const existing = cart.find(c => c.product_id === product.id);
    const qty = product.min_order || 1;

    if (existing) {
      const newQty = existing.quantity + qty;

      await supabase
        .from("cart_items")
        .update({ quantity: newQty })
        .eq("cart_id", cartId)
        .eq("product_id", product.id);

      setCart(prev =>
        prev.map(c =>
          c.product_id === product.id
            ? { ...c, quantity: newQty }
            : c
        )
      );
    } else {
      await supabase.from("cart_items").insert({
        cart_id: cartId,
        product_id: product.id,
        quantity: qty,
      });

      setCart(prev => [...prev, { product_id: product.id, quantity: qty }]);
    }
  };

  // ─── UPDATE QTY ─────────────────────────

  const updateQty = async (productId: string, delta: number) => {
    if (!cartId) return;

    const item = cart.find(c => c.product_id === productId);
    const product = products.find(p => p.id === productId);
    if (!item || !product) return;

    const min = product.min_order || 1;
    const newQty = item.quantity + delta;

    if (newQty < min) return;

    await supabase
      .from("cart_items")
      .update({ quantity: newQty })
      .eq("cart_id", cartId)
      .eq("product_id", productId);

    setCart(prev =>
      prev.map(c =>
        c.product_id === productId
          ? { ...c, quantity: newQty }
          : c
      )
    );
  };

  // ─── TOTAL ─────────────────────────────

  const total = cart.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.product_id);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);

  // ─── UI ────────────────────────────────

  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: 20 }} dir="rtl">

      <h1>🏪 المنتجات</h1>

      {/* Products */}
      <div style={{ display: "grid", gap: 16 }}>
        {products.map(p => {
          const qty = cart.find(c => c.product_id === p.id)?.quantity || 0;

          return (
            <div key={p.id} style={{ border: "1px solid #ddd", padding: 16 }}>
              <h3>{p.name}</h3>
              <p>{p.description}</p>

              <p>💰 {p.price}</p>
              <p>📦 الحد الأدنى: {p.min_order}</p>

              <button onClick={() => addToCart(p)}>
                {qty > 0 ? `🛒 في السلة (${qty})` : `اطلب (${p.min_order})`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Cart */}
      <div style={{ marginTop: 40 }}>
        <h2>🛒 السلة</h2>

        {cart.map(item => {
          const p = products.find(pr => pr.id === item.product_id);
          if (!p) return null;

          return (
            <div key={item.product_id}>
              {p.name} - {item.quantity}
              <button onClick={() => updateQty(item.product_id, -1)}>-</button>
              <button onClick={() => updateQty(item.product_id, 1)}>+</button>
            </div>
          );
        })}

        <h3>الإجمالي: {total}</h3>
      </div>

    </div>
  );
}