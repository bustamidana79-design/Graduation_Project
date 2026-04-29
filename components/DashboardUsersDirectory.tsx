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
  delivery: "شركة شحن",
  supporter: "داعم / مستثمر",
  admin: "إدارة",
};

export default function DashboardUsersDirectory({ basePath }: { basePath: string }) {
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

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, country, city, account_type, status")
        .eq("status", "approved")
        .neq("account_type", "admin")
        .order("full_name", { ascending: true });

      if (error || !data) {
        setLoading(false);
        return;
      }

      const approvedProfiles = data as PublicProfile[];
      setProfiles(approvedProfiles);

      const merchantIds = approvedProfiles.filter((item) => item.account_type === "merchant").map((item) => item.id);
      const smallBusinessIds = approvedProfiles
        .filter((item) => item.account_type === "small_business")
        .map((item) => item.id);
      const deliveryIds = approvedProfiles.filter((item) => item.account_type === "delivery").map((item) => item.id);
      const supporterIds = approvedProfiles.filter((item) => item.account_type === "supporter").map((item) => item.id);

      const [
        { data: merchantsData },
        { data: smallBusinessData },
        { data: deliveryData },
        { data: supportersData },
      ] = await Promise.all([
        merchantIds.length > 0
          ? supabase
              .from("supplier_profiles")
              .select("user_id, store_name, product_category")
              .in("user_id", merchantIds)
          : Promise.resolve({ data: [] }),
        smallBusinessIds.length > 0
          ? supabase
              .from("small_business_profiles")
              .select("user_id, project_name, project_field")
              .in("user_id", smallBusinessIds)
          : Promise.resolve({ data: [] }),
        deliveryIds.length > 0
          ? supabase
              .from("shipping_company_profiles")
              .select("user_id, company_name, delivery_scope")
              .in("user_id", deliveryIds)
          : Promise.resolve({ data: [] }),
        supporterIds.length > 0
          ? supabase
              .from("supporter_profiles")
              .select("user_id, support_type, interests")
              .in("user_id", supporterIds)
          : Promise.resolve({ data: [] }),
      ]);

      setSupplierProfiles(
        Object.fromEntries(((merchantsData as SupplierProfile[] | null) || []).map((item) => [item.user_id, item]))
      );
      setSmallBusinessProfiles(
        Object.fromEntries(
          ((smallBusinessData as SmallBusinessProfile[] | null) || []).map((item) => [item.user_id, item])
        )
      );
      setDeliveryProfiles(
        Object.fromEntries(((deliveryData as DeliveryProfile[] | null) || []).map((item) => [item.user_id, item]))
      );
      setSupporterProfiles(
        Object.fromEntries(((supportersData as SupporterProfile[] | null) || []).map((item) => [item.user_id, item]))
      );

      setLoading(false);
    };

    loadProfiles();
  }, []);

  const filteredProfiles = useMemo(() => {
    const query = search.trim().toLowerCase();

    return profiles.filter((profile) => {
      if (filter !== "all" && profile.account_type !== filter) return false;

      if (!query) return true;

      const roleMeta =
        supplierProfiles[profile.id]?.store_name ||
        smallBusinessProfiles[profile.id]?.project_name ||
        deliveryProfiles[profile.id]?.company_name ||
        supporterProfiles[profile.id]?.interests ||
        "";

      return [profile.full_name, profile.city, profile.country, roleMeta]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [deliveryProfiles, filter, profiles, search, smallBusinessProfiles, supplierProfiles, supporterProfiles]);

  return (
    <section className="space-y-8" dir="rtl">
      <div className="rounded-3xl bg-gradient-to-l from-[#273347] to-[#546a85] px-6 py-8 text-white shadow-sm">
        <h1 className="text-2xl font-extrabold sm:text-3xl">دليل المستخدمين والأعمال</h1>
        <p className="mt-3 max-w-3xl text-sm text-white/80 sm:text-base">
          تصفح الأعضاء المعتمدين داخل المنصة، وتعرّف على المتاجر والمشاريع الصغيرة وشركات الشحن والداعمين من
          مكان واحد.
        </p>
      </div>

      <div className="rounded-3xl border border-[#e6edf5] bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم أو المدينة أو المشروع..."
            className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as "all" | AccountType)}
            className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
          >
            <option value="all">كل الفئات</option>
            <option value="merchant">التجار</option>
            <option value="small_business">المشاريع الصغيرة</option>
            <option value="delivery">شركات الشحن</option>
            <option value="supporter">الداعمون</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">جاري تحميل المستخدمين...</div>
      ) : filteredProfiles.length === 0 ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">لا توجد نتائج مطابقة حاليًا.</div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredProfiles.map((profile) => {
            const supplierMeta = supplierProfiles[profile.id];
            const smallBusinessMeta = smallBusinessProfiles[profile.id];
            const deliveryMeta = deliveryProfiles[profile.id];
            const supporterMeta = supporterProfiles[profile.id];

            const title =
              supplierMeta?.store_name ||
              smallBusinessMeta?.project_name ||
              deliveryMeta?.company_name ||
              profile.full_name ||
              "مستخدم";

            const subtitle =
              supplierMeta?.product_category ||
              smallBusinessMeta?.project_field ||
              deliveryMeta?.delivery_scope ||
              supporterMeta?.support_type ||
              accountTypeLabels[profile.account_type];

            const metaText = [profile.city, profile.country].filter(Boolean).join(" - ") || "داخل المنصة";

            return (
              <Link
                key={profile.id}
                href={`${basePath}/users/${profile.id}`}
                className="group overflow-hidden rounded-3xl border border-[#e6edf5] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="h-28 bg-[linear-gradient(135deg,#273347,#546a85)]" />
                <div className="relative p-5">
                  <div className="-mt-12 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-white bg-[#bbd0e4] text-xl font-bold text-[#273347]">
                    {(profile.full_name || title).trim().charAt(0)}
                  </div>

                  <div className="mt-4">
                    <h2 className="text-lg font-bold text-[#273347] transition group-hover:text-[#1c2433]">
                      {title}
                    </h2>
                    <p className="mt-1 text-sm text-[#273347]/55">{accountTypeLabels[profile.account_type]}</p>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-[#273347]/75">
                      {subtitle || "حساب موثق"}
                    </span>
                    <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-[#273347]/75">{metaText}</span>
                  </div>

                  <p className="mt-5 text-sm font-semibold text-[#273347]">عرض الملف الشخصي</p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
