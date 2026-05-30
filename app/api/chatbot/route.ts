import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { checkIsAdmin, requireAuthProfile } from "@/lib/api-auth";
import { groq } from "@/lib/groq";

type DbRow = Record<string, unknown>;

type UserType = "supplier" | "merchant" | "delivery" | "supporter" | "admin";

type RoleDataSet = {
  primary: DbRow[];
  secondary: DbRow[];
  aiInsights: DbRow[];
  warnings: string[];
  primaryTable: string;
  secondaryTable: string;
};

type ProductPerformance = {
  id: string | null;
  name: string;
  orders: number;
  quantity: number;
  revenue: number;
  stock: number | null;
};

type SupplierProductMatch = {
  productId: string;
  productName: string;
  description: string | null;
  category: string | null;
  price: number;
  currency: string;
  stock: number;
  minOrderQuantity: number;
  supplierId: string;
  supplierName: string;
  supplierCity: string | null;
  supplierCountry: string | null;
  supplierCategory: string | null;
  score: number;
};

type InternalMarketSearch = {
  triggered: boolean;
  query: string;
  matches: SupplierProductMatch[];
  warnings: string[];
};

type AnalysisResult = {
  userId: string;
  userType: UserType;
  businessDomain: string;
  generatedAt: string;
  summary: {
    totalOrders: number;
    totalRevenue: number;
    averageOrderValue: number;
    last7DaysOrders: number;
    previous7DaysOrders: number;
    last7DaysRevenue: number;
    previous7DaysRevenue: number;
  };
  salesTrend: {
    direction: "up" | "down" | "stable" | "insufficient_data";
    orderChangePercent: number | null;
    revenueChangePercent: number | null;
    dailyRevenue: Array<{ date: string; orders: number; revenue: number }>;
    alert: string | null;
  };
  topProducts: ProductPerformance[];
  weakProducts: ProductPerformance[];
  marketingIntelligence: {
    mostRequestedProducts: ProductPerformance[];
    lowStockProducts: Array<{ id: string | null; name: string; stock: number }>;
    customerBehavior: string[];
    externalSignals: ExternalSignals;
    internalMarketSearch: InternalMarketSearch;
  };
  recommendations: string[];
  previousInsights: DbRow[];
  dataQuality: {
    primaryRowsLoaded: number;
    secondaryRowsLoaded: number;
    aiInsightsLoaded: number;
    primaryTable: string;
    secondaryTable: string;
    warnings: string[];
  };
};

type ExternalSignals = {
  googleTrends: string[];
  reddit: string[];
  youtube: string[];
  warnings: string[];
};

const OWNER_COLUMNS = ["user_id", "profile_id", "supplier_id", "merchant_id", "business_id", "owner_id"];

const USER_TYPES = new Set<UserType>(["supplier", "merchant", "delivery", "supporter", "admin"]);

function createAnalyticsSupabase(token: string) {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return createSupabaseAdmin();
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const ROLE_CONFIG: Record<
  UserType,
  {
    domain: string;
    primaryTable: string;
    secondaryTable: string;
    primaryOwnerColumns: string[];
    secondaryOwnerColumns: string[];
    promptFocus: string;
  }
> = {
  supplier: {
    domain: "مبيعات المورد والمنتجات والمخزون",
    primaryTable: "orders",
    secondaryTable: "products",
    primaryOwnerColumns: ["supplier_id", ...OWNER_COLUMNS],
    secondaryOwnerColumns: ["supplier_id", ...OWNER_COLUMNS],
    promptFocus: "ركز على المبيعات، أفضل المنتجات، المنتجات الضعيفة، المخزون، وفرص التسويق.",
  },
  merchant: {
    domain: "مشتريات التاجر وسلوك الشراء",
    primaryTable: "orders",
    secondaryTable: "orders",
    primaryOwnerColumns: ["merchant_id", "buyer_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    secondaryOwnerColumns: ["merchant_id", "buyer_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    promptFocus: "ركز على نمط الشراء، تكرار الطلبات، الموردين أو المنتجات الأكثر مناسبة، وتحسين قرارات الشراء.",
  },
  delivery: {
    domain: "أداء التوصيل والطلبات اللوجستية",
    primaryTable: "orders",
    secondaryTable: "orders",
    primaryOwnerColumns: ["delivery_id", "shipping_company_id", "company_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    secondaryOwnerColumns: ["delivery_id", "shipping_company_id", "company_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    promptFocus: "ركز على سرعة التوصيل، الطلبات المتأخرة، الأداء التشغيلي، وتحسين مسارات الخدمة.",
  },
  supporter: {
    domain: "استثمارات الداعم والطلبات والفرص",
    primaryTable: "investments",
    secondaryTable: "support_requests",
    primaryOwnerColumns: ["supporter_id", "investor_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    secondaryOwnerColumns: ["supporter_id", "investor_id", "user_id", "profile_id", ...OWNER_COLUMNS],
    promptFocus: "ركز على الاستثمارات، الطلبات، تقييم الفرص، المخاطر، وأفضل خطوات الدعم القادمة.",
  },
  admin: {
    domain: "مراقبة النظام والطلبات والإحصاءات العامة",
    primaryTable: "orders",
    secondaryTable: "products",
    primaryOwnerColumns: [],
    secondaryOwnerColumns: [],
    promptFocus: "ركز على مؤشرات النظام، الطلبات، المستخدمين، المخاطر التشغيلية، وما يحتاج متابعة إدارية.",
  },
};

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^\d.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function getString(row: DbRow, keys: string[], fallback = ""): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return fallback;
}

function getFirstValue(row: DbRow, keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null) return row[key];
  }
  return null;
}

function getOrderRevenue(order: DbRow): number {
  const total = getFirstValue(order, [
    "total_amount",
    "total",
    "total_price",
    "grand_total",
    "amount",
    "subtotal",
    "price",
    "wholesale_price",
  ]);
  return toNumber(total);
}

function getQuantity(row: DbRow): number {
  const quantity = getFirstValue(row, ["quantity", "qty", "order_quantity", "count"]);
  const parsed = toNumber(quantity);
  return parsed > 0 ? parsed : 1;
}

function getCreatedAt(row: DbRow): Date | null {
  return toDate(getFirstValue(row, ["created_at", "ordered_at", "order_date", "date", "updated_at"]));
}

function getProductId(row: DbRow): string | null {
  const value = getFirstValue(row, ["product_id", "productId", "id"]);
  return value ? String(value) : null;
}

function getOrderProductId(row: DbRow): string | null {
  const value = getFirstValue(row, ["product_id", "productId"]);
  return value ? String(value) : null;
}

function getProductName(row: DbRow, fallback = "منتج غير محدد"): string {
  return getString(row, ["product_name", "name", "title", "product_title"], fallback);
}

function normalizeSearchText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0600-\u06ff\w\s.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]) {
  return terms.some((term) => text.includes(term));
}

function shouldSearchInternalMarket(message: string, userType: UserType) {
  if (userType !== "merchant" && userType !== "admin") return false;

  const normalized = normalizeSearchText(message);
  const intentTerms = [
    "مورد",
    "موردين",
    "منتج",
    "منتجات",
    "بضاعة",
    "جملة",
    "سعر",
    "اسعار",
    "أسعار",
    "متوفر",
    "متوفرة",
    "اشتري",
    "شراء",
    "وين",
    "اين",
    "أين",
    "supplier",
    "product",
    "products",
    "wholesale",
    "price",
  ];

  return includesAny(normalized, intentTerms);
}

function extractMarketSearchTerms(message: string) {
  const stopWords = new Set([
    "بدي",
    "اريد",
    "أريد",
    "بدنا",
    "اعطيني",
    "اقترح",
    "مورد",
    "موردين",
    "منتج",
    "منتجات",
    "سعر",
    "اسعار",
    "أسعار",
    "جملة",
    "وين",
    "اين",
    "أين",
    "متوفر",
    "متوفرة",
    "مناسب",
    "مناسبه",
    "مناسبين",
    "مناسبة",
    "افضل",
    "أفضل",
    "كويس",
    "كويسه",
    "جيد",
    "جيده",
    "للمشروع",
    "مشروعي",
    "في",
    "من",
    "على",
    "عن",
    "او",
    "أو",
    "و",
    "the",
    "a",
    "an",
    "for",
    "with",
    "supplier",
    "suppliers",
    "product",
    "products",
    "price",
  ]);

  return Array.from(new Set(normalizeSearchText(message).split(" ")))
    .map((term) => term.trim())
    .filter((term) => term.length >= 2 && !stopWords.has(term))
    .slice(0, 8);
}

async function fetchInternalMarketSearch(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  message: string,
  userType: UserType
): Promise<InternalMarketSearch> {
  const triggered = shouldSearchInternalMarket(message, userType);
  const terms = extractMarketSearchTerms(message);
  const query = terms.join(" ");
  const emptyResult = { triggered, query, matches: [], warnings: [] };

  if (!triggered) return emptyResult;

  const { data: products, error: productsError } = await supabase
    .from("products")
    .select("*")
    .eq("is_published", true)
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false })
    .limit(120);

  if (productsError) {
    return {
      ...emptyResult,
      warnings: [`products: ${productsError.message}`],
    };
  }

  const productRows = ((products || []) as DbRow[]).filter((product) => String(product.supplier_id || ""));
  const supplierIds = Array.from(new Set(productRows.map((product) => String(product.supplier_id))));

  if (supplierIds.length === 0) return emptyResult;

  const [{ data: supplierProfiles, error: supplierError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase
      .from("supplier_profiles")
      .select("user_id, store_name, product_category")
      .in("user_id", supplierIds),
    supabase
      .from("profiles")
      .select("id, full_name, country, city, account_type, status, is_active")
      .in("id", supplierIds),
  ]);

  const warnings = [supplierError ? `supplier_profiles: ${supplierError.message}` : null, profileError ? `profiles: ${profileError.message}` : null].filter(Boolean) as string[];
  const supplierMap = new Map<string, DbRow>();
  const profileMap = new Map<string, DbRow>();

  for (const supplier of (supplierProfiles || []) as DbRow[]) {
    supplierMap.set(String(supplier.user_id), supplier);
  }

  for (const profile of (profiles || []) as DbRow[]) {
    profileMap.set(String(profile.id), profile);
  }

  const matches = productRows
    .map((product): SupplierProductMatch | null => {
      const supplierId = String(product.supplier_id || "");
      const supplier = supplierMap.get(supplierId) || {};
      const profile = profileMap.get(supplierId) || {};
      const status = String(profile.status || "").toLowerCase();
      const accountType = String(profile.account_type || "").toLowerCase();
      const isActive = profile.is_active !== false;

      if (!isActive || status !== "approved" || accountType === "admin") return null;

      const productName = getProductName(product, "منتج بدون اسم");
      const supplierName = getString(supplier, ["store_name"], getString(profile, ["full_name"], "مورد بدون اسم"));
      const category = getString(product, ["category", "category_id"], getString(supplier, ["product_category"], ""));
      const haystack = normalizeSearchText([
        productName,
        product.description,
        category,
        supplierName,
        supplier.product_category,
        profile.city,
        profile.country,
      ].join(" "));

      const score =
        terms.length === 0
          ? 1
          : terms.reduce((sum, term) => {
              if (!haystack.includes(term)) return sum;
              if (normalizeSearchText(productName).includes(term)) return sum + 5;
              if (normalizeSearchText(category).includes(term)) return sum + 4;
              if (normalizeSearchText(supplierName).includes(term)) return sum + 3;
              return sum + 1;
            }, 0);

      if (terms.length > 0 && score === 0) return null;

      return {
        productId: String(product.id || ""),
        productName,
        description: product.description ? String(product.description) : null,
        category: category || null,
        price: toNumber(product.wholesale_price),
        currency: String(product.currency || "ILS"),
        stock: toNumber(product.stock_quantity),
        minOrderQuantity: Math.max(1, toNumber(product.min_order_quantity) || 1),
        supplierId,
        supplierName,
        supplierCity: profile.city ? String(profile.city) : null,
        supplierCountry: profile.country ? String(profile.country) : null,
        supplierCategory: supplier.product_category ? String(supplier.product_category) : null,
        score,
      };
    })
    .filter((match): match is SupplierProductMatch => Boolean(match))
    .sort((a, b) => b.score - a.score || b.stock - a.stock || a.price - b.price)
    .slice(0, 8);

  return { triggered, query, matches, warnings };
}

function percentChange(current: number, previous: number): number | null {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

async function fetchRowsAll(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  table: string,
  limit = 1000
): Promise<{ rows: DbRow[]; warning: string | null }> {
  const { data, error } = await supabase.from(table).select("*").limit(limit);

  if (error) {
    return { rows: [], warning: `${table}: ${error.message}` };
  }

  return { rows: (data || []) as DbRow[], warning: null };
}

async function fetchRowsByOwner(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  table: string,
  userId: string,
  ownerColumns = OWNER_COLUMNS,
  limit = 500
): Promise<{ rows: DbRow[]; warning: string | null }> {
  const missingColumnCodes = new Set(["42703", "PGRST204"]);
  let lastError: string | null = null;

  for (const column of ownerColumns) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .eq(column, userId)
      .limit(limit);

    if (!error) {
      return { rows: (data || []) as DbRow[], warning: null };
    }

    lastError = error.message;
    if (!missingColumnCodes.has(error.code || "")) {
      return { rows: [], warning: `${table}: ${error.message}` };
    }
  }

  return {
    rows: [],
    warning: lastError ? `${table}: no supported owner column found (${lastError})` : null,
  };
}

function normalizeUserType(value: unknown): UserType {
  const userType = String(value || "").trim() as UserType;
  return USER_TYPES.has(userType) ? userType : "supplier";
}

function resolveProfileUserType(profileAccountType: unknown, requestedUserType?: UserType): UserType {
  const accountType = String(profileAccountType || "").trim().toLowerCase();

  if (accountType === "small_business") return "merchant";
  if (accountType === "merchant" && requestedUserType === "supplier") return "supplier";
  if (USER_TYPES.has(accountType as UserType)) return accountType as UserType;

  return requestedUserType || "supplier";
}

async function fetchRoleData(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  userType: UserType
): Promise<RoleDataSet> {
  const config = ROLE_CONFIG[userType];
  const fetchPrimary =
    userType === "admin"
      ? fetchRowsAll(supabase, config.primaryTable, 1000)
      : fetchRowsByOwner(supabase, config.primaryTable, userId, config.primaryOwnerColumns, 1000);
  const fetchSecondary =
    userType === "admin"
      ? fetchRowsAll(supabase, config.secondaryTable, 1000)
      : fetchRowsByOwner(supabase, config.secondaryTable, userId, config.secondaryOwnerColumns, 500);
  const [primaryResult, secondaryResult, insightsResult] = await Promise.all([
    fetchPrimary,
    fetchSecondary,
    fetchRowsByOwner(supabase, "ai_insights", userId, OWNER_COLUMNS, 50),
  ]);

  return {
    primary: primaryResult.rows,
    secondary: secondaryResult.rows,
    aiInsights: insightsResult.rows,
    warnings: [primaryResult.warning, secondaryResult.warning, insightsResult.warning].filter(Boolean) as string[],
    primaryTable: config.primaryTable,
    secondaryTable: config.secondaryTable,
  };
}

function analyzeOrders(orders: DbRow[]) {
  const validOrders = orders.filter((order) => {
    const status = getString(order, ["status", "order_status"]).toLowerCase();
    return !["cancelled", "canceled", "rejected", "refunded"].includes(status);
  });

  const totalRevenue = validOrders.reduce((sum, order) => sum + getOrderRevenue(order), 0);
  const totalOrders = validOrders.length;
  const averageOrderValue = totalOrders ? totalRevenue / totalOrders : 0;

  const now = new Date();
  const startLast7 = new Date(now);
  startLast7.setDate(now.getDate() - 7);
  const startPrevious7 = new Date(now);
  startPrevious7.setDate(now.getDate() - 14);

  const last7 = validOrders.filter((order) => {
    const date = getCreatedAt(order);
    return date && date >= startLast7;
  });
  const previous7 = validOrders.filter((order) => {
    const date = getCreatedAt(order);
    return date && date >= startPrevious7 && date < startLast7;
  });

  const last7Revenue = last7.reduce((sum, order) => sum + getOrderRevenue(order), 0);
  const previous7Revenue = previous7.reduce((sum, order) => sum + getOrderRevenue(order), 0);

  return {
    validOrders,
    summary: {
      totalOrders,
      totalRevenue: roundMoney(totalRevenue),
      averageOrderValue: roundMoney(averageOrderValue),
      last7DaysOrders: last7.length,
      previous7DaysOrders: previous7.length,
      last7DaysRevenue: roundMoney(last7Revenue),
      previous7DaysRevenue: roundMoney(previous7Revenue),
    },
  };
}

function analyzeTimeSeries(orders: DbRow[]) {
  const days = new Map<string, { date: string; orders: number; revenue: number }>();
  const now = new Date();

  for (let offset = 13; offset >= 0; offset -= 1) {
    const date = new Date(now);
    date.setDate(now.getDate() - offset);
    const key = date.toISOString().slice(0, 10);
    days.set(key, { date: key, orders: 0, revenue: 0 });
  }

  for (const order of orders) {
    const date = getCreatedAt(order);
    if (!date) continue;
    const key = date.toISOString().slice(0, 10);
    const bucket = days.get(key);
    if (!bucket) continue;
    bucket.orders += 1;
    bucket.revenue = roundMoney(bucket.revenue + getOrderRevenue(order));
  }

  const dailyRevenue = Array.from(days.values());
  const firstHalfRevenue = dailyRevenue.slice(0, 7).reduce((sum, day) => sum + day.revenue, 0);
  const secondHalfRevenue = dailyRevenue.slice(7).reduce((sum, day) => sum + day.revenue, 0);
  const firstHalfOrders = dailyRevenue.slice(0, 7).reduce((sum, day) => sum + day.orders, 0);
  const secondHalfOrders = dailyRevenue.slice(7).reduce((sum, day) => sum + day.orders, 0);
  const revenueChangePercent = percentChange(secondHalfRevenue, firstHalfRevenue);
  const orderChangePercent = percentChange(secondHalfOrders, firstHalfOrders);

  let direction: AnalysisResult["salesTrend"]["direction"] = "insufficient_data";
  if (firstHalfOrders + secondHalfOrders >= 3) {
    const change = revenueChangePercent ?? orderChangePercent ?? 0;
    direction = change > 10 ? "up" : change < -10 ? "down" : "stable";
  }

  const alert =
    direction === "down"
      ? `تنبيه: المبيعات منخفضة مقارنة بالأسبوع السابق${revenueChangePercent !== null ? ` بنسبة ${Math.abs(revenueChangePercent)}%` : ""}.`
      : null;

  return { direction, orderChangePercent, revenueChangePercent, dailyRevenue, alert };
}

function analyzeProducts(products: DbRow[], orders: DbRow[]) {
  const productMap = new Map<string, ProductPerformance>();

  for (const product of products) {
    const id = getProductId(product);
    if (!id) continue;
    productMap.set(id, {
      id,
      name: getProductName(product),
      orders: 0,
      quantity: 0,
      revenue: 0,
      stock: product.stock_quantity === undefined ? null : toNumber(product.stock_quantity),
    });
  }

  for (const order of orders) {
    const productId = getOrderProductId(order);
    const productName = getProductName(order);
    const key = productId || productName;
    if (!key) continue;

    const current =
      productMap.get(key) ||
      ({
        id: productId,
        name: productName,
        orders: 0,
        quantity: 0,
        revenue: 0,
        stock: null,
      } satisfies ProductPerformance);

    current.orders += 1;
    current.quantity += getQuantity(order);
    current.revenue = roundMoney(current.revenue + getOrderRevenue(order));
    productMap.set(key, current);
  }

  const performance = Array.from(productMap.values());
  const topProducts = performance
    .filter((product) => product.orders > 0 || product.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity || b.orders - a.orders)
    .slice(0, 5);

  const weakProducts = performance
    .filter((product) => product.orders === 0 || product.revenue === 0)
    .sort((a, b) => (b.stock || 0) - (a.stock || 0))
    .slice(0, 5);

  const lowStockProducts = performance
    .filter((product) => product.stock !== null && product.stock <= 5)
    .map((product) => ({ id: product.id, name: product.name, stock: product.stock || 0 }))
    .slice(0, 5);

  return { performance, topProducts, weakProducts, lowStockProducts };
}

function generateInsights(params: {
  ordersSummary: ReturnType<typeof analyzeOrders>["summary"];
  salesTrend: AnalysisResult["salesTrend"];
  topProducts: ProductPerformance[];
  weakProducts: ProductPerformance[];
  lowStockProducts: Array<{ id: string | null; name: string; stock: number }>;
}) {
  const recommendations: string[] = [];
  const customerBehavior: string[] = [];

  if (params.salesTrend.direction === "down") {
    recommendations.push("راجع آخر 7 أيام: أطلق عرض قصير على أفضل منتج بدل توزيع الميزانية على كل المنتجات.");
  }

  if (params.topProducts[0]) {
    recommendations.push(`ركز المحتوى والإعلانات على ${params.topProducts[0].name} لأنه الأعلى أداء من بياناتك.`);
    customerBehavior.push(`العملاء يميلون أكثر إلى ${params.topProducts[0].name} مقارنة بباقي المنتجات.`);
  }

  if (params.weakProducts.length > 0) {
    recommendations.push(`اختبر صورا أو تسعيرا أو Bundle للمنتجات الضعيفة مثل ${params.weakProducts[0].name}.`);
  }

  if (params.lowStockProducts.length > 0) {
    recommendations.push(`انتبه للمخزون: ${params.lowStockProducts[0].name} قريب من النفاد.`);
  }

  if (params.ordersSummary.averageOrderValue > 0) {
    recommendations.push(`ارفع متوسط السلة بعرض إضافة صغيرة حول قيمة ${Math.round(params.ordersSummary.averageOrderValue * 0.2)}.`);
    customerBehavior.push(`متوسط قيمة الطلب الحالي ${params.ordersSummary.averageOrderValue}، وهذا يساعد في تصميم عروض Upsell.`);
  }

  if (recommendations.length === 0) {
    recommendations.push("ابدأ بجمع طلبات أكثر وربط كل طلب بالمنتج حتى تصبح التوصيات أدق.");
  }

  if (customerBehavior.length === 0) {
    customerBehavior.push("البيانات الحالية محدودة، لذلك لا يوجد نمط عملاء قوي بعد.");
  }

  return { recommendations, customerBehavior };
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GradB2BChatbot/1.0" },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "GradB2BChatbot/1.0" },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function getExternalSignals(message: string, topProducts: ProductPerformance[]): Promise<ExternalSignals> {
  const query = encodeURIComponent(topProducts[0]?.name || message.slice(0, 80));
  const signals: ExternalSignals = { googleTrends: [], reddit: [], youtube: [], warnings: [] };

  try {
    const reddit = await fetchJson(`https://www.reddit.com/search.json?q=${query}&sort=hot&limit=3`);
    signals.reddit = (reddit?.data?.children || [])
      .map((item: { data?: { title?: string } }) => item.data?.title)
      .filter(Boolean)
      .slice(0, 3);
  } catch (error) {
    signals.warnings.push(`Reddit signals unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  if (process.env.YOUTUBE_API_KEY) {
    try {
      const youtube = await fetchJson(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=3&order=relevance&q=${query}&key=${process.env.YOUTUBE_API_KEY}`
      );
      signals.youtube = (youtube?.items || [])
        .map((item: { snippet?: { title?: string } }) => item.snippet?.title)
        .filter(Boolean)
        .slice(0, 3);
    } catch (error) {
      signals.warnings.push(`YouTube signals unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  } else {
    signals.warnings.push("YouTube skipped: missing YOUTUBE_API_KEY.");
  }

  try {
    const trends = await fetchText("https://trends.google.com/trends/api/dailytrends?hl=ar&geo=US&ns=15");
    const parsed = JSON.parse(trends.replace(/^\)\]\}',?\n?/, ""));
    signals.googleTrends =
      parsed?.default?.trendingSearchesDays?.[0]?.trendingSearches
        ?.map((item: { title?: { query?: string } }) => item.title?.query)
        .filter(Boolean)
        .slice(0, 5) || [];
  } catch (error) {
    signals.warnings.push(`Google Trends signals unavailable: ${error instanceof Error ? error.message : "unknown error"}`);
  }

  return signals;
}

async function saveMessage(params: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  table: string;
  payload: DbRow;
}) {
  const { error } = await params.supabase.from(params.table).insert(params.payload);
  return error?.message || null;
}

async function fetchChatHistory(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  sessionId: string,
  limit = 10
) {
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("role, message")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return [];
  }

  return [...(data || [])]
    .reverse()
    .filter((item) => item.role === "user" || item.role === "assistant")
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: String(item.message || ""),
    }));
}

async function createChatSession(
  supabase: ReturnType<typeof createSupabaseAdmin>,
  userId: string,
  userType: UserType
) {
  const typedInsert = await supabase
    .from("ai_chat_sessions")
    .insert({ profile_id: userId, user_type: userType })
    .select("id")
    .single();

  if (!typedInsert.error) {
    if (!typedInsert.data?.id) throw new Error("CHAT_SESSION_CREATE_FAILED");
    return String(typedInsert.data.id);
  }

  const missingUserType = typedInsert.error.code === "42703" || typedInsert.error.code === "PGRST204";
  if (!missingUserType) throw new Error(typedInsert.error.message);

  const { data, error } = await supabase.from("ai_chat_sessions").insert({ profile_id: userId }).select("id").single();
  if (error) throw new Error(error.message);

  if (!data?.id) throw new Error("CHAT_SESSION_CREATE_FAILED");
  return String(data.id);
}

async function getOrCreateChatSession(params: {
  supabase: ReturnType<typeof createSupabaseAdmin>;
  sessionId: string | null;
  userId: string;
  userType: UserType;
}) {
  const { supabase, sessionId, userId, userType } = params;

  if (sessionId) {
    const { data, error } = await supabase
      .from("ai_chat_sessions")
      .select("id, profile_id")
      .eq("id", sessionId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data || String(data.profile_id) !== userId) throw new Error("CHAT_SESSION_FORBIDDEN");

    return String(data.id);
  }

  const { data, error } = await supabase
    .from("ai_chat_sessions")
    .select("id")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);

  return data?.[0]?.id ? String(data[0].id) : createChatSession(supabase, userId, userType);
}

async function touchChatSession(supabase: ReturnType<typeof createSupabaseAdmin>, sessionId: string) {
  await supabase.from("ai_chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
}

function looksLikeBrokenArabic(text: string) {
  const brokenMarkers = text.match(/[ØÙÐÑÃÂ€œ¢Ÿ]/g)?.length || 0;
  return brokenMarkers >= 3;
}

function decodeBrokenArabic(text: string) {
  if (!looksLikeBrokenArabic(text)) return text;

  try {
    const decoded = Buffer.from(text, "latin1").toString("utf8");
    const originalArabicCount = text.match(/[\u0600-\u06ff]/g)?.length || 0;
    const decodedArabicCount = decoded.match(/[\u0600-\u06ff]/g)?.length || 0;
    return decodedArabicCount > originalArabicCount ? decoded : text;
  } catch {
    return text;
  }
}

function enforceArabicOnly(text: string) {
  return text
    .replace(/[A-Za-z]+/g, "")
    .replace(/[^\u0600-\u06ff\u0750-\u077f\u08a0-\u08ff0-9٠-٩\s.,،:؛!?؟%()[\]\-+/"'\n]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function postProcessGroqReply(rawReply: string) {
  const decoded = decodeBrokenArabic(rawReply)
    .normalize("NFKC")
    .replace(/\uFFFD/g, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

  const cleaned = enforceArabicOnly(decoded);
  const arabicCharacters = cleaned.match(/[\u0600-\u06ff]/g)?.length || 0;

  if (!cleaned || arabicCharacters < 5) {
    return "عذرا، لم أتمكن من توليد رد عربي واضح الآن. حاول مرة أخرى بعد قليل.";
  }

  return cleaned;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = String(body.message || "").trim();
    const requestedUserId = String(body.userId || body.profileId || "").trim();
    const requestedUserType = body.requestedUserType || body.userType ? normalizeUserType(body.requestedUserType || body.userType) : undefined;
    const sessionId = body.sessionId ? String(body.sessionId) : null;
    const conversationId = body.conversationId ? String(body.conversationId) : null;

    if (!message) {
      return NextResponse.json({ error: "message مطلوب." }, { status: 400 });
    }

    const auth = await requireAuthProfile(req);
    const userId = requestedUserId || auth.user.id;
    const isAdmin = await checkIsAdmin(auth.supabase, auth.user.id);

    if (userId !== auth.user.id && !isAdmin) {
      return NextResponse.json({ error: "غير مصرح لك بقراءة بيانات هذا المستخدم." }, { status: 403 });
    }

    const supabase = createAnalyticsSupabase(auth.token);
    let targetProfile = auth.profile as DbRow;

    if (userId !== auth.user.id) {
      const { data, error } = await supabase.from("profiles").select("id, account_type").eq("id", userId).single();
      if (error || !data) {
        return NextResponse.json({ error: "لم يتم العثور على ملف المستخدم المطلوب." }, { status: 404 });
      }
      targetProfile = data as DbRow;
    }

    const userType = resolveProfileUserType(targetProfile.account_type, requestedUserType);
    const currentSessionId = await getOrCreateChatSession({ supabase, sessionId, userId, userType });
    const roleData = await fetchRoleData(supabase, userId, userType);
    const roleConfig = ROLE_CONFIG[userType];

    const { validOrders, summary } = analyzeOrders(roleData.primary);
    const salesTrend = analyzeTimeSeries(validOrders);
    const productAnalysis = analyzeProducts(roleData.secondary, validOrders);
    const generated = generateInsights({
      ordersSummary: summary,
      salesTrend,
      topProducts: productAnalysis.topProducts,
      weakProducts: productAnalysis.weakProducts,
      lowStockProducts: productAnalysis.lowStockProducts,
    });
    const [externalSignals, internalMarketSearch] = await Promise.all([
      getExternalSignals(message, productAnalysis.topProducts),
      fetchInternalMarketSearch(supabase, message, userType),
    ]);

    const analysisResult: AnalysisResult = {
      userId,
      userType,
      businessDomain: roleConfig.domain,
      generatedAt: new Date().toISOString(),
      summary,
      salesTrend,
      topProducts: productAnalysis.topProducts,
      weakProducts: productAnalysis.weakProducts,
      marketingIntelligence: {
        mostRequestedProducts: productAnalysis.topProducts,
        lowStockProducts: productAnalysis.lowStockProducts,
        customerBehavior: generated.customerBehavior,
        externalSignals,
        internalMarketSearch,
      },
      recommendations: generated.recommendations,
      previousInsights: roleData.aiInsights.slice(0, 10),
      dataQuality: {
        primaryRowsLoaded: roleData.primary.length,
        secondaryRowsLoaded: roleData.secondary.length,
        aiInsightsLoaded: roleData.aiInsights.length,
        primaryTable: roleData.primaryTable,
        secondaryTable: roleData.secondaryTable,
        warnings: [...roleData.warnings, ...externalSignals.warnings, ...internalMarketSearch.warnings],
      },
    };

    await saveMessage({
      supabase,
      table: "ai_chat_messages",
      payload: { session_id: currentSessionId, role: "user", message },
    });

    const chatHistory = await fetchChatHistory(supabase, currentSessionId);

    if (conversationId) {
      await saveMessage({
        supabase,
        table: "ai_messages",
        payload: { conversation_id: conversationId, role: "user", content: message },
      });
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `
أنت مستشار أعمال وتسويق ذكي لأصحاب المتاجر.
ممنوع أن تخترع أرقاما أو تحلل من جديد. التحليل الحسابي تم داخل السيرفر فقط.
استخدم نتيجة التحليل التالية كما هي لصياغة رد عربي احترافي ومخصص:

${JSON.stringify(analysisResult)}

نوع المستخدم: ${userType}
مجال التحليل: ${roleConfig.domain}
تركيز الرد: ${roleConfig.promptFocus}

قواعد الرد:
- أجب على سؤال المستخدم مباشرة.
- اذكر أرقاما محددة من analysisResult عندما تكون متاحة.
- قدم تحليل الأداء، اقتراحات عملية، أفكار تسويق، وتنبيهات.
- إذا كانت البيانات ناقصة، وضح ذلك باختصار واقترح ما يلزم لتصبح التوصيات أدق.
- إذا كان analysisResult.marketingIntelligence.internalMarketSearch.triggered يساوي true، أجب على أسئلة الموردين والمنتجات من matches فقط لأنها نتائج حقيقية من المنصة.
- عند ذكر أي نتيجة من internalMarketSearch.matches اذكر اسم المورد، اسم المنتج، السعر والعملة، أقل كمية طلب، المخزون، والمدينة أو الدولة عند توفرها.
- إذا كان internalMarketSearch.triggered يساوي true لكن matches فارغة، قل إن النظام لم يجد منتجات منشورة مطابقة واقترح تغيير كلمات البحث أو تصفح صفحة المنتجات.
- اكتب باللغة العربية فقط.
- لا تستخدم رموزا غريبة أو زخارف أو أحرفا غير عربية.
          `.trim(),
        },
        ...chatHistory,
      ],
      max_tokens: 1200,
      temperature: 0.4,
    });

    const rawReply = completion.choices[0]?.message?.content || "عذرا، لم أتمكن من توليد رد مناسب الآن.";
    const reply = postProcessGroqReply(rawReply);

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("ai_chat_messages")
      .insert({ session_id: currentSessionId, role: "assistant", message: reply })
      .select("id")
      .single();

    if (assistantMessageError) {
      throw new Error(assistantMessageError.message);
    }

    await touchChatSession(supabase, currentSessionId);

    if (conversationId) {
      await saveMessage({
        supabase,
        table: "ai_messages",
        payload: { conversation_id: conversationId, role: "assistant", content: reply },
      });
    }

    return NextResponse.json({
      reply,
      analysis: analysisResult,
      sessionId: currentSessionId,
      userType,
      messageId: assistantMessage?.id ?? null,
    });
  } catch (error) {
    console.error("Chatbot route error:", error);
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "يجب تسجيل الدخول لاستخدام الشات بوت." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "PROFILE_NOT_FOUND") {
      return NextResponse.json({ error: "لم يتم العثور على ملف المستخدم." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "CHAT_SESSION_FORBIDDEN") {
      return NextResponse.json({ error: "هذه المحادثة لا تتبع المستخدم الحالي." }, { status: 403 });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "حدث خطأ غير متوقع في الشات بوت." },
      { status: 500 }
    );
  }
}
