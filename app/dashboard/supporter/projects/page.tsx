"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useDashboardAccess } from "@/hooks/useDashboardAccess";

type PublicProfile = {
  id: string;
  full_name: string | null;
  country: string | null;
  city: string | null;
  bio: string | null;
};

type SmallBusinessProfile = {
  user_id: string;
  project_name: string | null;
  project_field: string | null;
  project_stage: string | null;
  needs: string[] | null;
};

type ProjectCard = PublicProfile & {
  project_name: string | null;
  project_field: string | null;
  project_stage: string | null;
  needs: string[] | null;
};

const currencies = ["ILS", "USD", "JOD"] as const;
const investmentTypes = [
  { value: "funding", label: "تمويل" },
  { value: "partnership", label: "شراكة" },
  { value: "mentorship", label: "إرشاد" },
  { value: "services", label: "خدمات" },
  { value: "other", label: "أخرى" },
] as const;

function getProjectSummary(project: ProjectCard) {
  if (project.bio?.trim()) return project.bio.trim();

  const details = [
    project.project_field ? `مجال المشروع: ${project.project_field}` : null,
    project.project_stage ? `المرحلة: ${project.project_stage}` : null,
    (project.needs || []).length > 0 ? `يحتاج إلى: ${(project.needs || []).join("، ")}` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(". ") : "لم يضف صاحب المشروع نبذة تفصيلية بعد.";
}

export default function ProjectsPage() {
  const { profile, loading: accessLoading } = useDashboardAccess({ requiredAccountType: "supporter" });
  const [projects, setProjects] = useState<ProjectCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [schemaHint, setSchemaHint] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [selectedProject, setSelectedProject] = useState<ProjectCard | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    currency: "ILS",
    investment_type: "funding",
    expected_return: "",
    notes: "",
  });

  useEffect(() => {
    const loadProjects = async () => {
      setLoading(true);
      setError("");

      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, country, city, bio")
        .eq("account_type", "small_business")
        .eq("status", "approved")
        .order("full_name", { ascending: true });

      if (profilesError) {
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      const baseProfiles = (profilesData as PublicProfile[] | null) || [];
      const ids = baseProfiles.map((item) => item.id);

      const { data: detailsData, error: detailsError } = ids.length
        ? await supabase
            .from("small_business_profiles")
            .select("user_id, project_name, project_field, project_stage, needs")
            .in("user_id", ids)
        : { data: [], error: null };

      if (detailsError) {
        setError(detailsError.message);
        setLoading(false);
        return;
      }

      const detailsById = Object.fromEntries(
        (((detailsData as SmallBusinessProfile[] | null) || []).map((item) => [item.user_id, item]))
      );

      setProjects(
        baseProfiles.map((project) => ({
          ...project,
          project_name: detailsById[project.id]?.project_name || null,
          project_field: detailsById[project.id]?.project_field || null,
          project_stage: detailsById[project.id]?.project_stage || null,
          needs: detailsById[project.id]?.needs || null,
        }))
      );
      setLoading(false);
    };

    loadProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return projects;

    return projects.filter((project) =>
      [
        project.project_name,
        project.full_name,
        project.project_field,
        project.project_stage,
        project.city,
        project.country,
        project.bio,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    );
  }, [projects, search]);

  const resetForm = () => {
    setForm({ amount: "", currency: "ILS", investment_type: "funding", expected_return: "", notes: "" });
  };

  const handleCreateInvestment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile?.id || !selectedProject || saving) return;

    const amount = Number(form.amount);
    const expectedReturn = form.expected_return.trim() ? Number(form.expected_return) : null;

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("أدخل مبلغ استثمار صحيح.");
      return;
    }

    if (expectedReturn !== null && (!Number.isFinite(expectedReturn) || expectedReturn < 0)) {
      setError("أدخل نسبة عائد متوقعة صحيحة أو اتركها فارغة.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const response = await fetch("/api/investments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token || ""}`,
      },
      body: JSON.stringify({
        small_business_id: selectedProject.id,
        project_owner_id: selectedProject.id,
        amount,
        currency: form.currency,
        investment_type: form.investment_type,
        expected_return: expectedReturn,
        notes: form.notes.trim() || null,
      }),
    });
    const result = await response.json();

    setSaving(false);

    if (!response.ok) {
      const normalizedError = String(result.error || "").toLowerCase();
      if (
        normalizedError.includes("relation") ||
        normalizedError.includes("schema cache") ||
        normalizedError.includes("could not find") ||
        normalizedError.includes("does not exist")
      ) {
        setSchemaHint(true);
      }
      setError(result.error || "تعذر تسجيل الاستثمار.");
      return;
    }

    setMessage("تم إرسال طلب الاستثمار بنجاح. سيبقى قيد المراجعة، وسيُحسب ضمن استثماراتك بعد قبول صاحب المشروع.");
    setSelectedProject(null);
    resetForm();
  };

  return (
    <div className="space-y-6 p-8" dir="rtl">
      <section className="rounded-3xl bg-[#273347] px-8 py-7 text-white">
        <p className="text-sm text-white/60">فرص الاستثمار</p>
        <h1 className="mt-2 text-3xl font-bold">استعراض المشاريع</h1>
        <p className="mt-2 max-w-3xl text-sm text-white/70">
          اختر مشروعًا صغيرًا معتمدًا وسجل نوع الدعم والمبلغ. يُحسب الاستثمار ضمن استثماراتك بعد قبول صاحب المشروع.
        </p>
      </section>

      {schemaHint && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          جدول الاستثمارات غير موجود بعد. نفذ الملف <span className="font-semibold">supabase/supporter-investments.sql</span> في Supabase.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {message && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {message}
        </div>
      )}

      <div className="rounded-2xl border border-[#e6edf5] bg-white p-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="ابحث باسم المشروع، المجال، المدينة..."
          className="w-full rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
        />
      </div>

      {loading || accessLoading ? (
        <div className="py-14 text-center text-sm text-[#273347]/45">جاري تحميل المشاريع...</div>
      ) : filteredProjects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#d9e3ee] bg-white px-4 py-12 text-center text-sm text-[#273347]/55">
          لا توجد مشاريع مطابقة حاليًا.
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const title = project.project_name || project.full_name || "مشروع صغير";
            const location = [project.city, project.country].filter(Boolean).join(" - ") || "داخل المنصة";
            const summary = getProjectSummary(project);

            return (
              <article key={project.id} className="rounded-2xl border border-[#e6edf5] bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-[#273347]">{title}</h2>
                    <p className="mt-1 text-sm text-[#273347]/55">{project.project_field || "مجال غير محدد"}</p>
                  </div>
                  <span className="rounded-full bg-[#eef3f8] px-3 py-1 text-xs font-semibold text-[#273347]/70">
                    {project.project_stage || "معتمد"}
                  </span>
                </div>

                <p className="mt-4 line-clamp-3 min-h-[60px] text-sm text-[#273347]/65">{summary}</p>

                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[#273347]/70">
                  <span className="rounded-full bg-[#f5f8fb] px-3 py-1">{location}</span>
                  {(project.needs || []).slice(0, 3).map((need) => (
                    <span key={need} className="rounded-full bg-[#f5f8fb] px-3 py-1">
                      {need}
                    </span>
                  ))}
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProject(project);
                      setError("");
                    }}
                    className="rounded-2xl bg-[#273347] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1f2938]"
                  >
                    تسجيل استثمار
                  </button>
                  <Link
                    href={`/dashboard/supporter/users/${project.id}`}
                    className="rounded-2xl border border-[#d9e3ee] px-4 py-2 text-sm font-semibold text-[#273347] transition hover:bg-[#f5f8fb]"
                  >
                    عرض الملف
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#111827]/45 px-4">
          <form onSubmit={handleCreateInvestment} className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-[#273347]/55">استثمار جديد</p>
                <h2 className="mt-1 text-xl font-bold text-[#273347]">
                  {selectedProject.project_name || selectedProject.full_name || "مشروع صغير"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedProject(null);
                  resetForm();
                }}
                className="rounded-full border border-[#d9e3ee] px-3 py-1 text-sm text-[#273347]"
              >
                إغلاق
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={form.amount}
                onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value }))}
                type="number"
                min="1"
                step="0.01"
                placeholder="المبلغ"
                className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none focus:border-[#273347]"
              />
              <select
                value={form.currency}
                onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value }))}
                className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none focus:border-[#273347]"
              >
                {currencies.map((currency) => (
                  <option key={currency} value={currency}>
                    {currency}
                  </option>
                ))}
              </select>
              <select
                value={form.investment_type}
                onChange={(event) => setForm((current) => ({ ...current, investment_type: event.target.value }))}
                className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none focus:border-[#273347]"
              >
                {investmentTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <input
                value={form.expected_return}
                onChange={(event) => setForm((current) => ({ ...current, expected_return: event.target.value }))}
                type="number"
                min="0"
                step="0.01"
                placeholder="العائد المتوقع %"
                className="rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none focus:border-[#273347]"
              />
              <textarea
                value={form.notes}
                onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                rows={4}
                placeholder="ملاحظات أو شروط الدعم"
                className="min-h-[110px] rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none focus:border-[#273347] md:col-span-2"
              />
            </div>

            <button
              type="submit"
              disabled={saving || !form.amount.trim()}
              className="mt-5 w-full rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? "جاري التسجيل..." : "تأكيد الاستثمار"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
