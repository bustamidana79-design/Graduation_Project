// app/admin/applications/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";

type ApplicationStatus = "pending" | "approved" | "rejected";

type Application = {
  id: string;
  user_id: string;
  account_type: string;
  status: ApplicationStatus;
  created_at: string;
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

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error && data) setApplications(data as Application[]);
    setLoading(false);
  };

  const sendEmail = async (
    email: string,
    fullName: string,
    status: "approved" | "rejected",
    note: string
  ) => {
    const subject =
      status === "approved"
        ? "تهانينا! تم قبول طلبك في منصة الموردين"
        : "بخصوص طلب إنشاء حسابك في منصة الموردين";

    const bodyText =
      status === "approved"
        ? `عزيزي ${fullName}،\n\nيسعدنا إبلاغك بأنه تم قبول طلب إنشاء حسابك في منصة الموردين.\nيمكنك الآن تسجيل الدخول والبدء باستخدام المنصة.\n${note ? `\nملاحظة من الإدارة: ${note}` : ""}\n\nفريق منصة الموردين`
        : `عزيزي ${fullName}،\n\nنأسف لإبلاغك بأنه تم رفض طلب إنشاء حسابك في منصة الموردين.\n${note ? `\nسبب الرفض: ${note}` : ""}\n\nيمكنك التواصل معنا لمزيد من التوضيح.\n\nفريق منصة الموردين`;

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
      const { error: appError } = await supabase
        .from("applications")
        .update({ status, admin_note: adminNote.trim() || null })
        .eq("id", selectedApp.id);
      if (appError) throw new Error(appError.message);

      const { error: profileError } = await supabase
        .from("profiles")
        .update({ status })
        .eq("id", selectedApp.user_id);
      if (profileError) throw new Error(profileError.message);

      await sendEmail(
        selectedApp.data_json.basic.email,
        selectedApp.data_json.basic.full_name,
        status,
        adminNote.trim()
      );

      setActionMsg(status === "approved" ? "✅ تم قبول الطلب وإرسال الإيميل." : "❌ تم رفض الطلب وإرسال الإيميل.");
      setApplications((prev) =>
        prev.map((a) => (a.id === selectedApp.id ? { ...a, status } : a))
      );
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
    const matchSearch =
      !searchQuery ||
      a.data_json.basic.full_name.includes(searchQuery) ||
      a.data_json.basic.email.includes(searchQuery);
    return matchStatus && matchType && matchSearch;
  });

  const counts = {
    all: applications.length,
    pending: applications.filter((a) => a.status === "pending").length,
    approved: applications.filter((a) => a.status === "approved").length,
    rejected: applications.filter((a) => a.status === "rejected").length,
  };

  return (
    <div className="p-8" dir="rtl">
      <h1 className="text-2xl font-bold text-[#273347] mb-6">الطلبات</h1>

      {/* Stats */}
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

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-[#e6edf5] p-5 mb-6 flex flex-wrap gap-4 items-center">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو الإيميل..."
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] flex-1 min-w-[200px]"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
        >
          <option value="all">كل الحالات</option>
          <option value="pending">قيد المراجعة</option>
          <option value="approved">مقبول</option>
          <option value="rejected">مرفوض</option>
        </select>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-xl px-4 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
        >
          <option value="all">كل الأنواع</option>
          <option value="merchant">تاجر (جملة)</option>
          <option value="small_business">مشروع صغير</option>
          <option value="delivery">شركة توصيل</option>
          <option value="supporter">داعم / مستثمر</option>
        </select>
        <button
          onClick={fetchApplications}
          className="bg-[#273347] text-white text-sm px-5 py-2 rounded-xl hover:bg-[#1e2a38] transition"
        >
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
              {filtered.map((app, i) => (
                <tr
                  key={app.id}
                  className={`border-b border-[#e6edf5] hover:bg-[#f8fafc] transition ${i % 2 === 0 ? "" : "bg-[#fafbfc]"}`}
                >
                  <td className="px-5 py-4 font-medium text-[#273347]">{app.data_json.basic.full_name}</td>
                  <td className="px-5 py-4 text-[#273347]/70">{app.data_json.basic.email}</td>
                  <td className="px-5 py-4">
                    <span className="bg-[#eef3f8] text-[#273347] px-3 py-1 rounded-lg text-xs font-medium">
                      {accountTypeLabel[app.account_type] || app.account_type}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-[#273347]/70">{app.data_json.basic.country}</td>
                  <td className="px-5 py-4 text-[#273347]/60">
                    {new Date(app.created_at).toLocaleDateString("ar-EG")}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`border px-3 py-1 rounded-lg text-xs font-medium ${statusColor[app.status]}`}>
                      {statusLabel[app.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <button
                      onClick={() => { setSelectedApp(app); setAdminNote(""); setActionMsg(""); }}
                      className="text-[#546a85] hover:text-[#273347] font-semibold text-xs underline underline-offset-2"
                    >
                      عرض التفاصيل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
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
                    { label: "الاسم", value: selectedApp.data_json.basic.full_name },
                    { label: "الإيميل", value: selectedApp.data_json.basic.email },
                    { label: "الهاتف", value: selectedApp.data_json.basic.phone },
                    { label: "الدولة", value: selectedApp.data_json.basic.country },
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
                      <p className="text-[#273347] font-medium break-all">
                        {Array.isArray(val) ? val.join("، ") : String(val || "—")}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">الإثبات</h3>
                <div className="space-y-2 text-sm">
                  {selectedApp.proof_json.proof_link_1 && (
                    <a href={selectedApp.proof_json.proof_link_1} target="_blank" rel="noreferrer"
                      className="block text-[#546a85] hover:underline break-all">
                      🔗 {selectedApp.proof_json.proof_link_1}
                    </a>
                  )}
                  {selectedApp.proof_json.proof_link_2 && (
                    <a href={selectedApp.proof_json.proof_link_2} target="_blank" rel="noreferrer"
                      className="block text-[#546a85] hover:underline break-all">
                      🔗 {selectedApp.proof_json.proof_link_2}
                    </a>
                  )}
                  {selectedApp.proof_json.note && (
                    <p className="text-[#273347]/70 bg-[#f8fafc] rounded-xl p-3">📝 {selectedApp.proof_json.note}</p>
                  )}
                  {selectedApp.proof_json.file_urls && selectedApp.proof_json.file_urls.length > 0 && (
                    <div className="space-y-1">
                      {selectedApp.proof_json.file_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer"
                          className="block text-[#546a85] hover:underline break-all text-xs">
                          📎 ملف {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {selectedApp.status === "pending" && (
                <section>
                  <h3 className="text-sm font-bold text-[#273347] mb-3 border-b border-[#e6edf5] pb-2">ملاحظة للمستخدم (اختياري)</h3>
                  <textarea
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    rows={3}
                    placeholder="سيتم إرسالها مع الإيميل..."
                    className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                  />
                </section>
              )}

              {actionMsg && (
                <div className={`rounded-xl p-3 text-sm ${actionMsg.startsWith("✅") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
                  {actionMsg}
                </div>
              )}

              {selectedApp.status === "pending" && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleAction("approved")}
                    disabled={actionLoading}
                    className="flex-1 bg-green-500 hover:bg-green-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60"
                  >
                    {actionLoading ? "جارٍ..." : "✅ قبول الطلب"}
                  </button>
                  <button
                    onClick={() => handleAction("rejected")}
                    disabled={actionLoading}
                    className="flex-1 bg-red-500 hover:bg-red-600 transition text-white font-semibold py-3 rounded-xl disabled:opacity-60"
                  >
                    {actionLoading ? "جارٍ..." : "❌ رفض الطلب"}
                  </button>
                </div>
              )}

              {selectedApp.status !== "pending" && (
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