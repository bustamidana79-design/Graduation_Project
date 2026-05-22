"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

type PublicProfile = {
  id: string;
  full_name: string | null;
  country?: string | null;
  city?: string | null;
  account_type: AccountType;
  status?: string | null;
};

type SupplierProfile = {
  store_name: string | null;
  product_category: string | null;
  store_link: string | null;
};

type SmallBusinessProfile = {
  project_name: string | null;
  project_field: string | null;
  project_stage: string | null;
  social_link: string | null;
};

type DeliveryProfile = {
  company_name: string | null;
  delivery_scope: string | null;
  delivery_cities: string[] | null;
  avg_delivery_time: string | null;
};

type SupporterProfile = {
  support_type: string | null;
  funding_range: string | null;
  interests: string | null;
  previous_experience: string | null;
};

type SupplierProduct = {
  id: string;
  name: string;
  description: string | null;
  wholesale_price: number | null;
  min_order_quantity: number | null;
  product_images?: Array<{ image_url: string }>;
};

type ShowcaseItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  item_link: string | null;
};

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "تاجر / مورد",
  small_business: "صاحب مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم / مستثمر",
  admin: "إدارة",
};

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

export default function DashboardUserProfile({
  backHref,
  includeAllProfiles = false,
}: {
  backHref: string;
  includeAllProfiles?: boolean;
}) {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = params?.id;
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [supplierProfile, setSupplierProfile] = useState<SupplierProfile | null>(null);
  const [smallBusinessProfile, setSmallBusinessProfile] = useState<SmallBusinessProfile | null>(null);
  const [deliveryProfile, setDeliveryProfile] = useState<DeliveryProfile | null>(null);
  const [supporterProfile, setSupporterProfile] = useState<SupporterProfile | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportMessage, setSupportMessage] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [sendingSupport, setSendingSupport] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const loadProfile = async () => {
      setLoading(true);
      setSupplierProfile(null);
      setSmallBusinessProfile(null);
      setDeliveryProfile(null);
      setSupporterProfile(null);
      setProducts([]);
      setShowcaseItems([]);

      let profileQuery = supabase
        .from("profiles")
        .select("id, full_name, country, city, account_type, status")
        .eq("id", userId);

      if (!includeAllProfiles) {
        profileQuery = profileQuery.eq("status", "approved").neq("account_type", "admin");
      }

      const { data: profileData } = await profileQuery.maybeSingle();

      const nextProfile = (profileData as PublicProfile | null) || null;
      setProfile(nextProfile);

      if (!nextProfile) {
        setLoading(false);
        return;
      }

      if (nextProfile.account_type === "merchant") {
        const [{ data: detailsData }, { data: productsData }] = await Promise.all([
          supabase
            .from("supplier_profiles")
            .select("store_name, product_category, store_link")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("products")
            .select("id, name, description, wholesale_price, min_order_quantity, product_images(image_url)")
            .eq("supplier_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        setSupplierProfile((detailsData as SupplierProfile | null) || null);
        setProducts((productsData as SupplierProduct[] | null) || []);
      }

      if (nextProfile.account_type === "small_business") {
        const [{ data: detailsData }, { data: showcaseData }] = await Promise.all([
          supabase
            .from("small_business_profiles")
            .select("project_name, project_field, project_stage, social_link")
            .eq("user_id", userId)
            .maybeSingle(),
          supabase
            .from("small_business_showcase_items")
            .select("id, title, description, image_url, item_link")
            .eq("user_id", userId)
            .order("created_at", { ascending: false }),
        ]);

        setSmallBusinessProfile((detailsData as SmallBusinessProfile | null) || null);
        setShowcaseItems((showcaseData as ShowcaseItem[] | null) || []);
      }

      if (nextProfile.account_type === "delivery") {
        const { data: detailsData } = await supabase
          .from("shipping_company_profiles")
          .select("company_name, delivery_scope, delivery_cities, avg_delivery_time")
          .eq("user_id", userId)
          .maybeSingle();

        setDeliveryProfile((detailsData as DeliveryProfile | null) || null);
      }

      if (nextProfile.account_type === "supporter") {
        const { data: detailsData } = await supabase
          .from("supporter_profiles")
          .select("support_type, funding_range, interests, previous_experience")
          .eq("user_id", userId)
          .maybeSingle();

        setSupporterProfile((detailsData as SupporterProfile | null) || null);
      }

      setLoading(false);
    };

    loadProfile();
  }, [includeAllProfiles, userId]);

  const heading =
    supplierProfile?.store_name ||
    smallBusinessProfile?.project_name ||
    deliveryProfile?.company_name ||
    profile?.full_name ||
    "الملف الشخصي";

  const startChat = async (targetUserId: string) => {
    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/chat/conversation", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      },
      body: JSON.stringify({ targetUserId }),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "تعذر بدء المحادثة.");
    }

    router.push(`/chat/${result.conversationId}`);
  };

  const sendSupportMessage = async () => {
    if (!profile || !supportSubject.trim() || !supportMessage.trim() || sendingSupport) return;

    setSendingSupport(true);
    setSupportStatus("");

    try {
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/admin/support-tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          userId: profile.id,
          subject: supportSubject.trim(),
          message: supportMessage.trim(),
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر إرسال الرسالة عبر مركز الدعم.");
      }

      setSupportStatus("تم إرسال الرسالة وفتح تذكرة في مركز الدعم.");
      setSupportSubject("");
      setSupportMessage("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "تعذر إرسال الرسالة عبر مركز الدعم.";
      setSupportStatus(message);
    } finally {
      setSendingSupport(false);
    }
  };

  return (
    <section className="space-y-6" dir="rtl">
      <Link href={`${backHref}/users`} className="inline-block text-sm font-semibold text-[#273347]/60 hover:text-[#273347]">
        العودة إلى دليل المستخدمين
      </Link>

      {loading ? (
        <div className="py-16 text-center text-sm text-[#273347]/45">جاري تحميل الملف الشخصي...</div>
      ) : !profile ? (
        <div className="py-16 text-center text-sm text-[#273347]/45">المستخدم غير متاح أو غير منشور.</div>
      ) : (
        <div className="space-y-6">
          <section className="rounded-3xl bg-[#273347] px-8 py-8 text-white">
            <p className="text-sm text-white/60">{accountTypeLabels[profile.account_type]}</p>
            <h1 className="mt-2 text-3xl font-bold">{heading}</h1>
            <p className="mt-3 text-sm text-white/80">
              {[profile.city, profile.country].filter(Boolean).join(" - ") || "عضو معتمد داخل المنصة"}
            </p>
            {!includeAllProfiles && (
              <div className="mt-5">
              <button
                type="button"
                onClick={() => void startChat(profile.id).catch((error) => alert(error.message))}
                className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#273347] transition hover:bg-[#eaf1f7]"
              >
                راسل المستخدم
              </button>
              </div>
            )}
          </section>

          {includeAllProfiles && profile.account_type !== "admin" && (
            <section className={cardClass}>
              <h2 className="text-lg font-bold text-[#273347]">إرسال رسالة عبر مركز الدعم</h2>
              <p className="mt-1 text-sm text-[#273347]/60">
                الرسالة ستصل للمستخدم كتذكرة دعم رسمية، ويمكن متابعة الردود من مركز الدعم وخدمة العملاء.
              </p>

              {supportStatus && (
                <div className="mt-4 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-3 text-sm text-[#273347]">
                  {supportStatus}
                </div>
              )}

              <div className="mt-4 grid gap-3">
                <input
                  value={supportSubject}
                  onChange={(event) => setSupportSubject(event.target.value)}
                  className="rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
                  placeholder="عنوان الرسالة"
                />
                <textarea
                  value={supportMessage}
                  onChange={(event) => setSupportMessage(event.target.value)}
                  rows={4}
                  className="resize-none rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
                  placeholder="اكتب رسالة الإدارة للمستخدم..."
                />
                <button
                  type="button"
                  onClick={() => void sendSupportMessage()}
                  disabled={!supportSubject.trim() || !supportMessage.trim() || sendingSupport}
                  className="w-fit rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f293a] disabled:opacity-50"
                >
                  {sendingSupport ? "جاري الإرسال..." : "إرسال عبر مركز الدعم"}
                </button>
              </div>
            </section>
          )}

          <section className="grid gap-4 lg:grid-cols-2">
            <div className={cardClass}>
              <h2 className="text-lg font-bold text-[#273347]">معلومات عامة</h2>
              <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
                <p>الاسم: {profile.full_name || "غير متوفر"}</p>
                <p>نوع الحساب: {accountTypeLabels[profile.account_type]}</p>
                <p>الدولة: {profile.country || "غير متوفرة"}</p>
                <p>المدينة: {profile.city || "غير متوفرة"}</p>
                <p>التواصل: عبر المحادثات داخل المنصة</p>
              </div>
            </div>

            {profile.account_type === "merchant" && (
              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#273347]">معلومات المتجر</h2>
                <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
                  <p>اسم المتجر: {supplierProfile?.store_name || heading}</p>
                  <p>التصنيف: {supplierProfile?.product_category || "غير محدد"}</p>
                  <p>
                    الرابط:{" "}
                    {supplierProfile?.store_link ? (
                      <a
                        href={supplierProfile.store_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        فتح الرابط
                      </a>
                    ) : (
                      "غير متوفر"
                    )}
                  </p>
                </div>
              </div>
            )}

            {profile.account_type === "small_business" && (
              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#273347]">معلومات المشروع</h2>
                <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
                  <p>اسم المشروع: {smallBusinessProfile?.project_name || heading}</p>
                  <p>مجال المشروع: {smallBusinessProfile?.project_field || "غير محدد"}</p>
                  <p>مرحلة المشروع: {smallBusinessProfile?.project_stage || "غير محددة"}</p>
                  <p>
                    الرابط:{" "}
                    {smallBusinessProfile?.social_link ? (
                      <a
                        href={smallBusinessProfile.social_link}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-blue-600 hover:underline"
                      >
                        فتح الرابط
                      </a>
                    ) : (
                      "غير متوفر"
                    )}
                  </p>
                </div>
              </div>
            )}

            {profile.account_type === "delivery" && (
              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#273347]">الخدمة اللوجستية</h2>
                <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
                  <p>اسم الشركة: {deliveryProfile?.company_name || heading}</p>
                  <p>نطاق التوصيل: {deliveryProfile?.delivery_scope || "غير محدد"}</p>
                  <p>متوسط زمن التوصيل: {deliveryProfile?.avg_delivery_time || "غير متوفر"}</p>
                  <div className="pt-1">
                    <p className="mb-2">المدن المخدومة:</p>
                    <div className="flex flex-wrap gap-2">
                      {(deliveryProfile?.delivery_cities || []).length > 0 ? (
                        (deliveryProfile?.delivery_cities || []).map((city) => (
                          <span key={city} className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs">
                            {city}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-[#273347]/55">غير مضافة</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {profile.account_type === "supporter" && (
              <div className={cardClass}>
                <h2 className="text-lg font-bold text-[#273347]">الاهتمامات الاستثمارية</h2>
                <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
                  <p>نوع الدعم: {supporterProfile?.support_type || "غير محدد"}</p>
                  <p>نطاق التمويل: {supporterProfile?.funding_range || "غير متوفر"}</p>
                  <p>الاهتمامات: {supporterProfile?.interests || "غير مضافة"}</p>
                  <p>الخبرة السابقة: {supporterProfile?.previous_experience || "غير مضافة"}</p>
                </div>
              </div>
            )}
          </section>

          {profile.account_type === "merchant" && (
            <section className={cardClass}>
              <h2 className="text-lg font-bold text-[#273347]">المنتجات</h2>
              {products.length === 0 ? (
                <div className="mt-5 text-sm text-[#273347]/55">لا توجد منتجات منشورة بعد.</div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {products.map((product) => {
                    const imagePath = product.product_images?.[0]?.image_url;
                    const imageUrl = imagePath
                      ? supabase.storage.from("products").getPublicUrl(imagePath).data.publicUrl
                      : null;

                    return (
                      <article key={product.id} className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-[#fbfdff]">
                        <div
                          className="h-44 w-full bg-[#dfe8f2]"
                          style={
                            imageUrl
                              ? {
                                  backgroundImage: `url(${imageUrl})`,
                                  backgroundPosition: "center",
                                  backgroundSize: "cover",
                                }
                              : undefined
                          }
                        />
                        <div className="space-y-3 p-4">
                          <h3 className="font-bold text-[#273347]">{product.name}</h3>
                          <p className="line-clamp-3 text-sm text-[#273347]/65">
                            {product.description || "لا يوجد وصف لهذا المنتج."}
                          </p>
                          <div className="flex flex-wrap gap-2 text-xs text-[#273347]/70">
                            <span className="rounded-full bg-[#eef3f8] px-3 py-1">
                              سعر الجملة: {product.wholesale_price ?? 0}
                            </span>
                            <span className="rounded-full bg-[#eef3f8] px-3 py-1">
                              أقل طلب: {product.min_order_quantity ?? 1}
                            </span>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {profile.account_type === "small_business" && (
            <section className={cardClass}>
              <h2 className="text-lg font-bold text-[#273347]">معرض الأعمال</h2>
              {showcaseItems.length === 0 ? (
                <div className="mt-5 text-sm text-[#273347]/55">لا توجد عناصر منشورة بعد.</div>
              ) : (
                <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {showcaseItems.map((item) => (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-[#fbfdff]">
                      <div
                        className="h-44 w-full bg-[#dfe8f2]"
                        style={
                          item.image_url
                            ? {
                                backgroundImage: `url(${item.image_url})`,
                                backgroundPosition: "center",
                                backgroundSize: "cover",
                              }
                            : undefined
                        }
                      />
                      <div className="space-y-3 p-4">
                        <h3 className="font-bold text-[#273347]">{item.title}</h3>
                        <p className="line-clamp-3 text-sm text-[#273347]/65">
                          {item.description || "لا يوجد وصف لهذا العنصر."}
                        </p>
                        {item.item_link && (
                          <a
                            href={item.item_link}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sm font-medium text-blue-600 hover:underline"
                          >
                            فتح الرابط
                          </a>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </section>
  );
}
