"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type ShippingCompanyDetails = {
  company_name: string | null;
  delivery_scope: string | null;
  delivery_cities: string[] | null;
  avg_delivery_time: string | null;
  license_no: string | null;
};

type BaseProfile = {
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  status?: string | null;
};

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

export default function ShippingCompanyProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "delivery" });
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [details, setDetails] = useState<ShippingCompanyDetails | null>(null);

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
          .from("shipping_company_profiles")
          .select("company_name, delivery_scope, delivery_cities, avg_delivery_time, license_no")
          .eq("user_id", profile.id)
          .maybeSingle(),
      ]);

      setBaseProfile((baseData as BaseProfile | null) || null);
      setDetails((detailsData as ShippingCompanyDetails | null) || null);
    };

    loadProfileData();
  }, [profile?.id]);

  const fullName = baseProfile?.full_name || profile?.full_name || "شركة الشحن";

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-8 text-white">
        <p className="text-sm text-white/60">الملف الشخصي</p>
        <h1 className="mt-2 text-3xl font-bold">{loading ? "..." : fullName}</h1>
        <p className="mt-2 text-sm text-white/70">
          {details?.company_name || "صفحة تعريفية بخدمات التوصيل ومجال تغطية الشركة."}
        </p>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={cardClass}>
          <h2 className="text-lg font-bold text-[#273347]">المعلومات العامة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>الاسم: {fullName}</p>
            <p>الإيميل: {baseProfile?.email || "غير متوفر"}</p>
            <p>رقم الهاتف: {baseProfile?.phone || "غير متوفر"}</p>
            <p>الدولة: {baseProfile?.country || "غير متوفرة"}</p>
            <p>المدينة: {baseProfile?.city || "غير متوفرة"}</p>
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
    </div>
  );
}
