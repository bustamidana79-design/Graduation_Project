"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

type PublicProfile = {
  id: string;
  full_name: string | null;
  country?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  account_type: AccountType;
  status?: string | null;
};

type SupplierProfile = {
  user_id: string;
  store_name: string | null;
  product_category: string | null;
};

type SmallBusinessProfile = {
  user_id: string;
  project_name: string | null;
  project_field: string | null;
};

type DeliveryProfile = {
  user_id: string;
  company_name: string | null;
  delivery_scope: string | null;
};

type SupporterProfile = {
  user_id: string;
  support_type: string | null;
  interests: string | null;
};

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "تاجر / مورد",
  small_business: "صاحب مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
  admin: "إدارة",
};

const recommendationPriority: Record<AccountType, AccountType[]> = {
  small_business: ["merchant", "supporter", "delivery"],
  merchant: ["small_business", "delivery", "supporter"],
  delivery: ["merchant", "small_business"],
  supporter: ["small_business", "merchant"],
  admin: ["small_business", "merchant", "delivery", "supporter"],
};

function getProfileTitle(
  profile: PublicProfile,
  suppliers: Record<string, SupplierProfile>,
  smallBusinesses: Record<string, SmallBusinessProfile>,
  deliveries: Record<string, DeliveryProfile>
) {
  return (
    suppliers[profile.id]?.store_name ||
    smallBusinesses[profile.id]?.project_name ||
    deliveries[profile.id]?.company_name ||
    profile.full_name ||
    "مستخدم"
  );
}

function getProfileSubtitle(
  profile: PublicProfile,
  suppliers: Record<string, SupplierProfile>,
  smallBusinesses: Record<string, SmallBusinessProfile>,
  deliveries: Record<string, DeliveryProfile>,
  supporters: Record<string, SupporterProfile>
) {
  return (
    suppliers[profile.id]?.product_category ||
    smallBusinesses[profile.id]?.project_field ||
    deliveries[profile.id]?.delivery_scope ||
    supporters[profile.id]?.support_type ||
    accountTypeLabels[profile.account_type]
  );
}

export default function DashboardUsersDirectory({ basePath }: { basePath: string }) {
  const [currentProfile, setCurrentProfile] = useState<PublicProfile | null>(null);
  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | AccountType>("all");
  const [supplierProfiles, setSupplierProfiles] = useState<Record<string, SupplierProfile>>({});
  const [smallBusinessProfiles, setSmallBusinessProfiles] = useState<Record<string, SmallBusinessProfile>>({});
  const [deliveryProfiles, setDeliveryProfiles] = useState<Record<string, DeliveryProfile>>({});
  const [supporterProfiles, setSupporterProfiles] = useState<Record<string, SupporterProfile>>({});

  useEffect(() => {
    const loadProfiles = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, country, city, avatar_url, bio, account_type, status")
        .eq("status", "approved")
        .neq("account_type", "admin")
        .order("full_name", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      const approvedProfiles = data as PublicProfile[];
      setCurrentProfile(approvedProfiles.find((item) => item.id === user?.id) || null);
      setProfiles(approvedProfiles.filter((item) => item.id !== user?.id));

      const merchantIds = approvedProfiles.filter((item) => item.account_type === "merchant").map((item) => item.id);
      const smallBusinessIds = approvedProfiles.filter((item) => item.account_type === "small_business").map((item) => item.id);
      const deliveryIds = approvedProfiles.filter((item) => item.account_type === "delivery").map((item) => item.id);
      const supporterIds = approvedProfiles.filter((item) => item.account_type === "supporter").map((item) => item.id);

      const [{ data: merchantsData }, { data: smallBusinessData }, { data: deliveryData }, { data: supportersData }] =
        await Promise.all([
          merchantIds.length > 0
            ? supabase.from("supplier_profiles").select("user_id, store_name, product_category").in("user_id", merchantIds)
            : Promise.resolve({ data: [] }),
          smallBusinessIds.length > 0
            ? supabase.from("small_business_profiles").select("user_id, project_name, project_field").in("user_id", smallBusinessIds)
            : Promise.resolve({ data: [] }),
          deliveryIds.length > 0
            ? supabase.from("shipping_company_profiles").select("user_id, company_name, delivery_scope").in("user_id", deliveryIds)
            : Promise.resolve({ data: [] }),
          supporterIds.length > 0
            ? supabase.from("supporter_profiles").select("user_id, support_type, interests").in("user_id", supporterIds)
            : Promise.resolve({ data: [] }),
        ]);

      setSupplierProfiles(Object.fromEntries(((merchantsData as SupplierProfile[] | null) || []).map((item) => [item.user_id, item])));
      setSmallBusinessProfiles(
        Object.fromEntries(((smallBusinessData as SmallBusinessProfile[] | null) || []).map((item) => [item.user_id, item]))
      );
      setDeliveryProfiles(Object.fromEntries(((deliveryData as DeliveryProfile[] | null) || []).map((item) => [item.user_id, item])));
      setSupporterProfiles(Object.fromEntries(((supportersData as SupporterProfile[] | null) || []).map((item) => [item.user_id, item])));

      setLoading(false);
    };

    void loadProfiles();
  }, []);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      if (filter !== "all" && profile.account_type !== filter) return false;
      if (!query) return true;

      const title = getProfileTitle(profile, supplierProfiles, smallBusinessProfiles, deliveryProfiles);
      const subtitle = getProfileSubtitle(profile, supplierProfiles, smallBusinessProfiles, deliveryProfiles, supporterProfiles);

      return [profile.full_name, profile.city, profile.country, profile.bio, title, subtitle]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [deliveryProfiles, filter, profiles, search, smallBusinessProfiles, supplierProfiles, supporterProfiles]);

  const recommendedProfiles = useMemo(() => {
    if (!currentProfile) return [];

    const priorities = recommendationPriority[currentProfile.account_type] || [];

    return profiles
      .map((profile) => {
        let score = 0;
        const priorityIndex = priorities.indexOf(profile.account_type);
        if (priorityIndex >= 0) score += 10 - priorityIndex;
        if (profile.city && currentProfile.city && profile.city === currentProfile.city) score += 4;
        if (profile.country && currentProfile.country && profile.country === currentProfile.country) score += 2;
        return { profile, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => item.profile);
  }, [currentProfile, profiles]);

  const renderProfileCard = (profile: PublicProfile, compact = false) => {
    const title = getProfileTitle(profile, supplierProfiles, smallBusinessProfiles, deliveryProfiles);
    const subtitle = getProfileSubtitle(profile, supplierProfiles, smallBusinessProfiles, deliveryProfiles, supporterProfiles);
    const location = [profile.city, profile.country].filter(Boolean).join(" - ") || "داخل المنصة";

    return (
      <Link
        key={profile.id}
        href={`${basePath}/users/${profile.id}`}
        className="group block overflow-hidden rounded-2xl border border-[#e6edf5] bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-[#bbd0e4] hover:shadow-md"
      >
        <div className="h-20 bg-[#273347]" />
        <div className="relative p-5">
          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={title}
              className="-mt-12 h-16 w-16 rounded-2xl border-4 border-white bg-[#eef3f8] object-cover"
            />
          ) : (
            <div className="-mt-12 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#bbd0e4] text-xl font-bold text-[#273347]">
              {title.trim().charAt(0)}
            </div>
          )}

          <div className="mt-4">
            <h2 className="line-clamp-1 text-lg font-bold text-[#273347]">{title}</h2>
            <p className="mt-1 text-sm text-[#273347]/55">{accountTypeLabels[profile.account_type]}</p>
          </div>

          {!compact && profile.bio && <p className="mt-3 line-clamp-2 text-sm leading-6 text-[#273347]/65">{profile.bio}</p>}

          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-[#273347]/75">{subtitle || "حساب موثق"}</span>
            <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-[#273347]/75">{location}</span>
          </div>

          <p className="mt-5 text-sm font-semibold text-[#273347] transition group-hover:text-[#546a85]">عرض الملف الشخصي</p>
        </div>
      </Link>
    );
  };

  return (
    <section className="space-y-8" dir="rtl">
      <div className="rounded-2xl bg-[#273347] px-6 py-8 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold sm:text-3xl">دليل المستخدمين والأعمال</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/80 sm:text-base">
          تصفح الأعضاء المعتمدين داخل المنصة، وتعرّف على التجار والمشاريع الصغيرة وشركات التوصيل والداعمين من مكان واحد.
        </p>
      </div>

      {recommendedProfiles.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#273347]">أشخاص قد يهمك</h2>
              <p className="mt-1 text-sm text-[#273347]/55">اقتراحات مبنية على نوع حسابك وموقعك داخل المنصة.</p>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-3">{recommendedProfiles.map((profile) => renderProfileCard(profile, true))}</div>
        </section>
      )}

      <div className="rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو المدينة أو المشروع..."
            className="rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | AccountType)}
            className="rounded-xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
          >
            <option value="all">كل الفئات</option>
            <option value="merchant">التجار</option>
            <option value="small_business">المشاريع الصغيرة</option>
            <option value="delivery">شركات التوصيل</option>
            <option value="supporter">الداعمون</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">جاري تحميل المستخدمين...</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">لا توجد نتائج مطابقة حالياً.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{filteredProfiles.map((profile) => renderProfileCard(profile))}</div>
      )}
    </section>
  );
}
