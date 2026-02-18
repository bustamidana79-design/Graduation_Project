"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [successMsg, setSuccessMsg] = useState<string>("");

  const humanizeSupabaseError = (msg: string) => {
    const m = msg.toLowerCase();

    if (m.includes("invalid login credentials")) {
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    }

    if (m.includes("email not confirmed")) {
      return "يرجى تأكيد البريد الإلكتروني أولًا. تحقّق من البريد الوارد أو الرسائل غير المرغوب فيها.";
    }

    if (m.includes("too many requests")) {
      return "عدد كبير من المحاولات. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى.";
    }

    return "حدث خطأ. يرجى التحقق من البيانات ثم المحاولة مرة أخرى.";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg("يرجى إدخال البريد الإلكتروني وكلمة المرور.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    setLoading(false);

    if (error) {
      setErrorMsg(humanizeSupabaseError(error.message));
      return;
    }

    if (!data?.user) {
      setErrorMsg("تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.");
      return;
    }

    setSuccessMsg("تم تسجيل الدخول بنجاح ✅");
   const { data: profile } = await supabase
  .from("profiles")
  .select("status")
  .eq("id", data.user.id)
  .single();

if (profile?.status === "pending") {
  router.push("/pending");
} else if (profile?.status === "approved") {
  router.push("/dashboard");
} else if (profile?.status === "rejected") {
  router.push("/pending");
}
  };

  const handleResetPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setErrorMsg("يرجى إدخال البريد الإلكتروني أولًا لإرسال رابط إعادة تعيين كلمة المرور.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: "http://localhost:3000/reset-password",
    });

    if (error) {
      setErrorMsg("تعذر إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.");
      return;
    }

      setSuccessMsg("إذا كان البريد الإلكتروني مسجّلاً في النظام، سيتم إرسال رابط إعادة تعيين كلمة المرور.");  };

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />

      <div className="flex justify-center items-center py-20 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-[#e6edf5]">
          <h2 className="text-2xl font-bold text-[#273347] mb-2 text-center">
            تسجيل الدخول
          </h2>

          <p className="text-center text-sm text-[#273347]/70 mb-6">
            أدخل بياناتك للوصول إلى حسابك
          </p>

          <form className="space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-semibold text-[#273347] mb-2">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@email.com"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-[#273347] mb-2">
                كلمة المرور
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
              />

              <div className="mt-2 text-left">
                <button
                  type="button"
                  onClick={handleResetPassword}
                  className="text-sm text-[#546a85] hover:underline"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#bbd0e4] hover:bg-[#a9c2d8] transition duration-300 text-[#273347] font-semibold py-3 rounded-xl disabled:opacity-60"
            >
              {loading ? "جارٍ تسجيل الدخول..." : "دخول"}
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

            <p className="text-center text-sm text-[#273347]/70 pt-2">
              لا يوجد حساب؟{" "}
              <Link
                href="/register"
                className="text-[#546a85] font-semibold hover:underline"
              >
                إنشاء حساب جديد
              </Link>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}