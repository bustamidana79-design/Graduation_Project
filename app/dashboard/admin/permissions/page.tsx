"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type AdminUser = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  country: string | null;
  city: string | null;
  account_type: string | null;
  status: string | null;
  is_active: boolean | null;
  created_at: string | null;
};

const accountLabels: Record<string, string> = {
  admin: "إدارة",
  merchant: "تاجر / مورد",
  small_business: "مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم",
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

export default function PermissionsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");

  const loadPermissions = async () => {
    setLoading(true);
    const headers = await getAuthHeaders();
    const response = await fetch("/api/admin/permissions", { headers });
    const result = await response.json();

    if (!response.ok) {
      setMessage(result.error || "تعذر تحميل الحسابات.");
      setUsers([]);
    } else {
      setUsers(result.users || []);
    }

    setLoading(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPermissions();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return users.filter((user) => {
      if (accountFilter !== "all" && user.account_type !== accountFilter) return false;
      if (!query) return true;

      return [user.full_name, user.email, user.phone, user.city, user.country, user.account_type]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [accountFilter, search, users]);

  return (
    <div className="space-y-6 p-8" dir="rtl">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">مراقبة الحسابات</h1>
          <p className="mt-1 text-sm text-[#273347]/60">
            نوع الحساب ثابت حسب التسجيل والموافقة. الأدمن يراجع الحسابات ويتابع حالتها بدون تغيير صلاحيات المستخدمين.
          </p>
        </div>

        <Link
          href="/dashboard/admin/products"
          className="rounded-2xl border border-[#bbd0e4] bg-white p-4 text-sm font-semibold text-[#273347] transition hover:border-[#273347]"
        >
          إدارة المنتجات والمنشورات
          <span className="mt-1 block text-xs font-normal text-[#273347]/55">
            عرض كل المنتجات، حذف منتج، وإرسال سبب الحذف عبر مركز الدعم.
          </span>
        </Link>
      </div>

      {message && (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-4 text-sm text-[#273347]">{message}</div>
      )}

      <div className="rounded-2xl border border-[#e6edf5] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="ابحث بالاسم، الإيميل، الهاتف، المدينة..."
            className="rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
          />
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="rounded-xl border border-[#d8e1ec] px-4 py-3 text-sm text-[#273347] outline-none focus:border-[#273347]"
          >
            <option value="all">كل الحسابات</option>
            <option value="admin">الإدارة</option>
            <option value="merchant">التجار / الموردين</option>
            <option value="small_business">المشاريع الصغيرة</option>
            <option value="delivery">شركات الشحن</option>
            <option value="supporter">الداعمين</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-[#e6edf5] bg-white p-6 text-sm text-[#273347]/60">
          جاري تحميل المستخدمين...
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#e6edf5] bg-white">
          <div className="grid grid-cols-[minmax(220px,1.4fr)_160px_minmax(160px,0.8fr)_140px] gap-4 border-b border-[#edf2f7] bg-[#f8fafc] px-5 py-3 text-xs font-bold text-[#546a85]">
            <span>المستخدم</span>
            <span>نوع الحساب</span>
            <span>الحالة</span>
            <span>إجراء</span>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#273347]/55">لا توجد نتائج مطابقة.</div>
          ) : (
            filteredUsers.map((user) => {
              const displayName = user.full_name || user.email || "مستخدم بدون اسم";
              const location = [user.city, user.country].filter(Boolean).join(" - ");

              return (
                <div
                  key={user.id}
                  className="grid grid-cols-[minmax(220px,1.4fr)_160px_minmax(160px,0.8fr)_140px] gap-4 border-b border-[#edf2f7] px-5 py-4 last:border-0"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-[#273347]">{displayName}</div>
                    <div className="mt-1 truncate text-xs text-[#546a85]">{user.email || user.phone || user.id}</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[#546a85]">
                      <span className="rounded-full bg-[#eef3f8] px-2 py-1">{user.status || "بدون حالة"}</span>
                      <span className="rounded-full bg-[#eef3f8] px-2 py-1">
                        {user.is_active === false ? "غير فعال" : "فعال"}
                      </span>
                      {location && <span className="rounded-full bg-[#eef3f8] px-2 py-1">{location}</span>}
                    </div>
                  </div>

                  <div className="text-sm text-[#273347]">
                    {accountLabels[user.account_type || ""] || user.account_type || "غير محدد"}
                  </div>

                  <div className="text-sm text-[#273347]">
                    <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs font-semibold text-[#546a85]">
                      {user.status || "بدون حالة"}
                    </span>
                  </div>

                  <div>
                    <Link
                      href={`/dashboard/admin/users/${user.id}`}
                      className="inline-flex rounded-xl border border-[#bbd0e4] px-3 py-2 text-xs font-semibold text-[#273347] transition hover:border-[#273347] hover:bg-[#f8fafc]"
                    >
                      عرض البروفايل
                    </Link>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
