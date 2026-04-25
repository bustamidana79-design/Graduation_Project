"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type SmallBusinessDetails = {
  project_name: string | null;
  project_field: string | null;
  project_stage: string | null;
  needs: string[] | null;
  social_link: string | null;
};

type BaseProfile = {
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  status?: string | null;
};

type ShowcaseItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  item_link: string | null;
};

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

export default function SmallBusinessProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [details, setDetails] = useState<SmallBusinessDetails | null>(null);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [schemaHint, setSchemaHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    image_url: "",
    item_link: "",
  });

  useEffect(() => {
    if (!profile?.id) return;

    const loadProfileData = async () => {
      const [{ data: baseData }, { data: detailsData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, country, city, status")
          .eq("id", profile.id)
          .maybeSingle(),
        supabase
          .from("small_business_profiles")
          .select("project_name, project_field, project_stage, needs, social_link")
          .eq("user_id", profile.id)
          .maybeSingle(),
      ]);

      setBaseProfile((baseData as BaseProfile | null) || null);
      setDetails((detailsData as SmallBusinessDetails | null) || null);

      const { data: itemsData, error: itemsError } = await supabase
        .from("small_business_showcase_items")
        .select("id, title, description, image_url, item_link")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false });

      if (itemsError) {
        const normalized = itemsError.message.toLowerCase();
        if (normalized.includes("small_business_showcase_items") || normalized.includes("relation")) {
          setSchemaHint(true);
        } else {
          setError(itemsError.message);
        }
        return;
      }

      setShowcaseItems((itemsData as ShowcaseItem[] | null) || []);
    };

    loadProfileData();
  }, [profile?.id]);

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id || !form.title.trim() || saving) return;

    setSaving(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("small_business_showcase_items")
      .insert({
        user_id: profile.id,
        title: form.title.trim(),
        description: form.description.trim() || null,
        image_url: form.image_url.trim() || null,
        item_link: form.item_link.trim() || null,
      })
      .select("id, title, description, image_url, item_link")
      .single();

    setSaving(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setShowcaseItems((current) => [data as ShowcaseItem, ...current]);
    setForm({ title: "", description: "", image_url: "", item_link: "" });
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error: deleteError } = await supabase
      .from("small_business_showcase_items")
      .delete()
      .eq("id", itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setShowcaseItems((current) => current.filter((item) => item.id !== itemId));
  };

  const fullName = baseProfile?.full_name || profile?.full_name || "صاحب المشروع";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-8 text-white">
        <p className="text-sm text-white/60">الملف الشخصي</p>
        <h1 className="mt-2 text-3xl font-bold">{loading ? "..." : fullName}</h1>
        <p className="mt-2 text-sm text-white/70">
          {details?.project_name || "صفحة تعريفية بمشروعك ومعرض أعمالك داخل المنصة."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/85">
          <span className="rounded-full bg-white/10 px-4 py-2">نوع الحساب: مشروع صغير</span>
          <span className="rounded-full bg-white/10 px-4 py-2">
            الحالة: {baseProfile?.status || "approved"}
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2">
            عدد عناصر المعرض: {showcaseItems.length}
          </span>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {schemaHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          جدول معرض الأعمال غير موجود بعد. نفّذ الملف
          {" "}
          <span className="font-semibold">supabase/small-business-showcase.sql</span>
          {" "}
          أولًا.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">المعلومات العامة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>الاسم: {fullName}</p>
            <p>الإيميل: {baseProfile?.email || "غير متوفر"}</p>
            <p>رقم الهاتف: {baseProfile?.phone || "غير متوفر"}</p>
            <p>الدولة: {baseProfile?.country || "غير متوفرة"}</p>
            <p>المدينة: {baseProfile?.city || "غير متوفرة"}</p>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">معلومات المشروع</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>اسم المشروع: {details?.project_name || fullName}</p>
            <p>مجال المشروع: {details?.project_field || "غير محدد"}</p>
            <p>مرحلة المشروع: {details?.project_stage || "غير محددة"}</p>
            <p>
              الرابط:
              {" "}
              {details?.social_link ? (
                <a
                  href={details.social_link}
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
            <div className="pt-1">
              <p className="mb-2">الاحتياجات الحالية:</p>
              <div className="flex flex-wrap gap-2">
                {(details?.needs || []).length > 0 ? (
                  (details?.needs || []).map((need) => (
                    <span key={need} className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs">
                      {need}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#273347]/55">لا توجد احتياجات مضافة بعد.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {!schemaHint && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">أضف عملاً أو منتجًا إلى المعرض</h2>
          <p className="mt-1 text-sm text-[#273347]/60">
            هذه العناصر ستفيد لاحقًا في صفحة المستخدمين العامة لعرض شغلك داخل المنصة.
          </p>

          <form onSubmit={handleAddItem} className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={form.title}
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
              placeholder="اسم العمل أو المنتج"
              className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
            />
            <input
              value={form.image_url}
              onChange={(event) => setForm((current) => ({ ...current, image_url: event.target.value }))}
              placeholder="رابط الصورة"
              className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
            />
            <textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="وصف مختصر"
              rows={4}
              className="min-h-[120px] rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347] md:col-span-2"
            />
            <input
              value={form.item_link}
              onChange={(event) => setForm((current) => ({ ...current, item_link: event.target.value }))}
              placeholder="رابط خارجي للعمل أو المنتج"
              className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347] md:col-span-2"
            />
            <button
              type="submit"
              disabled={!form.title.trim() || saving}
              className="rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e2735] disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
            >
              {saving ? "جاري الإضافة..." : "إضافة إلى المعرض"}
            </button>
          </form>
        </section>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-bold text-[#273347]">معرض الأعمال</h2>

        {showcaseItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-8 text-center text-sm text-[#273347]/55">
            لا توجد عناصر بعد. أضف أول عمل ليظهر في ملفك الشخصي.
          </div>
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
                  <div>
                    <h3 className="font-bold text-[#273347]">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-[#273347]/65">
                      {item.description || "لا يوجد وصف لهذا العنصر حتى الآن."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {item.item_link ? (
                      <a
                        href={item.item_link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        فتح الرابط
                      </a>
                    ) : (
                      <span className="text-xs text-[#273347]/45">بدون رابط</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item.id)}
                      className="rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
