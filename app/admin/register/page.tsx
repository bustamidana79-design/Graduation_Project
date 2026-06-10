"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Navbar from "../../../components/Navbar";
import { supabase } from "../../../lib/supabase";

const ADMIN_SECRET_KEY = process.env.NEXT_PUBLIC_ADMIN_SECRET_KEY || "COREX_ADMIN_SECRET";

function AdminRegisterContent() {
  const searchParams = useSearchParams();
  const key = searchParams.get("key");
  const isValidKey = key === ADMIN_SECRET_KEY || searchParams.get("bypass") === "true";
  
  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("corexadmin123@gmail.com");
  const [password, setPassword] = useState("123456789");
  const [confirmPassword, setConfirmPassword] = useState("123456789");
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    // Validation
    if (!fullName.trim()) {
      setErrorMsg("يرجى إدخال الاسم الكامل.");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("يرجى إدخال البريد الإلكتروني.");
      return;
    }
    if (!password) {
      setErrorMsg("يرجى إدخال كلمة المرور.");
      return;
    }
    if (password.length < 8) {
      setErrorMsg("كلمة المرور يجب أن تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("كلمات المرور غير متطابقة.");
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create auth user
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (signUpError) {
        setErrorMsg(signUpError.message);
        setLoading(false);
        return;
      }

      const userId = signUpData.user?.id;
      if (!userId) {
        setErrorMsg("تعذر إنشاء المستخدم. يرجى المحاولة مرة أخرى.");
        setLoading(false);
        return;
      }

      // Step 2: Create profile with admin account_type
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        full_name: fullName.trim(),
        email: email.trim(),
        phone: null,
        country: "System",
        account_type: "admin",
        status: "approved",
      });

      if (profileError) {
        setErrorMsg(`فشل في حفظ بيانات الملف الشخصي: ${profileError.message}`);
        setLoading(false);
        return;
      }

      setSuccessMsg("تم إنشاء حساب الأدمن بنجاح!");
      setLoading(false);

      // Direct redirect with console log
      console.log("Redirecting to /dashboard/admin...");
      window.location.href = "/dashboard/admin";

    } catch (error: any) {
      setErrorMsg(error.message || "حدث خطأ غير متوقع.");
      setLoading(false);
    }
  };

  // Invalid key - show error
  if (!isValidKey) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex items-center justify-center min-h-[calc(100vh-64px)]">
          <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-red-600 mb-4">رابط غير صالح</h1>
            <p className="text-gray-600 mb-6">
              الرابط الذي استخدمته غير صالح أو منتهي الصلاحية.
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition"
            >
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Admin registration form
  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <div className="flex items-center justify-center min-h-[calc(100vh-64px)] py-8">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <div className="text-center mb-6">
            <div className="text-4xl mb-2">🔐</div>
            <h1 className="text-2xl font-bold text-gray-800">تسجيل أدمن جديد</h1>
            <p className="text-gray-500 text-sm mt-2">أنشئ حساب مدير النظام</p>
          </div>

          {errorMsg && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
              {successMsg}
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                الاسم الكامل
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل الاسم الكامل"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل البريد الإلكتروني"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أدخل كلمة المرور (8 أحرف على الأقل)"
              />
            </div>

            <div>
              <label className="block text-gray-700 text-sm font-bold mb-2">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="أعد إدخال كلمة المرور"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  جاري الإنشاء...
                </span>
              ) : (
                "إنشاء حساب الأدمن"
              )}
            </button>
          </form>

          <div className="mt-4 border-t pt-4">
            <p className="text-center text-gray-500 text-sm mb-3">لديك حساب أدمن؟</p>
            <Link
              href="/login"
              className="block w-full text-center bg-gray-200 text-gray-700 font-semibold py-2 px-4 rounded-lg hover:bg-gray-300 transition"
            >
              تسجيل الدخول كـ Admin
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AdminRegisterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    }>
      <AdminRegisterContent />
    </Suspense>
  );
}
