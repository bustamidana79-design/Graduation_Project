"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabase";

type ApplicationStatus = "pending" | "approved" | "rejected";

type Application = {
  id: string;
  user_id: string;
  account_type: string;
  status: ApplicationStatus;
  created_at: string;
  ai_score?: number;
  ai_recommendation?: "approve" | "review" | "reject";
  ai_reason?: string;
  ai_risk?: "low" | "medium" | "high";
  ai_checked?: boolean;
  data_json: {
    basic: {
      full_name: string;
      email: string;
      phone: string;
      country: string;
      city: string;
      account_type: string;
      bio: string;
    };
    type_specific: Record<string, any>;
  };
  proof_json: {
    proof_link_1: string;
    proof_link_2?: string;
    note?: string;
    file_urls?: string[];
  };
};

type LinkMeta = {
  url: string | null;
  reachable: boolean;
  platform?: string;
  relevanceHint?: string;
  error?: string;
};

type AIReport = {
  score: number;
  recommendation: "approve" | "reject" | "review";
  risk: "low" | "medium" | "high";
  summary: string;
  project_summary?: string;
  details: string;
  bio_analysis?: string;
  link_analysis?: string;
  strengths: string[];
  weaknesses: string[];
  flags: string[];
  decision_hint: string;
  local_score?: number;
  _meta?: {
    bioQuality: "good" | "weak" | "suspicious";
    bioScore: number;
    link1: LinkMeta;
    link2: LinkMeta;
  };
};

const ITEMS_PER_PAGE = 8;
const BASE_URL = "http://localhost:3000";

const accountTypeLabel: Record<string, string> = {
  merchant: "تاجر (جملة)",
  small_business: "مشروع صغير",
  delivery: "شركة توصيل",
  supporter: "داعم / مستثمر",
};

const statusLabel: Record<ApplicationStatus, string> = {
  pending: "قيد المراجعة",
  approved: "مقبول",
  rejected: "مرفوض",
};

const statusColor: Record<ApplicationStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const recommendationConfig = {
  approve: { label: "✅ يُنصح بالقبول",        color: "bg-green-100 text-green-700 border-green-300" },
  reject:  { label: "❌ يُنصح بالرفض",         color: "bg-red-100 text-red-700 border-red-300" },
  review:  { label: "🔍 يحتاج مراجعة إضافية", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
};

const riskConfig = {
  low:    { label: "🟢 مخاطر منخفضة", color: "bg-green-50 text-green-700 border-green-200" },
  medium: { label: "🟡 مخاطر متوسطة", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  high:   { label: "🔴 مخاطر عالية",  color: "bg-red-50 text-red-700 border-red-200" },
};

const bioQualityConfig = {
  good:       { label: "✅ نبذة جيدة",    color: "text-green-700 bg-green-50 border-green-200" },
  weak:       { label: "⚠️ نبذة ضعيفة",  color: "text-yellow-700 bg-yellow-50 border-yellow-200" },
  suspicious: { label: "🚩 نبذة مشبوهة", color: "text-red-700 bg-red-50 border-red-200" },
};

const platformIcons: Record<string, string> = {
  instagram: "📸",
  facebook: "📘",
  "twitter/x": "🐦",
  tiktok: "🎵",
  linkedin: "💼",
  youtube: "▶️",
  snapchat: "👻",
  whatsapp: "💬",
  website: "🌐",
};

const loadingSteps = [
  "🔍 جارٍ قراءة بيانات الطلب...",
  "🔗 يفحص الروابط المرفقة...",
  "📝 يحلّل النبذة والمحتوى...",
  "🧠 يحلّل الذكاء الاصطناعي المعلومات...",
  "📊 يُقيّم مستوى المخاطر...",
  "✍️ يكتب التقرير التفصيلي...",
];

export default function ApplicationsPage() {
  const [applications, setApplications]   = useState<Application[]>([]);
  const [loading, setLoading]             = useState(true);
  const [filterStatus, setFilterStatus]   = useState<"all" | ApplicationStatus>("all");
  const [filterType, setFilterType]       = useState("all");
  const [selectedApp, setSelectedApp]     = useState<Application | null>(null);
  const [adminNote, setAdminNote]         = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg]         = useState("");
  const [searchQuery, setSearchQuery]     = useState("");
  const [currentPage, setCurrentPage]     = useState(1);

  const [aiApp, setAiApp]                 = useState<Application | null>(null);
  const [aiReport, setAiReport]           = useState<AIReport | null>(null);
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiError, setAiError]             = useState("");
  const [aiLoadingStep, setAiLoadingStep] = useState(0);

  useEffect(() => { fetchApplications(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filterStatus, filterType, searchQuery]);

  useEffect(() => {
    if (!aiLoading) { setAiLoadingStep(0); return; }
    const interval = setInterval(() => {
      setAiLoadingStep((s) => (s + 1) % loadingSteps.length);
    }, 1400);
    return () => clearInterval(interval);
  }, [aiLoading]);

  useEffect(() => {
    document.body.style.overflow = aiApp ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [aiApp]);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setApplications(data as Application[]);
    setLoading(false);
  };

  // ── AI Analysis ──
  const handleAiAnalysis = async (app: Application) => {
    setAiApp(app);
    setAiReport(null);
    setAiError("");
    setAiLoading(true);

    try {
      if (app.ai_checked && app.ai_score !== undefined && app.ai_reason) {
        let cached: AIReport;
        try {
          cached = JSON.parse(app.ai_reason);
        } catch {
          cached = {
            score: app.ai_score,
            recommendation: app.ai_recommendation ?? "review",
            risk: app.ai_risk ?? "medium",
            summary: app.ai_reason,
            details: app.ai_reason,
            strengths: [],
            weaknesses: [],
            flags: [],
            decision_hint: "",
          };
        }
        setAiReport(cached);
        setAiLoading(false);
        return;
      }

      const res = await fetch("/api/ai/evaluate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app }),
      });

      const result: AIReport & { error?: string } = await res.json();
      if (!res.ok || result.error) throw new Error(result.error || "فشل التحليل");

      const reasonJson = JSON.stringify(result);

      await supabase.from("ai_recommendation").upsert({
        application_id: app.id,
        score: result.score,
        recommendation: result.recommendation,
        reason: reasonJson,
        risk: result.risk,
        checked_at: new Date().toISOString(),
      }, { onConflict: "application_id" });

      await supabase.from("applications").update({
        ai_score: result.score,
        ai_recommendation: result.recommendation,
        ai_reason: reasonJson,
        ai_risk: result.risk,
        ai_checked: true,
      }).eq("id", app.id);

      setApplications((prev) =>
        prev.map((a) => a.id === app.id ? {
          ...a,
          ai_score: result.score,
          ai_recommendation: result.recommendation,
          ai_reason: reasonJson,
          ai_risk: result.risk,
          ai_checked: true,
        } : a)
      );

      setAiReport(result);
    } catch (err: any) {
      setAiError(err.message || "حدث خطأ غير متوقع. حاول مرة أخرى.");
    } finally {
      setAiLoading(false);
    }
  };

  // ── Email ──
  const sendEmail = async (email: string, fullName: string, status: "approved" | "rejected", note: string) => {
    const subject = status === "approved"
      ? "تهانينا! تم قبول طلبك في منصة الموردين"
      : "بخصوص طلب إنشاء حسابك في منصة الموردين";
    const bodyText = status === "approved"
      ? `عزيزي ${fullName}،\n\nتم قبول طلب إنشاء حسابك.\n${note ? `\nملاحظة: ${note}\n` : ""}\nتسجيل الدخول: ${BASE_URL}/login\n\nفريق المنصة`
      : `عزيزي ${fullName}،\n\nتم رفض طلب إنشاء حسابك.\n${note ? `\nسبب الرفض: ${note}\n` : ""}\nإعادة التسجيل: ${BASE_URL}/register\n\nفريق المنصة`;
    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject, body: bodyText }),
    });
  };

  // ── Approve / Reject ──
  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionMsg("");

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // 1. update applications
      const { error: appError } = await supabase
        .from("applications")
        .update({
          status,
          admin_note: adminNote.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq("id", selectedApp.id);
      if (appError) throw new Error(appError.message);

      // 2. insert في admin_reviews
      const { error: reviewError } = await supabase
        .from("admin_reviews")
        .insert({
          application_id: selectedApp.id,
          admin_id: user?.id ?? null,
          decision: status,
          reason: adminNote.trim() || null,
        });
      if (reviewError) throw new Error(reviewError.message);

      if (status === "approved") {
        const specific = selectedApp.data_json.type_specific || {};
        const accountType = selectedApp.account_type;

        // 3. insert في profiles الأساسي
        const { error: profileError } = await supabase.from("profiles").upsert({
          id: selectedApp.user_id,
          full_name: selectedApp.data_json.basic.full_name,
          email: selectedApp.data_json.basic.email,
          phone: selectedApp.data_json.basic.phone,
          country: selectedApp.data_json.basic.country,
          city: selectedApp.data_json.basic.city,
          account_type: accountType,
          status: "approved",
        }, { onConflict: "id" });
        if (profileError) throw new Error(profileError.message);

        // 4. insert في الجدول المخصص حسب نوع الحساب
        if (accountType === "merchant") {
          const { error } = await supabase.from("supplier_profiles").upsert({
            user_id: selectedApp.user_id,
            store_name: specific.store_name || selectedApp.data_json.basic.full_name,
            product_category: specific.product_category || specific.product_type || "—",
            store_link: selectedApp.proof_json.proof_link_1 || "—",
            commercial_reg_no: specific.commercial_reg_no || null,
          }, { onConflict: "user_id" });
          if (error) throw new Error(error.message);

        } else if (accountType === "small_business") {
          const { error } = await supabase.from("small_business_profiles").upsert({
            user_id: selectedApp.user_id,
            project_name: specific.project_name || selectedApp.data_json.basic.full_name,
            project_field: specific.project_field || specific.business_field || "—",
            project_stage: specific.project_stage || "running",
            needs: Array.isArray(specific.needs) ? specific.needs : [],
            social_link: selectedApp.proof_json.proof_link_1 || "—",
          }, { onConflict: "user_id" });
          if (error) throw new Error(error.message);

        } else if (accountType === "delivery") {
          const { error } = await supabase.from("shipping_company_profiles").upsert({
            user_id: selectedApp.user_id,
            company_name: specific.company_name || selectedApp.data_json.basic.full_name,
            delivery_scope: specific.delivery_scope || "local",
            delivery_cities: Array.isArray(specific.delivery_cities) ? specific.delivery_cities : [],
            avg_delivery_time: specific.avg_delivery_time || "—",
            license_no: specific.license_no || specific.commercial_reg_no || "—",
          }, { onConflict: "user_id" });
          if (error) throw new Error(error.message);

        } else if (accountType === "supporter") {
          const { error } = await supabase.from("supporter_profiles").upsert({
            user_id: selectedApp.user_id,
            support_type: specific.support_type || "financial",
            funding_range: specific.funding_range || null,
            interests: specific.interests || "—",
            professional_link: selectedApp.proof_json.proof_link_1 || "—",
            previous_experience: specific.previous_experience || "—",
          }, { onConflict: "user_id" });
          if (error) throw new Error(error.message);
        }

      } else {
        // rejected → فقط update الـ status بـ profiles إذا موجود
        await supabase.from("profiles").update({ status: "rejected" }).eq("id", selectedApp.user_id);
      }

      // 5. إرسال الإيميل
      await sendEmail(
        selectedApp.data_json.basic.email,
        selectedApp.data_json.basic.full_name,
        status,
        adminNote.trim()
      );

      setActionMsg(
        status === "approved"
          ? "✅ تم قبول الطلب وإنشاء الملف الشخصي وإرسال الإيميل."
          : "❌ تم رفض الطلب وإرسال الإيميل."
      );
      setApplications((prev) => prev.map((a) => a.id === selectedApp.id ? { ...a, status } : a));
      setSelectedApp(null);
      setAdminNote("");
    } catch (err: any) {
      setActionMsg(`حدث خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtering ──
  const filtered = applications.filter((a) => {
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchType   = filterType === "all" || a.account_type === filterType;
    const matchSearch = !searchQuery || a.data_json.basic.full_name.includes(searchQuery) || a.data_json.basic.email.includes(searchQuery);
    return matchStatus && matchType && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated  = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const counts = {
    all:      applications.length,
    pending:  applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const scoreColor    = (s: number) => s >= 70 ? "text-green-600"  : s >= 40 ? "text-yellow-600"  : "text-red-600";
  const scoreBarColor = (s: number) => s >= 70 ? "bg-green-500"    : s >= 40 ? "bg-yellow-500"    : "bg-red-500";
  const scoreBg       = (s: number) => s >= 70 ? "bg-green-50 border-green-200" : s >= 40 ? "bg-yellow-50 border-yellow-200" : "bg-red-50 border-red-200";

  // ── Link status card helper ──
  const LinkStatusCard = ({ meta, label }: { meta: LinkMeta; label: string }) => {
    if (!meta.url) {
      return (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex items-center gap-2">
          <span className="text-gray-400 text-lg">🔗</span>
          <div>
            <p className="text-xs font-semibold text-gray-400">{label}</p>
            <p className="text-xs text-gray-400">غير مرفق</p>
          </div>
        </div>
      );
    }

    const icon = platformIcons[meta.platform || "website"] || "🌐";
    const isGood = meta.reachable && !meta.relevanceHint?.includes("لم يُرصد");

    return (
      <div className={`border rounded-xl p-3 ${meta.reachable ? (isGood ? "bg-green-50 border-green-200" : "bg-yellow-50 border-yellow-200") : "bg-red-50 border-red-200"}`}>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-lg">{icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-[#273347]">{label}</p>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${meta.reachable ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                {meta.reachable ? "✅ يفتح" : "❌ لا يفتح"}
              </span>
              {meta.platform && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-white/60 text-[#273347]/60 border border-current/10">
                  {meta.platform}
                </span>
              )}
            </div>
            <a href={meta.url} target="_blank" rel="noreferrer"
              className="text-[10px] text-blue-500 hover:underline truncate block max-w-[200px]">
              {meta.url}
            </a>
          </div>
        </div>
        {meta.error && !meta.reachable && (
          <p className="text-xs text-red-600 mt-1">⚠️ {meta.error}</p>
        )}
        {meta.relevanceHint && meta.reachable && (
          <p className={`text-xs mt-1 ${isGood ? "text-green-700" : "text-yellow-700"}`}>
            {isGood ? "✓" : "⚠️"} {meta.relevanceHint}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#273347] mb-6">الطلبات</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "الكل",          count: counts.all,      color: "bg-[#273347] text-white" },
          { label: "قيد المراجعة", count: counts.pending,  color: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
          { label: "مقبول",         count: counts.approved, color: "bg-green-50 text-green-700 border border-green-200" },
          { label: "مرفوض",         count: counts.rejected, color: "bg-red-50 text-red-700 border border-red-200" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl p-5 ${stat.color}`}>
            <p className="text-3xl font-bold">{stat.count}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e6edf5] p-5 mb-6 flex flex-wrap gap-4 items-center">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] flex-1 min-w-[200px]"
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
          <option value="all">كل الأنواع</option>
          <option value="merchant">تاجر (جملة)</option>
          <option value="small_business">مشروع صغير</option>
          <option value="delivery">شركة توصيل</option>
          <option value="supporter">داعم / مستثمر</option>
        </select>
        <button onClick={fetchApplications}
          className="bg-[#273347] text-white text-sm px-5 py-2 rounded-xl hover:bg-[#1e2a38] transition">
          تحديث
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#e6edf5] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-[#273347]/50 text-sm">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-[#273347]/50 text-sm">لا توجد طلبات.</div>
        ) : (
          <>
            <table className="w-full text-sm text-right">
              <thead className="bg-[#f1f5f9] text-[#273347]/70 border-b border-[#e6edf5]">
                <tr>
                  <th className="px-5 py-4 font-semibold">الاسم</th>
                  <th className="px-5 py-4 font-semibold">الإيميل</th>
                  <th className="px-5 py-4 font-semibold">نوع الحساب</th>
                  <th className="px-5 py-4 font-semibold">الدولة</th>
                  <th className="px-5 py-4 font-semibold">تاريخ الطلب</th>
                  <th className="px-5 py-4 font-semibold">الحالة</th>
                  <th className="px-5 py-4 font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((app, i) => (
                  <tr key={app.id} className={`border-b border-[#e6edf5] hover:bg-[#f8fafc] transition ${i % 2 === 0 ? "" : "bg-[#fafbfc]"}`}>
                    <td className="px-5 py-4 font-medium text-[#273347]">{app.data_json.basic.full_name}</td>
                    <td className="px-5 py-4 text-[#273347]/70">{app.data_json.basic.email}</td>
                    <td className="px-5 py-4">
                      <span className="bg-[#eef3f8] text-[#273347] px-3 py-1 rounded-lg text-xs font-medium">
                        {accountTypeLabel[app.account_type] || app.account_type}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-[#273347]/70">{app.data_json.basic.country}</td>
                    <td className="px-5 py-4 text-[#273347]/60">{new Date(app.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="px-5 py-4">
                      <span className={`border px-3 py-1 rounded-lg text-xs font-medium ${statusColor[app.status]}`}>
                        {statusLabel[app.status]}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { setSelectedApp(app); setAdminNote(""); setActionMsg(""); }}
                          className="text-[#546a85] hover:text-[#273347] font-semibold text-xs underline underline-offset-2"
                        >
                          التفاصيل
                        </button>
                        <button
                          onClick={() => handleAiAnalysis(app)}
                          className="text-xs px-3 py-1.5 rounded-lg transition font-medium bg-[#273347] hover:bg-[#1e2a38] text-white"
                        >
                          ✨ تحليل AI
                        </button>
                        {app.ai_checked && app.ai_score !== undefined && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            app.ai_score >= 70 ? "bg-green-100 text-green-700" :
                            app.ai_score >= 40 ? "bg-yellow-100 text-yellow-700" :
                            "bg-red-100 text-red-700"
                          }`}>
                            ✅ {app.ai_score}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#e6edf5] bg-[#f8fafc]">
              <p className="text-xs text-[#273347]/50">
                عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} من {filtered.length} طلب
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e6edf5] text-[#273347] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm">«</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                  .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "..." ? (
                      <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-[#273347]/40 text-xs">...</span>
                    ) : (
                      <button key={item} onClick={() => setCurrentPage(item as number)}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition ${currentPage === item ? "bg-[#273347] text-white" : "border border-[#e6edf5] text-[#273347] hover:bg-white"}`}>
                        {item}
                      </button>
                    )
                  )}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e6edf5] text-[#273347] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm">»</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI REPORT MODAL */}
      {aiApp && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-hidden"
          onClick={() => { setAiApp(null); setAiReport(null); setAiError(""); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col"
            style={{ maxHeight: "82vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-l from-[#1e2a38] to-[#273347] text-white px-5 py-4 rounded-t-2xl flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span>✨</span>
                  <h2 className="text-base font-bold">تقرير الذكاء الاصطناعي</h2>
                </div>
                <p className="text-xs opacity-60">{aiApp.data_json.basic.full_name} · {accountTypeLabel[aiApp.account_type]}</p>
              </div>
              <button
                onClick={() => { setAiApp(null); setAiReport(null); setAiError(""); }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white text-[#273347] text-lg font-bold hover:bg-gray-100 transition shrink-0"
              >×</button>
            </div>

            <div className="p-5 overflow-y-auto flex-1">
              {aiLoading && (
                <div className="text-center py-14">
                  <div className="relative inline-block mb-6">
                    <div className="w-20 h-20 rounded-full border-4 border-[#e6edf5] border-t-[#273347] animate-spin" />
                    <span className="absolute inset-0 flex items-center justify-center text-2xl">🤖</span>
                  </div>
                  <p className="text-[#273347] font-semibold text-sm mb-1 transition-all duration-500">
                    {loadingSteps[aiLoadingStep]}
                  </p>
                  <p className="text-[#273347]/40 text-xs">يفحص الروابط ويحلّل المحتوى...</p>
                  <div className="mt-6 flex justify-center gap-1.5">
                    {loadingSteps.map((_, i) => (
                      <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === aiLoadingStep ? "w-6 bg-[#273347]" : "w-1.5 bg-[#e6edf5]"}`} />
                    ))}
                  </div>
                </div>
              )}

              {aiError && !aiLoading && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
                  <p className="text-2xl mb-3">⚠️</p>
                  <p className="text-red-700 text-sm font-medium mb-1">فشل التحليل</p>
                  <p className="text-red-500 text-xs mb-4 break-all">{aiError}</p>
                  <button
                    onClick={() => handleAiAnalysis(aiApp)}
                    className="bg-red-600 hover:bg-red-700 text-white text-sm px-5 py-2 rounded-xl transition"
                  >
                    إعادة المحاولة
                  </button>
                </div>
              )}

              {aiReport && !aiLoading && (
                <div className="space-y-4">
                  {/* Score Card */}
                  <div className={`rounded-2xl p-6 text-center border ${scoreBg(aiReport.score)}`}>
                    <p className="text-xs text-[#273347]/50 font-medium mb-2 uppercase tracking-widest">التقييم العام</p>
                    <p className={`text-7xl font-black mb-1 ${scoreColor(aiReport.score)}`}>
                      {aiReport.score}
                      <span className="text-2xl font-normal text-[#273347]/30">/100</span>
                    </p>
                    <div className="w-full bg-white/60 rounded-full h-3 mt-4 overflow-hidden">
                      <div
                        className={`h-3 rounded-full transition-all duration-1000 ${scoreBarColor(aiReport.score)}`}
                        style={{ width: `${aiReport.score}%` }}
                      />
                    </div>
                    {aiReport.local_score !== undefined && aiReport.local_score !== aiReport.score && (
                      <p className="text-xs text-[#273347]/40 mt-2">
                        النقاط الخوارزمية: {aiReport.local_score}/100 · عُدِّلت بعد التحليل
                      </p>
                    )}
                  </div>

                  {/* Status Badges */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`border rounded-xl px-4 py-3 text-sm font-semibold text-center ${recommendationConfig[aiReport.recommendation].color}`}>
                      {recommendationConfig[aiReport.recommendation].label}
                    </div>
                    <div className={`border rounded-xl px-4 py-3 text-sm font-semibold text-center ${riskConfig[aiReport.risk].color}`}>
                      {riskConfig[aiReport.risk].label}
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="space-y-3">
                    <div className="bg-[#f0f4f8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#273347]/50 mb-2 uppercase tracking-wider">📌 نبذة عن المشروع</p>
                      <p className="text-[#273347] text-sm font-medium leading-relaxed">
                        {aiReport.project_summary ||
                          [
                            aiApp.data_json.basic.full_name,
                            accountTypeLabel[aiApp.account_type],
                            Object.values(aiApp.data_json.type_specific).filter(Boolean).slice(0, 2).join("، "),
                            aiApp.data_json.basic.country,
                            aiApp.data_json.basic.city,
                          ].filter(Boolean).join(" — ")}
                      </p>
                    </div>
                    <div className="bg-[#f0f4f8] rounded-xl p-4">
                      <p className="text-xs font-bold text-[#273347]/50 mb-2 uppercase tracking-wider">📋 الملخص السريع</p>
                      <p className="text-[#273347] text-sm font-medium leading-relaxed">{aiReport.summary}</p>
                    </div>
                  </div>

                  {/* Bio Analysis */}
                  <div className="border border-[#e6edf5] rounded-xl overflow-hidden">
                    <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e6edf5] flex items-center justify-between">
                      <p className="text-xs font-bold text-[#273347]/60 uppercase tracking-wider">📝 تحليل النبذة</p>
                      {aiReport._meta && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${bioQualityConfig[aiReport._meta.bioQuality].color}`}>
                          {bioQualityConfig[aiReport._meta.bioQuality].label}
                        </span>
                      )}
                    </div>
                    <div className="p-4 space-y-2">
                      {aiReport._meta && (
                        <div className="flex items-center gap-3 mb-2">
                          <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full ${aiReport._meta.bioScore >= 70 ? "bg-green-500" : aiReport._meta.bioScore >= 40 ? "bg-yellow-500" : "bg-red-500"}`}
                              style={{ width: `${aiReport._meta.bioScore}%` }}
                            />
                          </div>
                          <span className={`text-xs font-bold ${aiReport._meta.bioScore >= 70 ? "text-green-600" : aiReport._meta.bioScore >= 40 ? "text-yellow-600" : "text-red-600"}`}>
                            {aiReport._meta.bioScore}/100
                          </span>
                        </div>
                      )}
                      {aiReport.bio_analysis ? (
                        <p className="text-[#273347]/80 text-sm leading-6">{aiReport.bio_analysis}</p>
                      ) : (
                        <p className="text-[#273347]/40 text-xs">لا يوجد تحليل للنبذة</p>
                      )}
                    </div>
                  </div>

                  {/* Link Analysis */}
                  <div className="border border-[#e6edf5] rounded-xl overflow-hidden">
                    <div className="bg-[#f8fafc] px-4 py-2.5 border-b border-[#e6edf5]">
                      <p className="text-xs font-bold text-[#273347]/60 uppercase tracking-wider">🔗 فحص الروابط</p>
                    </div>
                    <div className="p-4 space-y-3">
                      {aiReport._meta ? (
                        <>
                          <LinkStatusCard meta={aiReport._meta.link1} label="الرابط الأول" />
                          <LinkStatusCard meta={aiReport._meta.link2} label="الرابط الثاني" />
                        </>
                      ) : (
                        <p className="text-[#273347]/40 text-xs">لا تتوفر بيانات فحص الروابط (تقرير قديم)</p>
                      )}
                      {aiReport.link_analysis && (
                        <div className="bg-[#f0f4f8] rounded-lg p-3 mt-2">
                          <p className="text-[#273347]/80 text-sm leading-6">{aiReport.link_analysis}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Detailed Analysis */}
                  <div className="bg-white border border-[#e6edf5] rounded-xl p-4">
                    <p className="text-xs font-bold text-[#273347]/50 mb-2 uppercase tracking-wider">🔎 التحليل التفصيلي</p>
                    <p className="text-[#273347]/80 text-sm leading-7">{aiReport.details}</p>
                  </div>

                  {/* Strengths */}
                  {aiReport.strengths.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-green-700 mb-2">✅ نقاط القوة</p>
                      <ul className="space-y-1.5">
                        {aiReport.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-green-800">
                            <span className="mt-0.5 shrink-0">•</span>{s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Weaknesses */}
                  {aiReport.weaknesses.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-orange-700 mb-2">⚠️ نقاط الضعف</p>
                      <ul className="space-y-1.5">
                        {aiReport.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-orange-800">
                            <span className="mt-0.5 shrink-0">•</span>{w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Flags */}
                  {aiReport.flags.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <p className="text-xs font-bold text-red-700 mb-2">🚩 علامات تستحق الانتباه</p>
                      <ul className="space-y-1.5">
                        {aiReport.flags.map((f, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-red-800">
                            <span className="mt-0.5 shrink-0">•</span>{f}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Decision Hint */}
                  {aiReport.decision_hint && (
                    <div className="bg-[#273347] text-white rounded-xl p-4">
                      <p className="text-xs font-bold text-white/50 mb-1.5">💡 توصية للمدير</p>
                      <p className="text-sm font-semibold leading-relaxed">{aiReport.decision_hint}</p>
                    </div>
                  )}

                  {aiApp.ai_checked && (
                    <p className="text-xs text-emerald-600 text-center font-medium">✅ هذا التقرير محفوظ في قاعدة البيانات</p>
                  )}
                  <p className="text-xs text-[#273347]/30 text-center pb-1">هذا التحليل مساعد فقط — القرار النهائي للمدير</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#273347] text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">{selectedApp.data_json.basic.full_name}</h2>
                <p className="text-sm opacity-70">{accountTypeLabel[selectedApp.account_type]}</p>
              </div>
              <button onClick={() => setSelectedApp(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5">
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">البيانات الأساسية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[
                    { label: "الاسم",    value: selectedApp.data_json.basic.full_name },
                    { label: "الإيميل", value: selectedApp.data_json.basic.email },
                    { label: "الهاتف",  value: selectedApp.data_json.basic.phone },
                    { label: "الدولة",  value: selectedApp.data_json.basic.country },
                  ].map((item) => (
                    <div key={item.label} className="bg-[#f8fafc] rounded-xl p-3">
                      <p className="text-[#273347]/50 text-xs mb-1">{item.label}</p>
                      <p className="text-[#273347] font-medium">{item.value}</p>
                    </div>
                  ))}
                </div>
                {selectedApp.data_json.basic.bio && (
                  <div className="mt-3 bg-[#f8fafc] rounded-xl p-3 text-sm">
                    <p className="text-[#273347]/50 text-xs mb-1">النبذة</p>
                    <p className="text-[#273347]">{selectedApp.data_json.basic.bio}</p>
                  </div>
                )}
              </section>
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">البيانات الإضافية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(selectedApp.data_json.type_specific).map(([key, val]) => (
                    <div key={key} className="bg-[#f8fafc] rounded-xl p-3">
                      <p className="text-[#273347]/50 text-xs mb-1">{key}</p>
                      <p className="text-[#273347] font-medium break-all">{Array.isArray(val) ? val.join("، ") : String(val || "—")}</p>
                    </div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">الإثبات</h3>
                <div className="space-y-2 text-sm">
                  {selectedApp.proof_json.proof_link_1 && (
                    <a href={selectedApp.proof_json.proof_link_1} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all">🔗 {selectedApp.proof_json.proof_link_1}</a>
                  )}
                  {selectedApp.proof_json.proof_link_2 && (
                    <a href={selectedApp.proof_json.proof_link_2} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all">🔗 {selectedApp.proof_json.proof_link_2}</a>
                  )}
                  {selectedApp.proof_json.note && (
                    <p className="text-[#273347]/70 bg-[#f8fafc] rounded-xl p-3">📝 {selectedApp.proof_json.note}</p>
                  )}
                  {selectedApp.proof_json.file_urls?.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all text-xs">📎 ملف {i + 1}</a>
                  ))}
                </div>
              </section>
              {selectedApp.status === "pending" && (
                <section>
                  <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">ملاحظة للمستخدم (اختياري)</h3>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="سيتم إرسالها مع الإيميل للمستخدم..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                  />
                </section>
              )}
              {actionMsg && (
                <div className={`rounded-xl p-3 text-sm ${actionMsg.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {actionMsg}
                </div>
              )}
              {selectedApp.status === "pending" ? (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => handleAction("approved")} disabled={actionLoading}
                    className="flex-1 bg-green-500 hover:bg-green-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                    {actionLoading ? "جارٍ..." : "✅ قبول الطلب"}
                  </button>
                  <button onClick={() => handleAction("rejected")} disabled={actionLoading}
                    className="flex-1 bg-red-500 hover:bg-red-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60">
                    {actionLoading ? "جارٍ..." : "❌ رفض الطلب"}
                  </button>
                </div>
              ) : (
                <div className={`text-center py-3 rounded-xl font-semibold text-sm border ${statusColor[selectedApp.status]}`}>
                  تم {selectedApp.status === "approved" ? "قبول" : "رفض"} هذا الطلب مسبقاً
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}