"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase"; // ✅ نفس مسارك الأصلي
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  min_order: number;
  icon: string;
  supplier_id: string;
  created_at: string;
  supplier?: {
    id: string;
    full_name: string;
    business_name: string;
  };
}

interface CartItem {
  product_id: string;
  quantity: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  { value: "", label: "كل الفئات", emoji: "🌐" },
  { value: "electronics", label: "إلكترونيات", emoji: "📱" },
  { value: "food", label: "مواد غذائية", emoji: "🍎" },
  { value: "clothing", label: "ملابس", emoji: "👕" },
  { value: "beauty", label: "تجميل", emoji: "💄" },
  { value: "home", label: "منزلية", emoji: "🏠" },
];

const PRICE_RANGES = [
  { value: "", label: "كل الأسعار" },
  { value: "low", label: "أقل من 100" },
  { value: "medium", label: "100 – 500" },
  { value: "high", label: "أكثر من 500" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StartupProductsPage() {
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<{ id: string } | null>(null);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priceRange, setPriceRange] = useState("");
  const [showFavOnly, setShowFavOnly] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // ─── Init ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      setCurrentUser({ id: user.id });
      await Promise.all([fetchProducts(), fetchFavorites(user.id), fetchCart(user.id)]);
      setLoading(false);
    })();
  }, []);

  // ─── Fetch ─────────────────────────────────────────────────────────────────

  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from("products")
      .select(`*, supplier:users!products_supplier_id_fkey (id, full_name, business_name)`)
      .order("created_at", { ascending: false });
    if (error) { showToast("خطأ في تحميل المنتجات", "error"); return; }
    setProducts(data ?? []);
    setFiltered(data ?? []);
  };

  const fetchFavorites = async (userId: string) => {
    const { data } = await supabase.from("favorites").select("product_id").eq("user_id", userId);
    setFavorites(new Set((data ?? []).map((f: { product_id: string }) => f.product_id)));
  };

  const fetchCart = async (userId: string) => {
    const { data } = await supabase.from("cart_items").select("product_id, quantity").eq("user_id", userId);
    setCart(data ?? []);
  };

  // ─── Filter Logic ──────────────────────────────────────────────────────────

  useEffect(() => {
    let result = [...products];
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.supplier?.business_name?.toLowerCase().includes(q)
      );
    }
    if (category) result = result.filter(p => p.category === category);
    if (priceRange === "low") result = result.filter(p => p.price < 100);
    else if (priceRange === "medium") result = result.filter(p => p.price >= 100 && p.price <= 500);
    else if (priceRange === "high") result = result.filter(p => p.price > 500);
    if (showFavOnly) result = result.filter(p => favorites.has(p.id));
    setFiltered(result);
  }, [search, category, priceRange, showFavOnly, products, favorites]);

  // ─── Favorites ─────────────────────────────────────────────────────────────

  const toggleFavorite = async (productId: string) => {
    if (!currentUser) return;
    const isFav = favorites.has(productId);
    if (isFav) {
      await supabase.from("favorites").delete().eq("user_id", currentUser.id).eq("product_id", productId);
      setFavorites(prev => { const n = new Set(prev); n.delete(productId); return n; });
      showToast("تمت الإزالة من المفضلة", "success");
    } else {
      await supabase.from("favorites").insert({ user_id: currentUser.id, product_id: productId });
      setFavorites(prev => new Set([...prev, productId]));
      showToast("تمت الإضافة للمفضلة ❤️", "success");
    }
  };

  // ─── Cart ──────────────────────────────────────────────────────────────────

  const addToCart = async (product: Product) => {
    if (!currentUser) return;
    const existing = cart.find(c => c.product_id === product.id);
    if (existing) {
      const newQty = existing.quantity + 1;
      await supabase.from("cart_items").update({ quantity: newQty }).eq("user_id", currentUser.id).eq("product_id", product.id);
      setCart(prev => prev.map(c => c.product_id === product.id ? { ...c, quantity: newQty } : c));
    } else {
      const initialQty = Math.max(1, product.min_order);
      await supabase.from("cart_items").insert({ user_id: currentUser.id, product_id: product.id, quantity: initialQty });
      setCart(prev => [...prev, { product_id: product.id, quantity: initialQty }]);
    }
    showToast("تمت الإضافة للسلة 🛒", "success");
  };

  const updateCartQty = async (productId: string, delta: number) => {
    if (!currentUser) return;
    const item = cart.find(c => c.product_id === productId);
    if (!item) return;
    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      await supabase.from("cart_items").delete().eq("user_id", currentUser.id).eq("product_id", productId);
      setCart(prev => prev.filter(c => c.product_id !== productId));
    } else {
      await supabase.from("cart_items").update({ quantity: newQty }).eq("user_id", currentUser.id).eq("product_id", productId);
      setCart(prev => prev.map(c => c.product_id === productId ? { ...c, quantity: newQty } : c));
    }
  };

  const cartTotal = cart.reduce((sum, item) => {
    const p = products.find(pr => pr.id === item.product_id);
    return sum + (p ? p.price * item.quantity : 0);
  }, 0);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const contactSupplier = (supplierId: string) => router.push(`/chat?with=${supplierId}`);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={s.loadingWrap}>
        <div className="sp" />
        <p style={s.loadingText}>جاري تحميل المنتجات...</p>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} .sp{width:48px;height:48px;border:4px solid #bbd0e4;border-top-color:#273347;border-radius:50%;animation:spin .8s linear infinite}`}</style>
      </div>
    );
  }

  return (
    <div style={s.page} dir="rtl">
      <style>{`@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}} .pc{animation:slideUp .35s ease both}`}</style>

      {toast && (
        <div style={{ ...s.toast, background: toast.type === "success" ? "#22c55e" : "#ef4444" }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>🏪 المنتجات</h1>
          <p style={s.subtitle}>{filtered.length} منتج متاح</p>
        </div>
        <button style={s.cartBtn} onClick={() => setCartOpen(true)}>
          🛒 السلة
          {cartCount > 0 && <span style={s.cartBadge}>{cartCount}</span>}
        </button>
      </div>

      {/* Filters */}
      <div style={s.filtersCard}>
        <div style={s.searchWrap}>
          <span>🔍</span>
          <input style={s.searchInput} placeholder="ابحث عن منتج أو مورد..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button style={s.clearBtn} onClick={() => setSearch("")}>✕</button>}
        </div>
        <div style={s.filterRow}>
          <div style={s.catWrap}>
            {CATEGORIES.map(cat => (
              <button key={cat.value} style={{ ...s.catBtn, ...(category === cat.value ? s.catBtnActive : {}) }} onClick={() => setCategory(cat.value)}>
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>
          <div style={s.rightFilters}>
            <select style={s.select} value={priceRange} onChange={e => setPriceRange(e.target.value)}>
              {PRICE_RANGES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <button style={{ ...s.favToggle, ...(showFavOnly ? s.favToggleActive : {}) }} onClick={() => setShowFavOnly(v => !v)}>
              {showFavOnly ? "❤️" : "🤍"} المفضلة
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div style={s.emptyState}>
          <p style={{ fontSize: 64, margin: 0 }}>📦</p>
          <p style={{ fontSize: 18, margin: "8px 0 20px", color: "#546a85" }}>لا توجد منتجات تطابق البحث</p>
          <button style={s.resetBtn} onClick={() => { setSearch(""); setCategory(""); setPriceRange(""); setShowFavOnly(false); }}>
            إعادة تعيين الفلاتر
          </button>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((product, i) => (
            <ProductCard
              key={product.id}
              product={product}
              isFav={favorites.has(product.id)}
              cartQty={cart.find(c => c.product_id === product.id)?.quantity ?? 0}
              animDelay={i * 40}
              onFav={() => toggleFavorite(product.id)}
              onAddToCart={() => addToCart(product)}
              onContact={() => contactSupplier(product.supplier_id)}
            />
          ))}
        </div>
      )}

      {/* Cart Sidebar */}
      {cartOpen && (
        <CartSidebar
          cart={cart}
          products={products}
          total={cartTotal}
          onClose={() => setCartOpen(false)}
          onUpdateQty={updateCartQty}
          onCheckout={() => { setCartOpen(false); router.push("/orders/new"); }}
        />
      )}
    </div>
  );
}

// ─── Product Card ─────────────────────────────────────────────────────────────

function ProductCard({ product, isFav, cartQty, animDelay, onFav, onAddToCart, onContact }: {
  product: Product; isFav: boolean; cartQty: number; animDelay: number;
  onFav: () => void; onAddToCart: () => void; onContact: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const cat = CATEGORIES.find(c => c.value === product.category);
  return (
    <div className="pc" style={{ ...s.card, ...(hovered ? s.cardHovered : {}), animationDelay: `${animDelay}ms` }}
      onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <button style={s.favBtn} onClick={onFav}>{isFav ? "❤️" : "🤍"}</button>
      <div style={s.productImg}><span style={{ fontSize: 60 }}>{product.icon}</span></div>
      <div style={s.cardBody}>
        {cat && <span style={s.categoryTag}>{cat.emoji} {cat.label}</span>}
        <h3 style={s.productName}>{product.name}</h3>
        <p style={s.productDesc}>{product.description}</p>
        <div style={s.supplierRow}><span>🏭</span><span style={s.supplierName}>{product.supplier?.business_name ?? "مورد"}</span></div>
        <div style={s.priceRow}>
          <span style={s.price}>{product.price.toLocaleString()} د</span>
          <span style={s.minOrder}>حد أدنى: {product.min_order} قطعة</span>
        </div>
        <div style={s.actions}>
          <button style={{ ...s.actionBtn, ...s.cartActionBtn }} onClick={onAddToCart}>
            {cartQty > 0 ? `🛒 في السلة (${cartQty})` : "أضف للسلة"}
          </button>
          <button style={{ ...s.actionBtn, ...s.contactBtn }} onClick={onContact}>💬 تواصل</button>
        </div>
      </div>
    </div>
  );
}

// ─── Cart Sidebar ─────────────────────────────────────────────────────────────

function CartSidebar({ cart, products, total, onClose, onUpdateQty, onCheckout }: {
  cart: CartItem[]; products: Product[]; total: number;
  onClose: () => void; onUpdateQty: (id: string, delta: number) => void; onCheckout: () => void;
}) {
  return (
    <>
      <div style={s.overlay} onClick={onClose} />
      <div style={s.sidebar}>
        <div style={s.sidebarHeader}>
          <h2 style={s.sidebarTitle}>🛒 السلة</h2>
          <button style={s.closeBtn} onClick={onClose}>✕</button>
        </div>
        {cart.length === 0 ? (
          <div style={s.emptyCart}><span style={{ fontSize: 56 }}>🛒</span><p>السلة فارغة</p></div>
        ) : (
          <div style={s.cartItems}>
            {cart.map(item => {
              const product = products.find(p => p.id === item.product_id);
              if (!product) return null;
              return (
                <div key={item.product_id} style={s.cartItem}>
                  <span style={{ fontSize: 30 }}>{product.icon}</span>
                  <div style={s.cartItemInfo}>
                    <p style={s.cartItemName}>{product.name}</p>
                    <p style={s.cartItemPrice}>{(product.price * item.quantity).toLocaleString()} د</p>
                  </div>
                  <div style={s.qtyControl}>
                    <button style={s.qtyBtn} onClick={() => onUpdateQty(item.product_id, -1)}>−</button>
                    <span style={s.qtyValue}>{item.quantity}</span>
                    <button style={s.qtyBtn} onClick={() => onUpdateQty(item.product_id, 1)}>+</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {cart.length > 0 && (
          <div style={s.sidebarFooter}>
            <div style={s.totalRow}><span>الإجمالي:</span><span style={s.totalAmount}>{total.toLocaleString()} دينار</span></div>
            <button style={s.checkoutBtn} onClick={onCheckout}>إتمام الطلب ←</button>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#f0f4f8", padding: "24px", fontFamily: "'Cairo','Segoe UI',sans-serif", position: "relative" },
  loadingWrap: { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: 16, background: "#f0f4f8", fontFamily: "'Cairo',sans-serif" },
  loadingText: { color: "#546a85", fontSize: 16 },
  toast: { position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", color: "#fff", padding: "12px 28px", borderRadius: 12, fontWeight: 700, fontSize: 15, zIndex: 9999, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", whiteSpace: "nowrap" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 28, fontWeight: 900, color: "#273347", margin: 0 },
  subtitle: { fontSize: 14, color: "#546a85", margin: "4px 0 0" },
  cartBtn: { position: "relative", background: "#273347", color: "#fff", border: "none", borderRadius: 12, padding: "12px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "'Cairo',sans-serif" },
  cartBadge: { position: "absolute", top: -8, left: -8, background: "#ef4444", color: "#fff", borderRadius: "50%", width: 22, height: 22, fontSize: 12, fontWeight: 900, display: "flex", alignItems: "center", justifyContent: "center" },
  filtersCard: { background: "#fff", borderRadius: 16, padding: 20, marginBottom: 24, boxShadow: "0 2px 12px rgba(39,51,71,0.08)", display: "flex", flexDirection: "column", gap: 16 },
  searchWrap: { display: "flex", alignItems: "center", background: "#f0f4f8", borderRadius: 12, padding: "0 12px", gap: 8, fontSize: 18 },
  searchInput: { flex: 1, border: "none", background: "transparent", padding: "12px 8px", fontSize: 15, fontFamily: "'Cairo',sans-serif", outline: "none", direction: "rtl", color: "#273347" },
  clearBtn: { background: "none", border: "none", cursor: "pointer", color: "#546a85", fontSize: 16, padding: 4 },
  filterRow: { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", justifyContent: "space-between" },
  catWrap: { display: "flex", gap: 8, flexWrap: "wrap" },
  catBtn: { padding: "8px 16px", borderRadius: 20, border: "2px solid #bbd0e4", background: "#f0f4f8", color: "#546a85", cursor: "pointer", fontSize: 13, fontFamily: "'Cairo',sans-serif", fontWeight: 600 },
  catBtnActive: { background: "#273347", color: "#fff", borderColor: "#273347" },
  rightFilters: { display: "flex", gap: 10, alignItems: "center" },
  select: { padding: "10px 14px", borderRadius: 10, border: "2px solid #bbd0e4", background: "#f0f4f8", color: "#273347", fontSize: 14, fontFamily: "'Cairo',sans-serif", fontWeight: 600, outline: "none", cursor: "pointer" },
  favToggle: { padding: "10px 18px", borderRadius: 10, border: "2px solid #bbd0e4", background: "#f0f4f8", color: "#546a85", cursor: "pointer", fontSize: 14, fontFamily: "'Cairo',sans-serif", fontWeight: 700 },
  favToggleActive: { background: "#fff0f3", borderColor: "#ef4444", color: "#ef4444" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 20 },
  emptyState: { textAlign: "center", padding: "80px 0", color: "#546a85" },
  resetBtn: { background: "#273347", color: "#fff", border: "none", borderRadius: 10, padding: "12px 28px", cursor: "pointer", fontSize: 15, fontFamily: "'Cairo',sans-serif", fontWeight: 700 },
  card: { background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 12px rgba(39,51,71,0.08)", transition: "transform 0.2s,box-shadow 0.2s", position: "relative", display: "flex", flexDirection: "column" },
  cardHovered: { transform: "translateY(-4px)", boxShadow: "0 8px 28px rgba(39,51,71,0.15)" },
  favBtn: { position: "absolute", top: 12, left: 12, background: "rgba(255,255,255,0.9)", border: "none", borderRadius: "50%", width: 36, height: 36, fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.12)", zIndex: 1 },
  productImg: { background: "linear-gradient(135deg,#273347 0%,#546a85 100%)", height: 160, display: "flex", alignItems: "center", justifyContent: "center" },
  cardBody: { padding: 16, flex: 1, display: "flex", flexDirection: "column", gap: 8 },
  categoryTag: { fontSize: 12, color: "#546a85", fontWeight: 600, background: "#f0f4f8", display: "inline-block", padding: "3px 10px", borderRadius: 20, alignSelf: "flex-start" },
  productName: { fontSize: 17, fontWeight: 800, color: "#273347", margin: 0 },
  productDesc: { fontSize: 13, color: "#546a85", margin: 0, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" },
  supplierRow: { display: "flex", alignItems: "center", gap: 6, fontSize: 14 },
  supplierName: { fontSize: 13, color: "#546a85", fontWeight: 600 },
  priceRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  price: { fontSize: 20, fontWeight: 900, color: "#22c55e" },
  minOrder: { fontSize: 12, color: "#546a85", background: "#f0f4f8", padding: "2px 8px", borderRadius: 8 },
  actions: { display: "flex", gap: 8, marginTop: 8 },
  actionBtn: { flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", fontSize: 13, fontFamily: "'Cairo',sans-serif", fontWeight: 700, cursor: "pointer" },
  cartActionBtn: { background: "#273347", color: "#fff" },
  contactBtn: { background: "#f0f4f8", color: "#273347", border: "2px solid #bbd0e4" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100 },
  sidebar: { position: "fixed", top: 0, left: 0, bottom: 0, width: 380, background: "#fff", zIndex: 101, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", fontFamily: "'Cairo',sans-serif" },
  sidebarHeader: { padding: "20px 24px", borderBottom: "2px solid #f0f4f8", display: "flex", justifyContent: "space-between", alignItems: "center" },
  sidebarTitle: { fontSize: 20, fontWeight: 900, color: "#273347", margin: 0 },
  closeBtn: { background: "#f0f4f8", border: "none", borderRadius: 8, width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 700, color: "#546a85" },
  emptyCart: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#546a85", fontSize: 16, gap: 8 },
  cartItems: { flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 12 },
  cartItem: { display: "flex", alignItems: "center", gap: 12, padding: 12, background: "#f0f4f8", borderRadius: 12 },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 14, fontWeight: 700, color: "#273347", margin: 0 },
  cartItemPrice: { fontSize: 13, color: "#22c55e", fontWeight: 700, margin: "2px 0 0" },
  qtyControl: { display: "flex", alignItems: "center", gap: 6, background: "#fff", borderRadius: 8, padding: "4px 8px", border: "2px solid #bbd0e4" },
  qtyBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#273347", fontWeight: 900, lineHeight: 1, padding: "0 4px" },
  qtyValue: { fontSize: 15, fontWeight: 800, color: "#273347", minWidth: 24, textAlign: "center" },
  sidebarFooter: { padding: "16px 20px", borderTop: "2px solid #f0f4f8", display: "flex", flexDirection: "column", gap: 12 },
  totalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 16, fontWeight: 700, color: "#273347" },
  totalAmount: { fontSize: 20, fontWeight: 900, color: "#22c55e" },
  checkoutBtn: { background: "#273347", color: "#fff", border: "none", borderRadius: 12, padding: "14px", fontSize: 16, fontWeight: 800, cursor: "pointer", fontFamily: "'Cairo',sans-serif", width: "100%" },
};