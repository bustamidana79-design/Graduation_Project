"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type UpgradeRequest = {
  id: string;
  status: "pending" | "approved" | "rejected";
  request_json: {
    reason?: string;
    experience?: string;
    expected_usage?: string;
  } | null;
  admin_note: string | null;
  created_at: string;
};

const statusLabels: Record<UpgradeRequest["status"], string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const statusClasses: Record<UpgradeRequest["status"], string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-700",
  rejected: "border-red-200 bg-red-50 text-red-700",
};

const dateFormatter = new Intl.DateTimeFormat("ar", { year: "numeric", month: "short", day: "numeric" });

export default function SmallBusinessUpgradeRequestCard() {
  const [requests, setRequests] = useState<UpgradeRequest[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [experience, setExperience] = useState("");
  const [expectedUsage, setExpectedUsage] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("يجب تسجيل الدخول لعرض طلبات الترقية.");
      setLoading(false);
      return;
    }

    const response = await fetch("/api/upgrade-requests", {
      headers: { Authorization: `Bearer ${session.access_token}` },
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "تعذر تحميل طلبات الترقية.");
      setLoading(false);
      return;
    }

    setRequests(result.requests || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadRequests);
  }, [loadRequests]);

  const latestRequest = requests[0];
  const pendingRequest = requests.find((request) => request.status === "pending");

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      setError("يجب تسجيل الدخول قبل إرسال الطلب.");
      setSaving(false);
      return;
    }

    const response = await fetch("/api/upgrade-requests", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        target_account_type: "merchant",
        reason,
        experience,
        expected_usage: expectedUsage,
      }),
    });
    const result = await response.json();

    if (!response.ok) {
      setError(result.error || "تعذر إرسال طلب الترقية.");
      setSaving(false);
      return;
    }

    setRequests((current) => [result.request, ...current]);
    setReason("");
    setExperience("");
    setExpectedUsage("");
    setIsOpen(false);
    setMessage("تم إرسال طلب الترقية بنجاح. ستراجعه الإدارة قريبًا.");
    setSaving(false);
  };

  return (
    <section className="mb-6 rounded-2xl border border-[#dfe8f2] bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold text-[#273347]/45">نمو المشروع</p>
          <h3 className="mt-1 text-lg font-bold text-[#273347]">ترقية المشروع إلى مورد</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#273347]/60">
            إذا أصبح مشروعك قادرًا على بيع منتجاته كمورد، أرسل طلب ترقية للإدارة لمراجعة الحساب وتفعيل لوحة المورد.
          </p>
        </div>

        <button
          onClick={() => setIsOpen((current) => !current)}
          disabled={Boolean(pendingRequest)}
          className="rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pendingRequest ? "طلبك قيد المراجعة" : isOpen ? "إغلاق الطلب" : "طلب الترقية"}
        </button>
      </div>

      {message && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {loading ? (
        <div className="mt-5 text-sm text-[#273347]/45">جاري فحص حالة طلبات الترقية...</div>
      ) : latestRequest ? (
        <div className="mt-5 rounded-2xl bg-[#f6f8fb] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[#273347]">آخر طلب ترقية إلى مورد</p>
              <p className="mt-1 text-xs text-[#273347]/45">{dateFormatter.format(new Date(latestRequest.created_at))}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClasses[latestRequest.status]}`}>
              {statusLabels[latestRequest.status]}
            </span>
          </div>
          {latestRequest.admin_note && (
            <p className="mt-3 text-xs text-[#273347]/60">ملاحظة الإدارة: {latestRequest.admin_note}</p>
          )}
        </div>
      ) : null}

      {isOpen && !pendingRequest && (
        <form onSubmit={submitRequest} className="mt-5 grid gap-4 border-t border-[#eef3f8] pt-5">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold text-[#273347]/60">سبب الترقية</span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              required
              minLength={12}
              rows={3}
              className="w-full rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
              placeholder="اشرح لماذا أصبح مشروعك جاهزًا ليكون موردًا."
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#273347]/60">معلومات داعمة</span>
              <textarea
                value={experience}
                onChange={(event) => setExperience(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
                placeholder="مثال: المنتجات، القدرة الإنتاجية، أو الخبرة."
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold text-[#273347]/60">الاستخدام المتوقع</span>
              <textarea
                value={expectedUsage}
                onChange={(event) => setExpectedUsage(event.target.value)}
                rows={3}
                className="w-full rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm outline-none transition focus:border-[#273347]"
                placeholder="كيف ستستخدم صلاحيات المورد داخل المنصة؟"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938] disabled:cursor-not-allowed disabled:opacity-60 md:w-fit"
          >
            {saving ? "جاري الإرسال..." : "إرسال الطلب للإدارة"}
          </button>
        </form>
      )}
    </section>
  );
}
