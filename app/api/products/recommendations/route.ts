import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

type SupabaseLike = {
  from: (table: string) => any;
};

type ProductRow = Record<string, any>;
type Interaction = {
  userId: string;
  productId: string;
};

const ORDER_WEIGHT = 5;
const CART_WEIGHT = 3;
const VIEW_WEIGHT = 1;

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function addScore(scores: Map<string, number>, productId: string, value: number) {
  if (!productId) return;
  scores.set(productId, (scores.get(productId) || 0) + value);
}

async function getOrderProductIds(supabase: SupabaseLike, buyerIds: string[]): Promise<Interaction[]> {
  const orderIdsByBuyer = new Map<string, string>();
  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, buyer_id")
    .in("buyer_id", buyerIds);

  if (ordersError || !orders?.length) return [];

  const orderIds = orders.map((order: any) => String(order.id)).filter(Boolean);
  for (const order of orders) {
    orderIdsByBuyer.set(String(order.id), String(order.buyer_id));
  }

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, product_id")
    .in("order_id", orderIds);

  if (itemsError) return [];

  return (items || []).map((item: any) => ({
    userId: orderIdsByBuyer.get(String(item.order_id)) || "",
    productId: String(item.product_id || ""),
  }));
}

async function getCartProductIds(supabase: SupabaseLike, userIds: string[]): Promise<Interaction[]> {
  const cartIdsByUser = new Map<string, string>();
  const { data: carts, error: cartsError } = await supabase
    .from("carts")
    .select("id, user_id")
    .in("user_id", userIds);

  if (cartsError || !carts?.length) return [];

  const cartIds = carts.map((cart: any) => String(cart.id)).filter(Boolean);
  for (const cart of carts) {
    cartIdsByUser.set(String(cart.id), String(cart.user_id));
  }

  const { data: items, error: itemsError } = await supabase
    .from("cart_items")
    .select("cart_id, product_id")
    .in("cart_id", cartIds);

  if (itemsError) return [];

  return (items || []).map((item: any) => ({
    userId: cartIdsByUser.get(String(item.cart_id)) || "",
    productId: String(item.product_id || ""),
  }));
}

async function getViewProductIds(supabase: SupabaseLike, userIds: string[]): Promise<Interaction[]> {
  const { data, error } = await supabase
    .from("product_views")
    .select("user_id, product_id")
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) return [];

  return (data || []).map((item: any) => ({
    userId: String(item.user_id || ""),
    productId: String(item.product_id || ""),
  }));
}

async function findSimilarUsers(supabase: SupabaseLike, userId: string, productIds: string[]) {
  if (productIds.length === 0) return [];

  const similarUserScores = new Map<string, number>();

  const { data: matchingOrderItems } = await supabase
    .from("order_items")
    .select("order_id, product_id")
    .in("product_id", productIds);
  const matchingOrderIds = unique((matchingOrderItems || []).map((item: any) => String(item.order_id || "")));
  if (matchingOrderIds.length > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, buyer_id")
      .in("id", matchingOrderIds);
    for (const order of orders || []) {
      const buyerId = String(order.buyer_id || "");
      if (buyerId && buyerId !== userId) similarUserScores.set(buyerId, (similarUserScores.get(buyerId) || 0) + ORDER_WEIGHT);
    }
  }

  const { data: matchingCartItems } = await supabase
    .from("cart_items")
    .select("cart_id, product_id")
    .in("product_id", productIds);
  const matchingCartIds = unique((matchingCartItems || []).map((item: any) => String(item.cart_id || "")));
  if (matchingCartIds.length > 0) {
    const { data: carts } = await supabase
      .from("carts")
      .select("id, user_id")
      .in("id", matchingCartIds);
    for (const cart of carts || []) {
      const cartUserId = String(cart.user_id || "");
      if (cartUserId && cartUserId !== userId) similarUserScores.set(cartUserId, (similarUserScores.get(cartUserId) || 0) + CART_WEIGHT);
    }
  }

  const { data: matchingViews } = await supabase
    .from("product_views")
    .select("user_id, product_id")
    .in("product_id", productIds)
    .limit(500);
  for (const view of matchingViews || []) {
    const viewUserId = String(view.user_id || "");
    if (viewUserId && viewUserId !== userId) similarUserScores.set(viewUserId, (similarUserScores.get(viewUserId) || 0) + VIEW_WEIGHT);
  }

  return Array.from(similarUserScores.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([similarUserId]) => similarUserId);
}

async function enrichProducts(supabase: SupabaseLike, productIds: string[], scores: Map<string, number>) {
  if (productIds.length === 0) return [];

  const { data: products, error } = await supabase
    .from("products")
    .select("*")
    .in("id", productIds)
    .gt("stock_quantity", 0)
    .eq("is_published", true);

  if (error || !products?.length) return [];

  const supplierIds = unique(products.map((product: ProductRow) => String(product.supplier_id || "")));
  const [{ data: images }, { data: suppliers }, { data: profiles }] = await Promise.all([
    supabase
      .from("product_images")
      .select("id, product_id, image_url, is_primary")
      .in("product_id", products.map((product: ProductRow) => String(product.id))),
    supplierIds.length > 0
      ? supabase.from("supplier_profiles").select("user_id, store_name, product_category").in("user_id", supplierIds)
      : Promise.resolve({ data: [] }),
    supplierIds.length > 0
      ? supabase.from("profiles").select("id, full_name, account_type").in("id", supplierIds)
      : Promise.resolve({ data: [] }),
  ]);

  const imageMap = new Map<string, ProductRow[]>();
  for (const image of images || []) {
    const list = imageMap.get(String(image.product_id)) || [];
    list.push(image);
    imageMap.set(String(image.product_id), list);
  }

  const supplierMap = new Map<string, { store_name: string; product_category: string }>();
  for (const supplier of suppliers || []) {
    supplierMap.set(String(supplier.user_id), {
      store_name: String(supplier.store_name || ""),
      product_category: String(supplier.product_category || ""),
    });
  }

  const profileMap = new Map<string, { full_name: string; account_type: string }>();
  for (const profile of profiles || []) {
    profileMap.set(String(profile.id), {
      full_name: String(profile.full_name || ""),
      account_type: String(profile.account_type || ""),
    });
  }

  return products
    .map((product: ProductRow) => {
      const productImages = imageMap.get(String(product.id)) || [];
      const primaryImage = productImages.find((image) => Boolean(image.is_primary)) || productImages[0] || null;
      const supplierId = String(product.supplier_id || "");
      const supplier = supplierMap.get(supplierId);
      const supplierName = supplier?.store_name || profileMap.get(supplierId)?.full_name || "متجر المورد";

      return {
        ...product,
        category: String(product.category || product.category_id || supplier?.product_category || ""),
        price: Number(product.wholesale_price || 0),
        currency: product.currency || "ILS",
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_type: profileMap.get(supplierId)?.account_type || "merchant",
        supplier_store_name: supplierName,
        supplier_product_category: supplier?.product_category || "",
        primary_image: primaryImage,
        recommendation_score: scores.get(String(product.id)) || 0,
      };
    })
    .filter((product: ProductRow) => Boolean(product.primary_image))
    .sort((a: ProductRow, b: ProductRow) => Number(b.recommendation_score || 0) - Number(a.recommendation_score || 0));
}

async function getPopularRecommendations(supabase: SupabaseLike, excludedProductIds: Set<string>) {
  const scores = new Map<string, number>();

  const { data: orderItems } = await supabase.from("order_items").select("product_id").limit(300);
  for (const item of orderItems || []) addScore(scores, String(item.product_id || ""), ORDER_WEIGHT);

  const { data: cartItems } = await supabase.from("cart_items").select("product_id").limit(300);
  for (const item of cartItems || []) addScore(scores, String(item.product_id || ""), CART_WEIGHT);

  const { data: views } = await supabase.from("product_views").select("product_id").limit(300);
  for (const item of views || []) addScore(scores, String(item.product_id || ""), VIEW_WEIGHT);

  const rankedProductIds = Array.from(scores.entries())
    .filter(([productId]) => !excludedProductIds.has(productId))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([productId]) => productId);

  return enrichProducts(supabase, rankedProductIds, scores);
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const limit = Math.min(20, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 10)));
    let readSupabase: SupabaseLike = supabase;

    try {
      readSupabase = createSupabaseAdmin();
    } catch {
      readSupabase = supabase;
    }

    const [userOrders, userCart, userViews] = await Promise.all([
      getOrderProductIds(readSupabase, [user.id]),
      getCartProductIds(readSupabase, [user.id]),
      getViewProductIds(readSupabase, [user.id]),
    ]);

    const orderedProductIds = new Set(userOrders.map((item) => item.productId));
    const seedProductIds = unique([
      ...userOrders.map((item) => item.productId),
      ...userCart.map((item) => item.productId),
      ...userViews.map((item) => item.productId),
    ]);

    const similarUserIds = await findSimilarUsers(readSupabase, user.id, seedProductIds);
    if (similarUserIds.length === 0) {
      const popular = await getPopularRecommendations(readSupabase, orderedProductIds);
      return NextResponse.json({ products: popular.slice(0, limit), source: "popular" });
    }

    const [similarOrders, similarCart, similarViews] = await Promise.all([
      getOrderProductIds(readSupabase, similarUserIds),
      getCartProductIds(readSupabase, similarUserIds),
      getViewProductIds(readSupabase, similarUserIds),
    ]);

    const scores = new Map<string, number>();
    for (const item of similarOrders) addScore(scores, item.productId, ORDER_WEIGHT);
    for (const item of similarCart) addScore(scores, item.productId, CART_WEIGHT);
    for (const item of similarViews) addScore(scores, item.productId, VIEW_WEIGHT);

    const recommendedIds = Array.from(scores.entries())
      .filter(([productId]) => !orderedProductIds.has(productId))
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([productId]) => productId);

    const products = await enrichProducts(readSupabase, recommendedIds, scores);
    return NextResponse.json({ products: products.slice(0, limit), source: "similar_users" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "فشل تحميل التوصيات.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
