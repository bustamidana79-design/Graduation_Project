"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import ProfileEditModal, { type EditableProfile } from "@/components/ProfileEditModal";
import { AREAS_BY_CITY, ARAB_COUNTRY_NAMES, getCitiesByCountryName } from "@/lib/locations";

type ShippingCompanyDetails = {
  company_name: string | null;
  delivery_scope: string | null;
  delivery_cities: string[] | null;
  avg_delivery_time: string | null;
  license_no: string | null;
};

type ShippingRate = {
  id: string;
  city: string;
  area?: string | null;
  price: number;
};

const cardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

export default function ShippingCompanyProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "delivery" });
  const [baseProfile, setBaseProfile] = useState<EditableProfile | null>(null);
  const [details, setDetails] = useState<ShippingCompanyDetails | null>(null);
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [rateCity, setRateCity] = useState("");
  const [rateArea, setRateArea] = useState("");
  const [ratePrice, setRatePrice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [serviceEditOpen, setServiceEditOpen] = useState(false);
  const [serviceSaving, setServiceSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [serviceForm, setServiceForm] = useState({
    company_name: "",
    delivery_scope: "",
    delivery_cities: "",
    avg_delivery_time: "",
    license_no: "",
  });

  useEffect(() => {
    if (!profile?.id) return;

    const loadProfileData = async () => {
      const headers = await getAuthHeaders();
      const [{ data: baseData }, { data: detailsData }, ratesResponse] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, country, city, bio, avatar_url, status, social_links")
          .eq("id", profile.id)
          .maybeSingle(),
        supabase
          .from("shipping_company_profiles")
          .select("company_name, delivery_scope, delivery_cities, avg_delivery_time, license_no")
          .eq("user_id", profile.id)
          .maybeSingle(),
        fetch("/api/shipping/rates", { headers }),
      ]);

      const nextDetails = (detailsData as ShippingCompanyDetails | null) || null;
      const ratesResult = await ratesResponse.json();

      setBaseProfile((baseData as EditableProfile | null) || null);
      setDetails(nextDetails);
      setServiceForm({
        company_name: nextDetails?.company_name || "",
        delivery_scope: nextDetails?.delivery_scope || "",
        delivery_cities: (nextDetails?.delivery_cities || []).join(", "),
        avg_delivery_time: nextDetails?.avg_delivery_time || "",
        license_no: nextDetails?.license_no || "",
      });
      setRates((ratesResult.rates || []) as ShippingRate[]);
    };

    void loadProfileData();
  }, [profile?.id]);

  const fullName = baseProfile?.full_name || profile?.full_name || "شركة التوصيل";
  const cityOptions =
    (details?.delivery_cities || []).length > 0
      ? details?.delivery_cities || []
      : getCitiesByCountryName(baseProfile?.country || ARAB_COUNTRY_NAMES.PS);
  const areaOptions = AREAS_BY_CITY[rateCity] || [];

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3000);
  };

  const saveServiceDetails = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (serviceSaving) return;

    setServiceSaving(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/shipping/profile", {
      method: "PATCH",
      headers,
      body: JSON.stringify(serviceForm),
    });
    const result = await response.json();
    setServiceSaving(false);

    if (!response.ok) {
      showToast(result.error || "تعذر حفظ تفاصيل الخدمة");
      return;
    }

    setDetails(result.profile as ShippingCompanyDetails);
    setServiceEditOpen(false);
    showToast("تم التعديل بنجاح");
  };

  const addRate = async () => {
    if (!rateCity) {
      showToast("يرجى اختيار المدينة");
      return;
    }

    const price = Number(ratePrice);
    if (!Number.isFinite(price) || price < 0) {
      showToast("يرجى إدخال سعر شحن صحيح");
      return;
    }

    const headers = await getAuthHeaders();
    const response = await fetch("/api/shipping/rates", {
      method: "POST",
      headers,
      body: JSON.stringify({
        city: rateCity,
        area: rateArea || null,
        price,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      showToast(result.error || "تعذر إضافة سعر الشحن");
      return;
    }

    setRates((current) => [result.rate, ...current]);
    setRatePrice("");
    showToast("تمت إضافة سعر الشحن");
  };

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-2xl bg-[#273347] px-8 py-8 text-white">
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
            className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#273347] transition hover:bg-[#eaf1f7]"
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
            <p>البريد الإلكتروني: {baseProfile?.email ?? "غير متوفر"}</p>
            <p>رقم الهاتف: {baseProfile?.phone ?? "غير متوفر"}</p>
            <p>الدولة: {baseProfile?.country ?? "غير متوفرة"}</p>
            <p>المدينة: {baseProfile?.city ?? "غير متوفرة"}</p>
            <p>النبذة: {baseProfile?.bio ?? "غير متوفرة"}</p>
            <p>الحالة: {baseProfile?.status || "معتمد"}</p>
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-[#273347]">تفاصيل الخدمة</h2>
            <button
              type="button"
              onClick={() => setServiceEditOpen((current) => !current)}
              className="rounded-xl border border-[#d8e1ec] px-4 py-2 text-sm font-semibold text-[#273347] transition hover:bg-[#f6f8fb]"
            >
              {serviceEditOpen ? "إغلاق" : "تعديل"}
            </button>
          </div>

          {serviceEditOpen ? (
            <form onSubmit={saveServiceDetails} className="mt-4 grid gap-3 text-sm text-[#273347]">
              <label className="grid gap-2 font-semibold">
                اسم الشركة
                <input
                  value={serviceForm.company_name}
                  onChange={(event) => setServiceForm((current) => ({ ...current, company_name: event.target.value }))}
                  className="rounded-xl border border-[#d8e1ec] px-4 py-3 font-normal"
                />
              </label>
              <label className="grid gap-2 font-semibold">
                نطاق التوصيل
                <input
                  value={serviceForm.delivery_scope}
                  onChange={(event) => setServiceForm((current) => ({ ...current, delivery_scope: event.target.value }))}
                  placeholder="مثال: داخل فلسطين أو الضفة الغربية"
                  className="rounded-xl border border-[#d8e1ec] px-4 py-3 font-normal"
                />
              </label>
              <label className="grid gap-2 font-semibold">
                المدن المخدومة
                <input
                  value={serviceForm.delivery_cities}
                  onChange={(event) => setServiceForm((current) => ({ ...current, delivery_cities: event.target.value }))}
                  placeholder="رام الله، نابلس، الخليل"
                  className="rounded-xl border border-[#d8e1ec] px-4 py-3 font-normal"
                />
              </label>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="grid gap-2 font-semibold">
                  متوسط زمن التوصيل
                  <input
                    value={serviceForm.avg_delivery_time}
                    onChange={(event) => setServiceForm((current) => ({ ...current, avg_delivery_time: event.target.value }))}
                    placeholder="24 - 48 ساعة"
                    className="rounded-xl border border-[#d8e1ec] px-4 py-3 font-normal"
                  />
                </label>
                <label className="grid gap-2 font-semibold">
                  رقم الرخصة
                  <input
                    value={serviceForm.license_no}
                    onChange={(event) => setServiceForm((current) => ({ ...current, license_no: event.target.value }))}
                    className="rounded-xl border border-[#d8e1ec] px-4 py-3 font-normal"
                  />
                </label>
              </div>
              <button
                type="submit"
                disabled={serviceSaving}
                className="rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {serviceSaving ? "جاري الحفظ..." : "حفظ تفاصيل الخدمة"}
              </button>
            </form>
          ) : (
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
          )}
        </div>
      </section>

      <section className={cardClass}>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-[#273347]">أسعار الشحن حسب المناطق</h2>
          <p className="text-sm text-[#273347]/60">أضف سعراً لكل مدينة أو منطقة تغطيها الشركة.</p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_140px_auto]">
          <label className="grid gap-2 text-sm font-semibold text-[#273347]">
            المدينة
            <select
              value={rateCity}
              onChange={(event) => {
                setRateCity(event.target.value);
                setRateArea("");
              }}
              className="w-full rounded-xl border border-[#d8e1ec] bg-white px-4 py-3 text-sm"
            >
              <option value="">اختر المدينة</option>
              {cityOptions.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#273347]">
            المنطقة
            {areaOptions.length > 0 ? (
              <select
                value={rateArea}
                onChange={(event) => setRateArea(event.target.value)}
                disabled={!rateCity}
                className="w-full rounded-xl border border-[#d8e1ec] bg-white px-4 py-3 text-sm disabled:bg-[#eef3f8]"
              >
                <option value="">كل المدينة</option>
                {areaOptions.map((area) => (
                  <option key={area} value={area}>
                    {area}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={rateArea}
                onChange={(event) => setRateArea(event.target.value)}
                disabled={!rateCity}
                placeholder="اتركها فارغة لكل المدينة"
                className="w-full rounded-xl border border-[#d8e1ec] bg-white px-4 py-3 text-sm disabled:bg-[#eef3f8]"
              />
            )}
          </label>

          <label className="grid gap-2 text-sm font-semibold text-[#273347]">
            السعر
            <input
              type="number"
              min="0"
              step="0.01"
              value={ratePrice}
              onChange={(event) => setRatePrice(event.target.value)}
              className="w-full rounded-xl border border-[#d8e1ec] bg-white px-4 py-3 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={() => void addRate()}
            className="self-end rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white"
          >
            إضافة
          </button>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-[#e6edf5]">
          {rates.length === 0 ? (
            <div className="p-4 text-sm text-[#273347]/60">لا توجد أسعار شحن بعد.</div>
          ) : (
            <div className="divide-y divide-[#e6edf5]">
              {rates.map((rate) => (
                <div key={rate.id} className="grid grid-cols-3 gap-3 p-4 text-sm text-[#273347]">
                  <span>{rate.city}</span>
                  <span>{rate.area || "كل المدينة"}</span>
                  <span className="font-bold">{Number(rate.price || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <ProfileEditModal
        open={editOpen}
        profile={baseProfile}
        onClose={() => setEditOpen(false)}
        onUpdated={(nextProfile) => {
          setBaseProfile(nextProfile);
          setEditOpen(false);
          showToast("تم التعديل بنجاح");
        }}
      />
    </div>
  );
}
