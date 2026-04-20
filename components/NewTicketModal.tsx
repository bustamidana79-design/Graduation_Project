"use client";
import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// إعداد سوبابيس باستخدام القيم الموجودة في ملف env.local الخاص بك
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Props {
  isOpen: boolean;
  userRole: "small-business" | "supplier" | "delivery" | "shipping-company"  | "supporter" | "admin";
  onClose: () => void;
}

export default function NewTicketModal({ isOpen, onClose, userRole }: Props) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // جلب الـ ID الخاص بالمستخدم الحالي عند فتح الـ Modal
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      } else {
        console.log("No user logged in");
      }
    };
    if (isOpen) checkUser();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userId) {
      alert("عذراً، يجب أن تكون مسجلاً للدخول لإرسال تذكرة.");
      return;
    }

    setLoading(true);

    try {
      console.log("النوع الذي سيتم إرساله:", userRole);
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId, // الـ ID الحقيقي من Auth
          subject: subject,
          first_message: message,
          user_role: userRole
        }),
      });

      const result = await response.json();

      if (response.ok) {
        alert("تم إرسال تذكرتك بنجاح! سيقوم المساعد الذكي بتحليلها فوراً.");
        setSubject("");
        setMessage("");
        onClose(); // إغلاق البوكس
      } else {
        alert(`فشل الإرسال: ${result.error}`);
      }
    } catch (error) {
      console.error("Submission Error:", error);
      alert("حدث خطأ تقني، يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div 
        className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-8 relative animate-in fade-in zoom-in duration-300" 
        dir="rtl"
      >
        {/* زر الإغلاق */}
        <button 
          onClick={onClose} 
          className="absolute top-5 left-5 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <span className="text-xl font-bold">✕</span>
        </button>

        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">فتح تذكرة دعم جديدة</h2>
          <p className="text-gray-500 mt-2">
            اكتب تفاصيل مشكلتك وسيقوم نظامنا الذكي بتصنيفها وإرسالها للفريق المختص.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">عنوان المشكلة</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all shadow-sm"
              placeholder="مثلاً: مشكلة في الدخول للحساب"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">وصف المشكلة بالتفصيل</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all resize-none shadow-sm"
              placeholder="اشرح لنا ما حدث معك بالتفصيل..."
              required
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={loading || !userId}
              className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
            >
              {loading ? "جاري الإرسال..." : "إرسال الآن"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 border border-gray-300 rounded-xl font-semibold text-gray-700 hover:bg-gray-50 transition-all"
            >
              إلغاء
            </button>
          </div>
        </form>

        {!userId && (
          <p className="text-center text-red-500 text-xs mt-4">
            * تنبيه: لم يتم العثور على مستخدم مسجل. يرجى تسجيل الدخول أولاً.
          </p>
        )}
      </div>
    </div>
  );
}