"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export type EditableProfile = {
  full_name: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  city?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  status?: string | null;
};

type ProfileEditModalProps = {
  open: boolean;
  profile: EditableProfile | null;
  onClose: () => void;
  onUpdated: (profile: EditableProfile) => void;
};

const palestinianCities = ["Nablus", "Ramallah", "Hebron", "Jerusalem", "Bethlehem", "Jenin", "Tulkarm", "Qalqilya", "Jericho", "Gaza"];

const inputClass =
  "w-full rounded-xl border border-[#d9e3ee] bg-white px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]";

export default function ProfileEditModal({ open, profile, onClose, onUpdated }: ProfileEditModalProps) {
  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    country: "",
    city: "",
    bio: "",
    avatar_url: "",
  });
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!profile) return;

    setForm({
      full_name: profile.full_name || "",
      phone: profile.phone || "",
      country: profile.country || "",
      city: profile.city || "",
      bio: profile.bio || "",
      avatar_url: profile.avatar_url || "",
    });
    setAvatarFile(null);
    setMessage("");
  }, [profile, open]);

  if (!open) return null;

  const uploadAvatar = async () => {
    if (!avatarFile) return form.avatar_url;

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("يجب تسجيل الدخول.");
    }

    const extension = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `avatars/${user.id}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(path, avatarFile, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    return supabase.storage.from("documents").getPublicUrl(path).data.publicUrl;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving) return;

    setSaving(true);
    setMessage("");

    try {
      const avatarUrl = await uploadAvatar();
      const { data } = await supabase.auth.getSession();
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token || ""}`,
        },
        body: JSON.stringify({
          ...form,
          avatar_url: avatarUrl,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر تحديث الملف الشخصي.");
      }

      onUpdated(result.profile as EditableProfile);
      setMessage("Profile updated successfully");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "تعذر تحديث الملف الشخصي.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6" dir="rtl">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-[#273347]">تعديل المعلومات</h2>
            <p className="mt-1 text-sm text-[#273347]/55">حدّث معلوماتك العامة التي تظهر في ملفك.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-[#e6edf5] px-3 py-2 text-sm text-[#273347]">
            إغلاق
          </button>
        </div>

        {message && (
          <div className="mt-4 rounded-xl border border-[#e6edf5] bg-[#f8fafc] px-4 py-3 text-sm text-[#273347]">
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm font-semibold text-[#273347]">
            الاسم
            <input
              value={form.full_name}
              onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#273347]">
            رقم الهاتف
            <input
              value={form.phone}
              onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#273347]">
            الدولة
            <input
              value={form.country}
              onChange={(event) => setForm((current) => ({ ...current, country: event.target.value }))}
              className={inputClass}
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#273347]">
            المدينة
            <select
              value={form.city}
              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
              className={inputClass}
            >
              <option value="">اختر المدينة</option>
              {palestinianCities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#273347] md:col-span-2">
            النبذة
            <textarea
              value={form.bio}
              onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
              rows={4}
              className={`${inputClass} min-h-[120px] resize-none`}
            />
          </label>

          <label className="space-y-2 text-sm font-semibold text-[#273347] md:col-span-2">
            الصورة الشخصية
            <input
              type="file"
              accept="image/*"
              onChange={(event) => setAvatarFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </label>

          <div className="flex flex-col gap-3 md:col-span-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#bbd0e4] px-5 py-3 text-sm font-semibold text-[#273347]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "جاري الحفظ..." : "حفظ التغييرات"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
