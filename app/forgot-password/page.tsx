"use client";

import { useState } from "react";
import Link from "next/link";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";
import { getClientAppUrl } from "@/lib/app-url";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!email) {
      setErrorMsg("يرجى إدخال بريدك الإلكتروني.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMsg("يرجى إدخال بريد إلكتروني صحيح.");
      return;
    }

    setLoading(true);

    const appUrl = getClientAppUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/reset-password`,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("تعذر إرسال الإيميل. تحقق من البريد الإلكتروني والمحاولة مرة أخرى.");
      return;
    }

    setSuccessMsg("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. 📧");
    setEmail("");
  };

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />

      <div className="flex justify-center items-center py-20 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-[#e6edf5]">
          <h2 className="text-2xl font-bold text-[#273347] mb-2 text-center">
            نسيت كلمة المرور؟
          </h2>

          <p className="text-center text-sm text-[#273347]/70 mb-6">
            أدخل بريدك الإلكتروني وسنرسل لك رابط لتعيين كلمة مرور جديدة
          </p>

          <form className="space-y-4" onSubmit={handleSendResetEmail}>
            <div>
              <label className="block text-sm font-semibold text-[#273347] mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                disabled={loading}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#bbd0e4] hover:bg-[#a9c2d8] transition duration-300 text-[#273347] font-semibold py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? "جاري الإرسال..." : "إرسال رابط إعادة التعيين"}
            </button>

            {errorMsg && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
                {errorMsg}
              </div>
            )}

            {successMsg && (
              <div className="bg-green-50 text-green-700 border border-green-200 rounded-xl p-3 text-sm">
                {successMsg}
              </div>
            )}

            <div className="text-center mt-4">
              <p className="text-sm text-[#273347]/70">
                هل تتذكر كلمة المرور؟{" "}
                <Link href="/login" className="text-[#bbd0e4] hover:underline font-semibold">
                  سجّل الدخول
                </Link>
              </p>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
