"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import ProfileEditModal, { type EditableProfile } from "@/components/ProfileEditModal";

type ShippingCompanyDetails = {
  company_name: string | null;
  delivery_scope: string | null;
  delivery_cities: string[] | null;
  avg_delivery_time: string | null;
  license_no: string | null;
};

type BaseProfile = EditableProfile;

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

export default function ShippingCompanyProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "delivery" });
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [details, setDetails] = useState<ShippingCompanyDetails | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadProfileData = async () => {
      const [{ data: baseData }, { data: detailsData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, country, city, bio, avatar_url, status")
          .eq("id", profile.id)
          .maybeSingle(),
        supabase
          .from("shipping_company_profiles")
          .select("company_name, delivery_scope, delivery_cities, avg_delivery_time, license_no")
          .eq("user_id", profile.id)
          .maybeSingle(),
      ]);

      console.log("profile", baseData);
      setBaseProfile((baseData as BaseProfile | null) || null);
      setDetails((detailsData as ShippingCompanyDetails | null) || null);
    };

    loadProfileData();
  }, [profile?.id]);

  const fullName = baseProfile?.full_name || profile?.full_name || "شركة الشحن";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-8 text-white">
        <div className="mb-5 flex items-center justify-between gap-4">
          {baseProfile?.avatar_url ? (
            <img src={baseProfile.avatar_url} alt={fullName} className="h-16 w-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl font-bold">
              {fullName.trim().charAt(0)}
            </div>
          )}
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            className="rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-[#273347] transition hover:bg-[#eaf1f7]"
          >
            تعديل المعلومات
          </button>
        </div>
        <p className="text-sm text-white/60">الملف الشخصي</p>
        <h1 className="mt-2 text-3xl font-bold">{loading ? "..." : fullName}</h1>
        <p className="mt-2 text-sm text-white/70">
          {details?.company_name || "صفحة تعريفية بخدمات التوصيل ومجال تغطية الشركة."}
        </p>
      </section>

      {toast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {toast}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">المعلومات العامة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>الاسم: {fullName}</p>
            <p>الإيميل: {baseProfile?.email ?? "غير متوفر"}</p>
            <p>رقم الهاتف: {baseProfile?.phone ?? "غير متوفر"}</p>
            <p>الدولة: {baseProfile?.country ?? "غير متوفرة"}</p>
            <p>المدينة: {baseProfile?.city ?? "غير متوفرة"}</p>
            <p>النبذة: {baseProfile?.bio ?? "غير متوفرة"}</p>
            <p>الحالة: {baseProfile?.status || "approved"}</p>
          </div>
        </div>

        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">تفاصيل الخدمة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>اسم الشركة: {details?.company_name || fullName}</p>
            <p>نطاق التوصيل: {details?.delivery_scope || "غير محدد"}</p>
            <p>متوسط زمن التوصيل: {details?.avg_delivery_time || "غير متوفر"}</p>
            <p>رقم الرخصة: {details?.license_no || "غير متوفر"}</p>
            <div className="pt-1">
              <p className="mb-2">المدن المخدومة:</p>
              <div className="flex flex-wrap gap-2">
                {(details?.delivery_cities || []).length > 0 ? (
                  (details?.delivery_cities || []).map((city) => (
                    <span key={city} className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs">
                      {city}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-[#273347]/55">لم تتم إضافة المدن بعد.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <ProfileEditModal
        open={editOpen}
        profile={baseProfile}
        onClose={() => setEditOpen(false)}
        onUpdated={(nextProfile) => {
          setBaseProfile(nextProfile);
          setEditOpen(false);
          setToast("Profile updated successfully");
          window.setTimeout(() => setToast(""), 3000);
        }}
      />
    </div>
  );
}
