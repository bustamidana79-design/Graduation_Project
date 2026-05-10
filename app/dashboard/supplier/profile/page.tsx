"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";
import ProfileEditModal, { type EditableProfile } from "@/components/ProfileEditModal";

type SupplierProfileDetails = {
  store_name: string | null;
  product_category: string | null;
  store_link: string | null;
  commercial_reg_no: string | null;
};

type BaseProfile = {
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  status?: string | null;
};

type SupplierProduct = {
  id: string;
  name: string;
  description: string | null;
  wholesale_price: number | null;
  min_order_quantity: number | null;
  stock_quantity: number | null;
  product_images?: Array<{ image_url: string }>;
};

const infoCardClass = "rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm";

export default function SupplierProfilePage() {
  const { profile, loading } = useDashboardAccess({ requiredAccountType: "merchant" });
  const [baseProfile, setBaseProfile] = useState<BaseProfile | null>(null);
  const [supplierDetails, setSupplierDetails] = useState<SupplierProfileDetails | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    const loadProfileData = async () => {
      const [{ data: baseData }, { data: detailsData }, { data: productsData }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, phone, country, city, bio, avatar_url, status")
          .eq("id", profile.id)
          .maybeSingle(),
        supabase
          .from("supplier_profiles")
          .select("store_name, product_category, store_link, commercial_reg_no")
          .eq("user_id", profile.id)
          .maybeSingle(),
        supabase
          .from("products")
          .select("id, name, description, wholesale_price, min_order_quantity, stock_quantity, product_images(image_url)")
          .eq("supplier_id", profile.id)
          .order("created_at", { ascending: false }),
      ]);

      console.log("profile", baseData);
      setBaseProfile((baseData as BaseProfile | null) || null);
      setSupplierDetails((detailsData as SupplierProfileDetails | null) || null);
      setProducts((productsData as SupplierProduct[] | null) || []);
    };

    loadProfileData();
  }, [profile?.id]);

  const fullName = baseProfile?.full_name || profile?.full_name || "التاجر";

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
          {supplierDetails?.store_name || "واجهة تعريفية بمتجرك ومنتجاتك داخل المنصة."}
        </p>
        <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/85">
          <span className="rounded-full bg-white/10 px-4 py-2">
            نوع الحساب: تاجر / مورد
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2">
            الحالة: {baseProfile?.status || "approved"}
          </span>
          <span className="rounded-full bg-white/10 px-4 py-2">
            عدد المنتجات: {products.length}
          </span>
        </div>
      </section>
      {toast && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {toast}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className={infoCardClass}>
          <h2 className="text-lg font-bold text-[#273347]">المعلومات العامة</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>الاسم: {fullName}</p>
            <p>الإيميل: {baseProfile?.email ?? "غير متوفر"}</p>
            <p>رقم الهاتف: {baseProfile?.phone ?? "غير متوفر"}</p>
            <p>الدولة: {baseProfile?.country ?? "غير متوفر"}</p>
            <p>المدينة: {baseProfile?.city ?? "غير متوفرة"}</p>
            <p>النبذة: {baseProfile?.bio ?? "غير متوفرة"}</p>
          </div>
        </div>

        <div className={infoCardClass}>
          <h2 className="text-lg font-bold text-[#273347]">معلومات المتجر</h2>
          <div className="mt-4 space-y-3 text-sm text-[#273347]/75">
            <p>اسم المتجر: {supplierDetails?.store_name || fullName}</p>
            <p>التصنيف: {supplierDetails?.product_category || "غير محدد"}</p>
            <p>السجل التجاري: {supplierDetails?.commercial_reg_no || "غير متوفر"}</p>
            <p>
              الرابط:
              {" "}
              {supplierDetails?.store_link ? (
                <a
                  href={supplierDetails.store_link}
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
      </section>

      <section className={infoCardClass}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#273347]">منتجاتي</h2>
            <p className="mt-1 text-sm text-[#273347]/60">
              هذا القسم سيغذي لاحقًا صفحة المستخدمين العامة لعرض المنتجات والأعمال.
            </p>
          </div>

          <Link
            href="/dashboard/supplier/products"
            className="rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1e2735]"
          >
            إدارة المنتجات
          </Link>
        </div>

        {products.length === 0 ? (
          <div className="mt-5 rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-8 text-center text-sm text-[#273347]/55">
            لا توجد منتجات بعد. أضف أول منتج ليظهر هنا ضمن ملفك الشخصي.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => {
              const imagePath = product.product_images?.[0]?.image_url;
              const imageUrl = imagePath
                ? supabase.storage.from("products").getPublicUrl(imagePath).data.publicUrl
                : null;

              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-[#fbfdff]"
                >
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
                    <div>
                      <h3 className="font-bold text-[#273347]">{product.name}</h3>
                      <p className="mt-2 line-clamp-3 text-sm text-[#273347]/65">
                        {product.description || "لا يوجد وصف لهذا المنتج حتى الآن."}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-[#273347]/70">
                      <span className="rounded-full bg-[#eef3f8] px-3 py-1">
                        سعر الجملة: {product.wholesale_price ?? 0}
                      </span>
                      <span className="rounded-full bg-[#eef3f8] px-3 py-1">
                        أقل طلب: {product.min_order_quantity ?? 1}
                      </span>
                      <span className="rounded-full bg-[#eef3f8] px-3 py-1">
                        المخزون: {product.stock_quantity ?? 0}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
      <ProfileEditModal
        open={editOpen}
        profile={baseProfile}
        onClose={() => setEditOpen(false)}
        onUpdated={(nextProfile: EditableProfile) => {
          setBaseProfile(nextProfile as BaseProfile);
          setEditOpen(false);
          setToast("Profile updated successfully");
          window.setTimeout(() => setToast(""), 3000);
        }}
      />
    </div>
  );
}
