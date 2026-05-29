"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import ProfileEditModal, { type EditableProfile } from "@/components/ProfileEditModal";
import { PRODUCT_IMAGES_BUCKET } from "@/lib/storage";

type SmallBusinessDetails = {
  user_id?: string | null;
  project_name: string | null;
  project_field: string | null;
  project_stage: string | null;
  needs: string[] | null;
  social_link: string | null;
  [key: string]: unknown;
};

type BaseProfile = EditableProfile & {
  id?: string | null;
};

type FullProfile = BaseProfile & Partial<SmallBusinessDetails>;

type ShowcaseItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  item_link: string | null;
};

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

const needOptions = [
  { value: "suppliers", label: "موردين" },
  { value: "marketing", label: "تسويق" },
  { value: "funding", label: "تمويل" },
  { value: "partnerships", label: "شراكات" },
];

export default function SmallBusinessProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "small_business" });
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [showcaseItems, setShowcaseItems] = useState<ShowcaseItem[]>([]);
  const [schemaHint, setSchemaHint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedNeed, setSelectedNeed] = useState("");
  const [toast, setToast] = useState("");
  const [showcaseFile, setShowcaseFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    item_link: "",
  });

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  useEffect(() => {
    if (!profile?.id) return;

    const loadProfileData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const userId = user?.id;
      if (!userId) return;

      const [{ data: baseData }, { data: detailsData }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
        supabase.from("small_business_profiles").select("*").eq("user_id", userId).maybeSingle(),
      ]);

      const mergedProfile = {
        ...((baseData as BaseProfile | null) || {}),
        ...((detailsData as SmallBusinessDetails | null) || {}),
      } as FullProfile;

      setBaseProfile((baseData as BaseProfile | null) || null);
      setFullProfile(mergedProfile);
      setSelectedNeed(((mergedProfile.needs || []) as string[])[0] || "");

      const { data: itemsData, error: itemsError } = await supabase
        .from("small_business_showcase_items")
        .select("id, title, description, image_url, item_link")
        .eq("user_id", userId)
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

    void loadProfileData();
  }, [profile?.id]);

  const uploadShowcaseImage = async () => {
    if (!profile?.id || !showcaseFile) return null;

    const extension = showcaseFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `showcase/${profile.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, showcaseFile, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) throw uploadError;
    return supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl;
  };

  const handleAddItem = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id || !form.title.trim() || saving) return;

    setSaving(true);
    setError(null);

    try {
      const imageUrl = await uploadShowcaseImage();
      const { data, error: insertError } = await supabase
        .from("small_business_showcase_items")
        .insert({
          user_id: profile.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          image_url: imageUrl,
          item_link: form.item_link.trim() || null,
        })
        .select("id, title, description, image_url, item_link")
        .single();

      if (insertError) throw insertError;

      setShowcaseItems((current) => [data as ShowcaseItem, ...current]);
      setForm({ title: "", description: "", item_link: "" });
      setShowcaseFile(null);
      setShowAddForm(false);
      showToast("تمت إضافة العمل بنجاح");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إضافة العمل إلى المعرض.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const { error: deleteError } = await supabase.from("small_business_showcase_items").delete().eq("id", itemId);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setShowcaseItems((current) => current.filter((item) => item.id !== itemId));
  };

  const handleSaveNeeds = async () => {
    if (!selectedNeed) {
      setError("يرجى اختيار الاحتياج الحالي.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const response = await fetch("/api/small-business/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${data.session?.access_token || ""}`,
      },
      body: JSON.stringify({ needs: [selectedNeed] }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "تعذر تحديث الاحتياجات الحالية.");
      return;
    }

    setFullProfile((current) => ({ ...(current || {}), needs: result.profile?.needs || [selectedNeed] } as FullProfile));
    showToast("تم التعديل بنجاح");
  };

  const fullName = fullProfile?.full_name || profile?.full_name || "صاحب المشروع";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-2xl bg-[#273347] px-8 py-8 text-white">
        <div className="mb-5 flex items-center justify-between gap-4">
          {fullProfile?.avatar_url ? (
            <img src={fullProfile.avatar_url} alt={fullName} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
              {fullName.trim().charAt(0)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#273347] transition hover:bg-[#eaf1f7]"
          >
            تعديل المعلومات
          </button>
        </div>
        <p className="text-sm text-white/60">الملف الشخصي</p>
        <h1 className="mt-2 text-3xl font-bold">{loading ? "..." : fullName}</h1>
        <p className="mt-2 text-sm text-white/70">
          {fullProfile?.project_name || "صفحة تعريفية بمشروعك ومعرض أعمالك داخل المنصة."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/85">
          <span className="rounded-full bg-white/10 px-4 py-2">نوع الحساب: مشروع صغير</span>
          <span className="rounded-full bg-white/10 px-4 py-2">الحالة: {fullProfile?.status || "معتمد"}</span>
          <span className="rounded-full bg-white/10 px-4 py-2">عدد عناصر المعرض: {showcaseItems.length}</span>
        </div>
      </section>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {toast && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{toast}</div>}

      {schemaHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          جدول معرض الأعمال غير موجود بعد. نفّذ ملف `supabase/small-business-showcase.sql` أولاً.
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">المعلومات العامة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>الاسم: {fullName}</p>
            <p>البريد الإلكتروني: {fullProfile?.email ?? "غير متوفر"}</p>
            <p>رقم الهاتف: {fullProfile?.phone ?? "غير متوفر"}</p>
            <p>الدولة: {fullProfile?.country ?? "غير متوفرة"}</p>
            <p>المدينة: {fullProfile?.city ?? "غير متوفرة"}</p>
            <p>النبذة: {fullProfile?.bio ?? "غير متوفرة"}</p>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">معلومات المشروع</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>اسم المشروع: {fullProfile?.project_name || fullName}</p>
            <p>مجال المشروع: {fullProfile?.project_field ?? "غير محدد"}</p>
            <p>مرحلة المشروع: {fullProfile?.project_stage ?? "غير محددة"}</p>
            <div className="pt-1">
              <p className="mb-2">الاحتياجات الحالية:</p>
              <div className="mb-3 flex flex-wrap gap-2">
                {(fullProfile?.needs || []).length > 0 ? (
                  (fullProfile?.needs || []).map((need) => (
                    <span key={need} className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs">
                      {needOptions.find((item) => item.value === need)?.label || need}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#273347]/55">لا توجد احتياجات مضافة بعد.</span>
                )}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  value={selectedNeed}
                  onChange={(event) => setSelectedNeed(event.target.value)}
                  className="flex-1 rounded-lg border border-[#d9e3ee] px-3 py-2 text-sm"
                >
                  <option value="">اختر الاحتياج الحالي</option>
                  {needOptions.map((need) => (
                    <option key={need.value} value={need.value}>
                      {need.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void handleSaveNeeds()}
                  className="rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white"
                >
                  حفظ الاحتياج
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {!schemaHint && (
        <section className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">معرض الأعمال</h2>
          <p className="mt-1 text-sm text-[#273347]/60">أضف أعمالك أو منتجاتك ليظهر المشروع بشكل احترافي للزوار.</p>

          <button
            type="button"
            onClick={() => setShowAddForm((current) => !current)}
            className="mt-4 rounded-lg bg-[#273347] px-4 py-2 text-sm font-semibold text-white"
          >
            {showAddForm ? "إغلاق النموذج" : "إضافة جديد"}
          </button>

          {showAddForm && (
            <form onSubmit={handleAddItem} className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="اسم العمل أو المنتج"
                className="rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
              />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => setShowcaseFile(event.target.files?.[0] || null)}
                className="rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
              />
              <textarea
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="وصف مختصر"
                rows={4}
                className="min-h-[120px] rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347] md:col-span-2"
              />
              <input
                value={form.item_link}
                onChange={(event) => setForm((current) => ({ ...current, item_link: event.target.value }))}
                placeholder="رابط خارجي اختياري"
                className="rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347] md:col-span-2"
              />
              <button
                type="submit"
                disabled={!form.title.trim() || saving}
                className="rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e2735] disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2 md:w-fit"
              >
                {saving ? "جاري الإضافة..." : "إضافة إلى المعرض"}
              </button>
            </form>
          )}
        </section>
      )}

      <section className={cardClass}>
        <h2 className="text-lg font-bold text-[#273347]">الأعمال المضافة</h2>

        {showcaseItems.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-8 text-center text-sm text-[#273347]/55">
            لا توجد عناصر بعد. أضف أول عمل ليظهر في ملفك الشخصي.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {showcaseItems.map((item) => (
              <article key={item.id} className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-[#fbfdff]">
                <div className="flex h-44 w-full items-center justify-center bg-[#eef3f8]">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-sm text-[#273347]/45">بدون صورة</span>
                  )}
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="font-bold text-[#273347]">{item.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm text-[#273347]/65">
                      {item.description || "لا يوجد وصف لهذا العنصر حتى الآن."}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    {item.item_link ? (
                      <a href={item.item_link} target="_blank" rel="noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                        فتح الرابط
                      </a>
                    ) : (
                      <span className="text-xs text-[#273347]/45">بدون رابط</span>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleDeleteItem(item.id)}
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

      <ProfileEditModal
        open={editOpen}
        profile={fullProfile || baseProfile}
        onClose={() => setEditOpen(false)}
        onUpdated={(nextProfile: EditableProfile) => {
          const nextFullProfile = { ...fullProfile, ...nextProfile } as FullProfile;
          setBaseProfile(nextProfile as BaseProfile);
          setFullProfile(nextFullProfile);
          setEditOpen(false);
          showToast("تم التعديل بنجاح");
        }}
      />
    </div>
  );
}
