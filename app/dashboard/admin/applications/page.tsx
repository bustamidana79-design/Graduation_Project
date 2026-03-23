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

type AIReport = {
  score: number;
  recommendation: "approve" | "reject" | "review";
  reasons: string[];
  risks: string[];
  summary: string;
  risk?: "low" | "medium" | "high";
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
  approve: { label: "يُنصح بالقبول", color: "bg-green-100 text-green-700 border-green-300" },
  reject: { label: "يُنصح بالرفض", color: "bg-red-100 text-red-700 border-red-300" },
  review: { label: "يحتاج مراجعة إضافية", color: "bg-yellow-100 text-yellow-700 border-yellow-300" },
};

const riskConfig = {
  low: { label: "مخاطر منخفضة", color: "bg-green-50 text-green-700 border-green-200" },
  medium: { label: "مخاطر متوسطة", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  high: { label: "مخاطر عالية", color: "bg-red-50 text-red-700 border-red-200" },
};

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<"all" | ApplicationStatus>("all");
  const [filterType, setFilterType] = useState("all");
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const [aiApp, setAiApp] = useState<Application | null>(null);
  const [aiReport, setAiReport] = useState<AIReport | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => { fetchApplications(); }, []);
  useEffect(() => { setCurrentPage(1); }, [filterStatus, filterType, searchQuery]);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("applications").select("*").order("created_at", { ascending: false });
    if (!error && data) setApplications(data as Application[]);
    setLoading(false);
  };

  const runAiAnalysis = async (app: Application) => {
    setAiApp(app);
    setAiReport(null);
    setAiError("");
    setAiLoading(true);

    // إذا عنده تحليل محفوظ، اعرضه مباشرة
    if (app.ai_checked && app.ai_score !== undefined) {
      setAiReport({
        score: app.ai_score,
        recommendation: app.ai_recommendation ?? "review",
        summary: app.ai_reason || "—",
        reasons: [],
        risks: [],
        risk: app.ai_risk,
      });
      setAiLoading(false);
      return;
    }

    // إذا ما عنده تحليل، اعمل تحليل جديد عبر Groq
    try {
      const res = await fetch("/api/ai/evaluate-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: app.data_json.basic.full_name,
          email: app.data_json.basic.email,
          bio: app.data_json.basic.bio,
          account_type: app.account_type,
          country: app.data_json.basic.country,
          data: app.data_json.type_specific,
          proof: {
            proof_link_1: app.proof_json.proof_link_1,
            proof_link_2: app.proof_json.proof_link_2,
            files: app.proof_json.file_urls,
          },
        }),
      });

      const result = await res.json();

      // حفظ النتيجة في Supabase
      await supabase.from("applications").update({
        ai_score: result.score,
        ai_recommendation: result.decision,
        ai_reason: result.reason,
        ai_risk: result.risk,
        ai_checked: true,
      }).eq("id", app.id);

      // تحديث الـ state محلياً
      setApplications((prev) =>
        prev.map((a) => a.id === app.id ? {
          ...a,
          ai_score: result.score,
          ai_recommendation: result.decision,
          ai_reason: result.reason,
          ai_risk: result.risk,
          ai_checked: true,
        } : a)
      );

      setAiReport({
        score: result.score,
        recommendation: result.decision === "approve" ? "approve" : result.decision === "reject" ? "reject" : "review",
        summary: result.reason || "—",
        reasons: [],
        risks: result.flags || [],
        risk: result.risk,
      });

    } catch {
      setAiError("حدث خطأ أثناء التحليل. حاولي مرة أخرى.");
    } finally {
      setAiLoading(false);
    }
  };

  const sendEmail = async (email: string, fullName: string, status: "approved" | "rejected", note: string) => {
    const subject = status === "approved"
      ? "تهانينا! تم قبول طلبك في منصة الموردين"
      : "بخصوص طلب إنشاء حسابك في منصة الموردين";

    const loginLink = `${BASE_URL}/login`;
    const registerLink = `${BASE_URL}/register`;

    const bodyText = status === "approved"
      ? `عزيزي ${fullName}،\n\nيسعدنا إبلاغك بأنه تم قبول طلب إنشاء حسابك في منصة الموردين.\n${note ? `\nملاحظة من الإدارة: ${note}\n` : ""}\nيمكنك الآن تسجيل الدخول من هنا:\n${loginLink}\n\nفريق منصة الموردين`
      : `عزيزي ${fullName}،\n\nنأسف لإبلاغك بأنه تم رفض طلب إنشاء حسابك في منصة الموردين.\n${note ? `\nسبب الرفض: ${note}\n` : ""}\nيمكنك إعادة التسجيل من هنا:\n${registerLink}\n\nفريق منصة الموردين`;

    await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: email, subject, body: bodyText }),
    });
  };

  const handleAction = async (status: "approved" | "rejected") => {
    if (!selectedApp) return;
    setActionLoading(true);
    setActionMsg("");
    try {
      const { error: appError } = await supabase.from("applications").update({ status, admin_note: adminNote.trim() || null }).eq("id", selectedApp.id);
      if (appError) throw new Error(appError.message);
      const { error: profileError } = await supabase.from("profiles").update({ status }).eq("id", selectedApp.user_id);
      if (profileError) throw new Error(profileError.message);
      await sendEmail(selectedApp.data_json.basic.email, selectedApp.data_json.basic.full_name, status, adminNote.trim());
      setActionMsg(status === "approved" ? "✅ تم قبول الطلب وإرسال الإيميل." : "❌ تم رفض الطلب وإرسال الإيميل.");
      setApplications((prev) => prev.map((a) => (a.id === selectedApp.id ? { ...a, status } : a)));
      setSelectedApp(null);
      setAdminNote("");
    } catch (err: any) {
      setActionMsg(`حدث خطأ: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = applications.filter((a) => {
    const matchStatus = filterStatus === "all" || a.status === filterStatus;
    const matchType = filterType === "all" || a.account_type === filterType;
    const matchSearch = !searchQuery || a.data_json.basic.full_name.includes(searchQuery) || a.data_json.basic.email.includes(searchQuery);
    return matchStatus && matchType && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  const scoreColor = (s: number) => s >= 70 ? "text-green-600" : s >= 40 ? "text-yellow-600" : "text-red-600";
  const scoreBarColor = (s: number) => s >= 70 ? "bg-green-500" : s >= 40 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#273347] mb-6">الطلبات</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "الكل", count: counts.all, color: "bg-[#273347] text-white" },
          { label: "قيد المراجعة", count: counts.pending, color: "bg-yellow-50 text-yellow-700 border border-yellow-200" },
          { label: "مقبول", count: counts.approved, color: "bg-green-50 text-green-700 border border-green-200" },
          { label: "مرفوض", count: counts.rejected, color: "bg-red-50 text-red-700 border border-red-200" },
        ].map((stat) => (
          <div key={stat.label} className={`rounded-2xl p-5 ${stat.color}`}>
            <p className="text-3xl font-bold">{stat.count}</p>
            <p className="text-sm mt-1 opacity-80">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-[#e6edf5] p-5 mb-6 flex flex-wrap gap-4 items-center">
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث بالاسم أو الإيميل..." className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] flex-1 min-w-[200px]" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as any)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]">
          <option value="all">كل الأنواع</option>
          <option value="merchant">تاجر (جملة)</option>
          <option value="small_business">مشروع صغير</option>
          <option value="delivery">شركة توصيل</option>
          <option value="supporter">داعم / مستثمر</option>
        </select>
        <button onClick={fetchApplications} className="bg-[#273347] text-white text-sm px-5 py-2 rounded-xl hover:bg-[#1e2a38] transition">تحديث</button>
      </div>

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
                    <td className="px-5 py-4"><span className="bg-[#eef3f8] text-[#273347] px-3 py-1 rounded-lg text-xs font-medium">{accountTypeLabel[app.account_type] || app.account_type}</span></td>
                    <td className="px-5 py-4 text-[#273347]/70">{app.data_json.basic.country}</td>
                    <td className="px-5 py-4 text-[#273347]/60">{new Date(app.created_at).toLocaleDateString("ar-EG")}</td>
                    <td className="px-5 py-4"><span className={`border px-3 py-1 rounded-lg text-xs font-medium ${statusColor[app.status]}`}>{statusLabel[app.status]}</span></td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setSelectedApp(app); setAdminNote(""); setActionMsg(""); }} className="text-[#546a85] hover:text-[#273347] font-semibold text-xs underline underline-offset-2">التفاصيل</button>
                        <button
                          onClick={() => runAiAnalysis(app)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${app.ai_checked ? "bg-green-600 hover:bg-green-700 text-white" : "bg-[#273347] hover:bg-[#1e2a38] text-white"}`}
                        >
                          {app.ai_checked ? "✅ AI" : "✨ AI"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between px-5 py-4 border-t border-[#e6edf5] bg-[#f8fafc]">
              <p className="text-xs text-[#273347]/50">عرض {((currentPage - 1) * ITEMS_PER_PAGE) + 1}–{Math.min(currentPage * ITEMS_PER_PAGE, filtered.length)} من {filtered.length} طلب</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e6edf5] text-[#273347] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm">«</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).reduce<(number | "...")[]>((acc, p, idx, arr) => { if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("..."); acc.push(p); return acc; }, []).map((item, idx) =>
                  item === "..." ? <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-[#273347]/40 text-xs">...</span> :
                  <button key={item} onClick={() => setCurrentPage(item as number)} className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition ${currentPage === item ? "bg-[#273347] text-white" : "border border-[#e6edf5] text-[#273347] hover:bg-white"}`}>{item}</button>
                )}
                <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#e6edf5] text-[#273347] hover:bg-white disabled:opacity-30 disabled:cursor-not-allowed transition text-sm">»</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Modal */}
      {aiApp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="bg-[#273347] text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div><h2 className="text-lg font-bold">✨ تحليل AI</h2><p className="text-sm opacity-70">{aiApp.data_json.basic.full_name}</p></div>
              <button onClick={() => { setAiApp(null); setAiReport(null); setAiError(""); }} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6">
              {aiLoading && <div className="text-center py-12"><div className="text-4xl mb-4 animate-pulse">🤖</div><p className="text-[#273347]/60 text-sm">جارٍ تحليل الطلب...</p></div>}
              {aiError && <div className="bg-red-50 text-red-700 rounded-xl p-4 text-sm text-center">{aiError}<button onClick={() => runAiAnalysis(aiApp)} className="block mx-auto mt-3 text-xs underline">حاولي مرة أخرى</button></div>}
              {aiReport && (
                <div className="space-y-5">
                  <div className="text-center bg-[#f8fafc] rounded-2xl p-6">
                    <p className="text-xs text-[#273347]/50 mb-1">تقييم AI</p>
                    <p className={`text-6xl font-bold mb-2 ${scoreColor(aiReport.score)}`}>{aiReport.score}<span className="text-2xl text-[#273347]/30">/100</span></p>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-3"><div className={`h-2 rounded-full transition-all ${scoreBarColor(aiReport.score)}`} style={{ width: `${aiReport.score}%` }} /></div>
                  </div>
                  <div className={`border rounded-xl px-4 py-3 text-sm font-semibold text-center ${recommendationConfig[aiReport.recommendation].color}`}>{recommendationConfig[aiReport.recommendation].label}</div>
                  {aiReport.risk && (
                    <div className={`border rounded-xl px-4 py-3 text-sm font-semibold text-center ${riskConfig[aiReport.risk].color}`}>{riskConfig[aiReport.risk].label}</div>
                  )}
                  <div className="bg-[#f8fafc] rounded-xl p-4 text-sm text-[#273347]"><p className="text-xs text-[#273347]/50 mb-1 font-semibold">الملخص</p>{aiReport.summary}</div>
                  {aiReport.reasons.length > 0 && <div><p className="text-xs font-semibold text-[#273347]/50 mb-2">✅ نقاط إيجابية</p><ul className="space-y-2">{aiReport.reasons.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-4 py-2"><span>•</span>{r}</li>)}</ul></div>}
                  {aiReport.risks.length > 0 && <div><p className="text-xs font-semibold text-[#273347]/50 mb-2">⚠️ علامات مشبوهة</p><ul className="space-y-2">{aiReport.risks.map((r, i) => <li key={i} className="flex items-start gap-2 text-sm text-red-700 bg-red-50 rounded-xl px-4 py-2"><span>•</span>{r}</li>)}</ul></div>}
                  {aiApp.ai_checked && <p className="text-xs text-green-600 text-center">✅ هذا التحليل محفوظ مسبقاً</p>}
                  <p className="text-xs text-[#273347]/30 text-center pt-2">هذا التحليل مساعد فقط — القرار النهائي للمدير</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {selectedApp && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-[#273347] text-white px-6 py-5 rounded-t-2xl flex items-center justify-between">
              <div><h2 className="text-lg font-bold">{selectedApp.data_json.basic.full_name}</h2><p className="text-sm opacity-70">{accountTypeLabel[selectedApp.account_type]}</p></div>
              <button onClick={() => setSelectedApp(null)} className="text-white/70 hover:text-white text-2xl leading-none">×</button>
            </div>
            <div className="p-6 space-y-5">
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">البيانات الأساسية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {[{ label: "الاسم", value: selectedApp.data_json.basic.full_name }, { label: "الإيميل", value: selectedApp.data_json.basic.email }, { label: "الهاتف", value: selectedApp.data_json.basic.phone }, { label: "الدولة", value: selectedApp.data_json.basic.country }].map((item) => (
                    <div key={item.label} className="bg-[#f8fafc] rounded-xl p-3"><p className="text-[#273347]/50 text-xs mb-1">{item.label}</p><p className="text-[#273347] font-medium">{item.value}</p></div>
                  ))}
                </div>
                {selectedApp.data_json.basic.bio && <div className="mt-3 bg-[#f8fafc] rounded-xl p-3 text-sm"><p className="text-[#273347]/50 text-xs mb-1">النبذة</p><p className="text-[#273347]">{selectedApp.data_json.basic.bio}</p></div>}
              </section>
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">البيانات الإضافية</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {Object.entries(selectedApp.data_json.type_specific).map(([key, val]) => (
                    <div key={key} className="bg-[#f8fafc] rounded-xl p-3"><p className="text-[#273347]/50 text-xs mb-1">{key}</p><p className="text-[#273347] font-medium break-all">{Array.isArray(val) ? val.join("، ") : String(val || "—")}</p></div>
                  ))}
                </div>
              </section>
              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">الإثبات</h3>
                <div className="space-y-2 text-sm">
                  {selectedApp.proof_json.proof_link_1 && <a href={selectedApp.proof_json.proof_link_1} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all">🔗 {selectedApp.proof_json.proof_link_1}</a>}
                  {selectedApp.proof_json.proof_link_2 && <a href={selectedApp.proof_json.proof_link_2} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all">🔗 {selectedApp.proof_json.proof_link_2}</a>}
                  {selectedApp.proof_json.note && <p className="text-[#273347]/70 bg-[#f8fafc] rounded-xl p-3">📝 {selectedApp.proof_json.note}</p>}
                  {selectedApp.proof_json.file_urls?.map((url, i) => <a key={i} href={url} target="_blank" rel="noreferrer" className="block text-[#546a85] hover:underline break-all text-xs">📎 ملف {i + 1}</a>)}
                </div>
              </section>
              {selectedApp.status === "pending" && (
                <section>
                  <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">ملاحظة للمستخدم (اختياري)</h3>
                  <textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)} rows={3} placeholder="سيتم إرسالها مع الإيميل للمستخدم..." className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]" />
                </section>
              )}
              {actionMsg && <div className={`rounded-xl p-3 text-sm ${actionMsg.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>{actionMsg}</div>}
              {selectedApp.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => handleAction("approved")} disabled={actionLoading} className="flex-1 bg-green-500 hover:bg-green-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60">{actionLoading ? "جارٍ..." : "✅ قبول الطلب"}</button>
                  <button onClick={() => handleAction("rejected")} disabled={actionLoading} className="flex-1 bg-red-500 hover:bg-red-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60">{actionLoading ? "جارٍ..." : "❌ رفض الطلب"}</button>
                </div>
              )}
              {selectedApp.status !== "pending" && (
                <div className={`text-center py-3 rounded-xl font-semibold text-sm border ${statusColor[selectedApp.status]}`}>تم {selectedApp.status === "approved" ? "قبول" : "رفض"} هذا الطلب مسبقاً</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
