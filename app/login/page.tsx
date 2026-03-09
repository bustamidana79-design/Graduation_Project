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
  const [statusMsg, setStatusMsg] = useState<"pending" | "verify_email" | "rejected" | null>(null);

  const humanizeSupabaseError = (msg: string) => {
    const m = msg.toLowerCase();
    if (m.includes("invalid login credentials"))
      return "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
    if (m.includes("too many requests"))
      return "عدد كبير من المحاولات. يرجى الانتظار قليلًا ثم المحاولة مرة أخرى.";
    return "حدث خطأ. يرجى التحقق من البيانات ثم المحاولة مرة أخرى.";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    setStatusMsg(null);

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
      if (error.message.toLowerCase().includes("email not confirmed")) {
        // نفحص الـ status أولاً — لأن البريد غير مؤكد ممكن يكون حساب pending
        const { data: profileByEmail } = await supabase
          .from("profiles")
          .select("status")
          .eq("email", cleanEmail)
          .maybeSingle();

        if (profileByEmail?.status === "pending") {
          setStatusMsg("pending");
        } else if (profileByEmail?.status === "rejected") {
          setStatusMsg("rejected");
        } else {
          // approved أو ما لقيناه → يفتح رابط التأكيد
          setStatusMsg("verify_email");
        }
        return;
      }

      setErrorMsg(humanizeSupabaseError(error.message));
      return;
    }

    if (!data?.user) {
      setErrorMsg("تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.");
      return;
    }

    // تسجيل ناجح — نفحص الـ profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("status, email_verified")
      .eq("id", data.user.id)
      .single();

    if (profile?.status === "pending") {
      await supabase.auth.signOut();
      setStatusMsg("pending");
      return;
    }

    if (profile?.status === "rejected") {
      await supabase.auth.signOut();
      setStatusMsg("rejected");
      return;
    }

    if (profile?.status === "approved") {
      if (!profile.email_verified) {
        await supabase.auth.signOut();
        setStatusMsg("verify_email");
        return;
      }
      setSuccessMsg("تم تسجيل الدخول بنجاح ✅");
      router.push("/dashboard");
      return;
    }

setSuccessMsg("تم تسجيل الدخول بنجاح ✅");
router.push("/dashboard/small-business");
return;

    await supabase.auth.signOut();
    setErrorMsg("حدث خطأ غير متوقع. يرجى التواصل مع الإدارة.");
  };

  const handleResetPassword = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    setStatusMsg(null);

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

    setSuccessMsg("إذا كان البريد الإلكتروني مسجّلاً في النظام، سيتم إرسال رابط إعادة تعيين كلمة المرور.");
  };

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

            {/* طلب قيد المراجعة */}
            {statusMsg === "pending" && (
              <div className="bg-[#f1f5f9] border border-[#bbd0e4] rounded-xl p-4 text-sm text-[#273347] space-y-1">
                <p className="font-semibold">طلبك لا يزال قيد المراجعة</p>
                <p className="text-[#273347]/70 leading-relaxed">
                  سنتواصل معك عبر البريد الإلكتروني فور الانتهاء من المراجعة.
                </p>
              </div>
            )}

            {/* يحتاج فتح رابط التأكيد */}
            {statusMsg === "verify_email" && (
              <div className="bg-[#f1f5f9] border border-[#bbd0e4] rounded-xl p-4 text-sm text-[#273347] space-y-1">
                <p className="font-semibold">يرجى تفعيل حسابك</p>
                <p className="text-[#273347]/70 leading-relaxed">
                  يرجى فتح رابط التأكيد المُرسل إلى بريدك الإلكتروني، تحقّق
                  من البريد الوارد أو مجلد الرسائل غير المرغوب فيها (Spam).
                </p>
              </div>
            )}

            {/* مرفوض */}
            {statusMsg === "rejected" && (
              <div className="bg-[#f1f5f9] border border-[#bbd0e4] rounded-xl p-4 text-sm text-[#273347] space-y-1">
                <p className="font-semibold">تم الرد على طلبك</p>
                <p className="text-[#273347]/70 leading-relaxed">
                  يرجى مراجعة بريدك الإلكتروني للاطلاع على رد الإدارة.
                </p>
              </div>
            )}

            {/* خطأ عادي */}
            {errorMsg && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-3 text-sm">
                {errorMsg}
              </div>
            )}

            {/* نجاح */}
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