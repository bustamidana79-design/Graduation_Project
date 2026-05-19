type SupabaseClientLike = {
  from: (table: string) => any;
};

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

export type DailyTip = {
  id?: string;
  user_id: string;
  tip_date: string;
  account_type: AccountType;
  title: string;
  body: string;
  action_label: string;
  action_href: string;
  priority: "low" | "medium" | "high";
  source: Record<string, unknown>;
  created_at?: string;
};

type Profile = {
  id: string;
  full_name?: string | null;
  account_type?: AccountType | string | null;
  bio?: string | null;
  preferred_currency?: string | null;
  status?: string | null;
  city?: string | null;
  country?: string | null;
};

type TipCandidate = Omit<DailyTip, "user_id" | "tip_date" | "account_type"> & {
  score: number;
};

const roleLabels: Record<AccountType, string> = {
  merchant: "المورد",
  small_business: "صاحب المشروع",
  delivery: "شركة الشحن",
  supporter: "الداعم",
  admin: "الإدارة",
};

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeAccountType(value: unknown): AccountType {
  return value === "small_business" || value === "delivery" || value === "supporter" || value === "admin"
    ? value
    : "merchant";
}

async function safeCount(
  supabase: SupabaseClientLike,
  table: string,
  filters: Array<(query: any) => any>
) {
  try {
    let query = supabase.from(table).select("id", { count: "exact", head: true });
    for (const filter of filters) query = filter(query);
    const { count, error } = await query;
    if (error) return 0;
    return count || 0;
  } catch {
    return 0;
  }
}

async function countSmallBusinessCartItems(supabase: SupabaseClientLike, userId: string) {
  try {
    const { data: cart, error } = await supabase.from("carts").select("id").eq("user_id", userId).maybeSingle();
    if (error || !cart?.id) return 0;
    return safeCount(supabase, "cart_items", [(q) => q.eq("cart_id", cart.id)]);
  } catch {
    return 0;
  }
}

function pickBest(candidates: TipCandidate[]) {
  return [...candidates].sort((a, b) => b.score - a.score)[0];
}

function baseTip(profile: Profile, accountType: AccountType): TipCandidate {
  const name = profile.full_name?.trim();
  return {
    title: `نصيحة اليوم لـ ${name || roleLabels[accountType]}`,
    body: "راجع لوحة التحكم لدقيقتين اليوم: حدّث بياناتك، تابع آخر نشاط، واختر خطوة صغيرة واحدة تزيد ثقة المستخدمين بك.",
    action_label: "مراجعة الملف الشخصي",
    action_href: `/dashboard/${accountType === "merchant" ? "supplier" : accountType === "delivery" ? "shipping-company" : accountType}/profile`,
    priority: "low",
    source: { reason: "fallback" },
    score: 1,
  };
}

async function buildMerchantTip(supabase: SupabaseClientLike, profile: Profile): Promise<TipCandidate> {
  const [products, draftProducts, lowStockProducts, pendingOrders, unreadMessages] = await Promise.all([
    safeCount(supabase, "products", [(q) => q.eq("supplier_id", profile.id)]),
    safeCount(supabase, "products", [(q) => q.eq("supplier_id", profile.id).eq("is_published", false)]),
    safeCount(supabase, "products", [(q) => q.eq("supplier_id", profile.id).lte("stock_quantity", 5)]),
    safeCount(supabase, "orders", [(q) => q.eq("supplier_id", profile.id).in("status", ["pending", "confirmed"])]),
    safeCount(supabase, "direct_messages", [(q) => q.eq("receiver_id", profile.id).is("read_at", null)]),
  ]);

  const candidates: TipCandidate[] = [
    baseTip(profile, "merchant"),
    {
      title: "ابدأ بمنتجك الأول",
      body: "وجود منتج منشور مع صورة واضحة وسعر وكمية متاحة يجعل حسابك قابلا للطلب مباشرة. أضف منتجا واحدا مكتمل البيانات اليوم.",
      action_label: "إضافة منتج",
      action_href: "/dashboard/supplier/products",
      priority: "high",
      source: { products },
      score: products === 0 ? 100 : 0,
    },
    {
      title: "طلبات تنتظر ردك",
      body: `لديك ${pendingOrders} طلب قيد المتابعة. تحديث الحالة بسرعة يقلل تردد المشتري ويزيد احتمالية إتمام الطلب.`,
      action_label: "متابعة الطلبات",
      action_href: "/dashboard/supplier/orders",
      priority: "high",
      source: { pendingOrders },
      score: pendingOrders > 0 ? 90 + pendingOrders : 0,
    },
    {
      title: "انتبه للمخزون المنخفض",
      body: `يوجد ${lowStockProducts} منتج مخزونه منخفض. حدّث الكمية أو أوقف المنتج مؤقتا حتى لا تصلك طلبات لا تستطيع تلبيتها.`,
      action_label: "مراجعة المنتجات",
      action_href: "/dashboard/supplier/products",
      priority: "medium",
      source: { lowStockProducts },
      score: lowStockProducts > 0 ? 70 + lowStockProducts : 0,
    },
    {
      title: "منتجاتك بحاجة للنشر",
      body: `لديك ${draftProducts} منتج غير منشور. راجع البيانات والصور ثم انشر المنتجات الجاهزة حتى تظهر للمشاريع الصغيرة.`,
      action_label: "إكمال المنتجات",
      action_href: "/dashboard/supplier/products",
      priority: "medium",
      source: { draftProducts },
      score: draftProducts > 0 ? 60 + draftProducts : 0,
    },
    {
      title: "لا تترك المحادثات تبرد",
      body: `عندك ${unreadMessages} رسالة غير مقروءة. الرد السريع يعطي انطباعا أقوى من أي وصف طويل في الملف الشخصي.`,
      action_label: "فتح المحادثات",
      action_href: "/dashboard/supplier/messages",
      priority: "medium",
      source: { unreadMessages },
      score: unreadMessages > 0 ? 55 + unreadMessages : 0,
    },
  ];

  return pickBest(candidates);
}

async function buildSmallBusinessTip(supabase: SupabaseClientLike, profile: Profile): Promise<TipCandidate> {
  const [orders, cartItems, favorites, pendingInvestments, unreadMessages] = await Promise.all([
    safeCount(supabase, "orders", [(q) => q.eq("buyer_id", profile.id)]),
    countSmallBusinessCartItems(supabase, profile.id),
    safeCount(supabase, "favorites", [(q) => q.eq("user_id", profile.id)]),
    safeCount(supabase, "investments", [
      (q) => q.or(`small_business_id.eq.${profile.id},project_owner_id.eq.${profile.id}`).eq("status", "pending"),
    ]),
    safeCount(supabase, "direct_messages", [(q) => q.eq("receiver_id", profile.id).is("read_at", null)]),
  ]);

  const candidates: TipCandidate[] = [
    baseTip(profile, "small_business"),
    {
      title: "حوّل السلة إلى طلب",
      body: `في سلتك ${cartItems} عنصر. راجع الكميات وشركات الشحن اليوم قبل أن يتغير المخزون عند الموردين.`,
      action_label: "فتح السلة",
      action_href: "/dashboard/small-business/cart",
      priority: "high",
      source: { cartItems },
      score: cartItems > 0 ? 95 + cartItems : 0,
    },
    {
      title: "طلبات دعم تنتظر قرارك",
      body: `لديك ${pendingInvestments} طلب استثمار قيد المراجعة. الرد الواضح يحافظ على جدية الداعمين ويقوي فرص مشروعك.`,
      action_label: "مراجعة الاستثمارات",
      action_href: "/dashboard/small-business/investments",
      priority: "high",
      source: { pendingInvestments },
      score: pendingInvestments > 0 ? 90 + pendingInvestments : 0,
    },
    {
      title: "ابدأ أول طلب شراء",
      body: "حتى طلب صغير من مورد موثوق يساعدك تختبر الأسعار، التوصيل، وجودة المنتجات قبل بناء مخزون أكبر.",
      action_label: "استعراض المنتجات",
      action_href: "/dashboard/small-business/products",
      priority: "medium",
      source: { orders },
      score: orders === 0 ? 75 : 0,
    },
    {
      title: "راجع المنتجات المفضلة",
      body: `لديك ${favorites} منتج في المفضلة. قارن السعر والحد الأدنى للطلب، ثم انقل الأنسب للسلة.`,
      action_label: "فتح المفضلة",
      action_href: "/dashboard/small-business/favorites",
      priority: "medium",
      source: { favorites },
      score: favorites > 0 ? 60 + favorites : 0,
    },
    {
      title: "تابع رسائل الموردين",
      body: `عندك ${unreadMessages} رسالة غير مقروءة. سؤال سريع عن الكمية أو موعد التسليم قد يوفر عليك تأخير طلب كامل.`,
      action_label: "فتح المحادثات",
      action_href: "/dashboard/small-business/messages",
      priority: "medium",
      source: { unreadMessages },
      score: unreadMessages > 0 ? 55 + unreadMessages : 0,
    },
  ];

  return pickBest(candidates);
}

async function buildDeliveryTip(supabase: SupabaseClientLike, profile: Profile): Promise<TipCandidate> {
  const [activeDeliveries, delivered, unreadMessages] = await Promise.all([
    safeCount(supabase, "delivery_orders", [
      (q) => q.eq("shipping_company_id", profile.id).in("status", ["picked_up", "in_transit", "out_for_delivery"]),
    ]),
    safeCount(supabase, "delivery_orders", [(q) => q.eq("shipping_company_id", profile.id).eq("status", "delivered")]),
    safeCount(supabase, "direct_messages", [(q) => q.eq("receiver_id", profile.id).is("read_at", null)]),
  ]);

  const candidates: TipCandidate[] = [
    baseTip(profile, "delivery"),
    {
      title: "حدّث حالات التوصيل النشطة",
      body: `لديك ${activeDeliveries} طلب توصيل نشط. تحديث الحالة اليوم يقلل الاستفسارات ويزيد ثقة المشتري والمورد.`,
      action_label: "متابعة الطلبات",
      action_href: "/dashboard/shipping-company/orders",
      priority: "high",
      source: { activeDeliveries },
      score: activeDeliveries > 0 ? 95 + activeDeliveries : 0,
    },
    {
      title: "ابنِ سجل إنجاز واضح",
      body: delivered === 0
        ? "ابدأ بتحديث أول طلب حتى التسليم. سجل التسليم المكتمل هو أقوى دليل على جاهزية شركة الشحن."
        : `أنجزت ${delivered} عملية توصيل. حافظ على نفس الإيقاع بتوثيق كل تحديث في وقته.`,
      action_label: "عرض الطلبات",
      action_href: "/dashboard/shipping-company/orders",
      priority: "medium",
      source: { delivered },
      score: delivered === 0 ? 70 : 35,
    },
    {
      title: "رسائل العملاء جزء من الخدمة",
      body: `عندك ${unreadMessages} رسالة غير مقروءة. إجابة قصيرة عن الموعد أو المنطقة قد تمنع شكوى لاحقا.`,
      action_label: "فتح المحادثات",
      action_href: "/dashboard/shipping-company/messages",
      priority: "medium",
      source: { unreadMessages },
      score: unreadMessages > 0 ? 60 + unreadMessages : 0,
    },
  ];

  return pickBest(candidates);
}

async function buildSupporterTip(supabase: SupabaseClientLike, profile: Profile): Promise<TipCandidate> {
  const [investments, pendingInvestments, activeInvestments, unreadMessages] = await Promise.all([
    safeCount(supabase, "investments", [(q) => q.eq("supporter_id", profile.id)]),
    safeCount(supabase, "investments", [(q) => q.eq("supporter_id", profile.id).eq("status", "pending")]),
    safeCount(supabase, "investments", [(q) => q.eq("supporter_id", profile.id).eq("status", "active")]),
    safeCount(supabase, "direct_messages", [(q) => q.eq("receiver_id", profile.id).is("read_at", null)]),
  ]);

  const candidates: TipCandidate[] = [
    baseTip(profile, "supporter"),
    {
      title: "ابدأ بفرصة صغيرة وواضحة",
      body: "اختر مشروعا واحدا اليوم، راجع وصفه واحتياجه، وابدأ بمحادثة قبل اتخاذ قرار الدعم.",
      action_label: "استعراض المشاريع",
      action_href: "/dashboard/supporter/projects",
      priority: "medium",
      source: { investments },
      score: investments === 0 ? 85 : 0,
    },
    {
      title: "تابع طلباتك المعلّقة",
      body: `لديك ${pendingInvestments} طلب دعم بانتظار رد صاحب المشروع. رسالة متابعة مهذبة تساعدك تعرف جدية الفرصة.`,
      action_label: "متابعة الاستثمارات",
      action_href: "/dashboard/supporter/investments",
      priority: "high",
      source: { pendingInvestments },
      score: pendingInvestments > 0 ? 90 + pendingInvestments : 0,
    },
    {
      title: "راجع الاستثمارات النشطة",
      body: `عندك ${activeInvestments} استثمار نشط. خصص اليوم نقطة متابعة واحدة: تقدم المشروع، احتياج جديد، أو موعد مراجعة.`,
      action_label: "عرض الاستثمارات",
      action_href: "/dashboard/supporter/investments",
      priority: "medium",
      source: { activeInvestments },
      score: activeInvestments > 0 ? 65 + activeInvestments : 0,
    },
    {
      title: "لا تؤجل المحادثات",
      body: `عندك ${unreadMessages} رسالة غير مقروءة. الفرص الجيدة غالبا تحتاج توقيتا جيدا بقدر ما تحتاج رأس مال.`,
      action_label: "فتح المحادثات",
      action_href: "/dashboard/supporter/messages",
      priority: "medium",
      source: { unreadMessages },
      score: unreadMessages > 0 ? 55 + unreadMessages : 0,
    },
  ];

  return pickBest(candidates);
}

export async function generateDailyTip(supabase: SupabaseClientLike, profile: Profile, date = todayKey()): Promise<DailyTip> {
  const accountType = normalizeAccountType(profile.account_type);
  let candidate: TipCandidate;

  if (accountType === "small_business") {
    candidate = await buildSmallBusinessTip(supabase, profile);
  } else if (accountType === "delivery") {
    candidate = await buildDeliveryTip(supabase, profile);
  } else if (accountType === "supporter") {
    candidate = await buildSupporterTip(supabase, profile);
  } else {
    candidate = await buildMerchantTip(supabase, profile);
  }

  return {
    user_id: profile.id,
    tip_date: date,
    account_type: accountType,
    title: candidate.title,
    body: candidate.body,
    action_label: candidate.action_label,
    action_href: candidate.action_href,
    priority: candidate.priority,
    source: {
      ...candidate.source,
      score: candidate.score,
      generated_by: "daily-tip-rules-v1",
    },
  };
}

export async function getOrCreateDailyTip(supabase: SupabaseClientLike, profile: Profile): Promise<DailyTip> {
  const date = todayKey();

  try {
    const { data, error } = await supabase
      .from("daily_user_tips")
      .select("*")
      .eq("user_id", profile.id)
      .eq("tip_date", date)
      .maybeSingle();

    if (!error && data) return data as DailyTip;
  } catch {
    return generateDailyTip(supabase, profile, date);
  }

  const tip = await generateDailyTip(supabase, profile, date);

  try {
    const { data, error } = await supabase
      .from("daily_user_tips")
      .upsert(tip, { onConflict: "user_id,tip_date" })
      .select("*")
      .single();

    if (!error && data) return data as DailyTip;
  } catch {
    return tip;
  }

  return tip;
}
