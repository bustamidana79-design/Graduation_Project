"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../../components/Navbar";
import { supabase } from "../../../lib/supabase";

export default function AuthResetPasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isValidToken, setIsValidToken] = useState(false);
  const [checkingToken, setCheckingToken] = useState(true);

  // التحقق من أن المستخدم جاء من رابط الإيميل الصحيح
  useEffect(() => {
    const checkToken = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (data.session) {
        setIsValidToken(true);
      } else {
        setIsValidToken(false);
        setErrorMsg("رابط غير صحيح أو انتهى الصلاحية. يرجى طلب إيميل جديد.");
      }
      setCheckingToken(false);
    };
    checkToken();
  }, []);

  const validatePassword = (password: string): string | null => {
    if (password.length < 8) return "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
    if (!/[A-Z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف كبير.";
    if (!/[a-z]/.test(password)) return "يجب أن تحتوي كلمة المرور على حرف صغير.";
    if (!/[0-9]/.test(password)) return "يجب أن تحتوي كلمة المرور على رقم.";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
      return "يجب أن تحتوي كلمة المرور على رمز خاص (!@#$...).";
    return null;
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!newPassword || !confirmPassword) {
      setErrorMsg("يرجى إدخال كلمة المرور الجديدة وتأكيدها.");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setErrorMsg(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setLoading(false);

    if (error) {
      setErrorMsg("تعذر تحديث كلمة المرور. يرجى المحاولة مرة أخرى.");
      console.error("Password update error:", error);
      return;
    }

    setSuccessMsg("تم تحديث كلمة المرور بنجاح! ✅");
    setTimeout(() => router.push("/dashboard"), 1500);
  };

  if (checkingToken) {
    return (
      <main className="min-h-screen bg-[#f8fafc]">
        <Navbar />
        <div className="flex justify-center items-center py-20 px-4">
          <div className="text-center">
            <p className="text-gray-600">جاري التحقق من الرابط...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f8fafc]">
      <Navbar />

      <div className="flex justify-center items-center py-20 px-4">
        <div className="bg-white shadow-lg rounded-2xl p-8 w-full max-w-md border border-[#e6edf5]">
          <h2 className="text-2xl font-bold text-[#273347] mb-2 text-center">
            تعيين كلمة المرور الجديدة
          </h2>

          <p className="text-center text-sm text-[#273347]/70 mb-6">
            أدخل كلمة مرور قوية وآمنة للحساب
          </p>

          {!isValidToken ? (
            <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl p-4 text-sm">
              {errorMsg}
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleUpdatePassword}>
              <div>
                <label className="block text-sm font-semibold text-[#273347] mb-2">
                  كلمة المرور الجديدة
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                  disabled={loading}
                />
                <p className="mt-1 text-xs text-[#273347]/60">
                  8 أحرف على الأقل، حرف كبير وصغير، رقم، ورمز خاص (!@#$...).
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-[#273347] mb-2">
                  تأكيد كلمة المرور
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4]"
                  disabled={loading}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#bbd0e4] hover:bg-[#a9c2d8] transition duration-300 text-[#273347] font-semibold py-3 rounded-xl disabled:opacity-60"
              >
                {loading ? "جارٍ الحفظ..." : "تحديث كلمة المرور"}
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
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
