"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type Message = {
  role: "user" | "assistant";
  message: string;
};

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initChat();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initChat = async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
   if (!user) { router.push("/login"); return; }

   setProfileId(user.id);


setProfileId(user?.id ?? "test-id");
    // جيب آخر session أو اعمل جديد
    const { data: sessions } = await supabase
      .from("ai_chat_sessions")
      .select("id")
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    let sid = sessions?.[0]?.id;

    if (!sid) {
      const { data: newSession } = await supabase
        .from("ai_chat_sessions")
        .insert({ profile_id: user.id })
        .select("id")
        .single();
      sid = newSession?.id;
    }

    setSessionId(sid);

    // جيب تاريخ المحادثة
    const { data: history } = await supabase
      .from("ai_chat_messages")
      .select("role, message")
      .eq("session_id", sid)
      .order("created_at", { ascending: true });

    if (history && history.length > 0) {
      setMessages(history as Message[]);
    } else {
      setMessages([{
        role: "assistant",
        message: "مرحباً! أنا مساعدك التسويقي الذكي 🤖\nكيف يمكنني مساعدتك اليوم؟",
      }]);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !sessionId || !profileId || loading) return;

    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", message: userMsg }]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg, sessionId, profileId }),
      });

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", message: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", message: "عذراً، حدث خطأ. حاول مرة أخرى." }]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = async () => {
    if (!profileId) return;
    const { data } = await supabase
      .from("ai_chat_sessions")
      .insert({ profile_id: profileId })
      .select("id")
      .single();
    setSessionId(data?.id);
    setMessages([{
      role: "assistant",
      message: "مرحباً! أنا مساعدك التسويقي الذكي 🤖\nكيف يمكنني مساعدتك اليوم؟",
    }]);
  };

  return (
    <main className="min-h-screen bg-[#f8fafc]" dir="rtl">
      <Navbar />

      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-[#273347]">المساعد التسويقي الذكي 🤖</h1>
          <button
            onClick={newChat}
            className="text-sm bg-[#bbd0e4] hover:bg-[#a9c2d8] text-[#273347] font-semibold px-4 py-2 rounded-xl transition"
          >
            محادثة جديدة
          </button>
        </div>

        {/* منطقة الرسائل */}
        <div className="bg-white border border-[#e6edf5] rounded-2xl shadow p-4 h-[500px] overflow-y-auto flex flex-col gap-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              <div className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-[#273347] text-white rounded-tr-none"
                  : "bg-[#eef4fa] text-[#273347] rounded-tl-none"
              }`}>
                {msg.message}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-end">
              <div className="bg-[#eef4fa] text-[#273347] px-4 py-3 rounded-2xl text-sm rounded-tl-none">
                جارٍ الكتابة...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* حقل الإدخال */}
        <div className="flex gap-2 mt-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            placeholder="اكتب سؤالك التسويقي..."
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] text-sm"
          />
          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-[#273347] hover:bg-[#1e2a3a] text-white font-semibold px-6 py-3 rounded-xl transition disabled:opacity-60"
          >
            إرسال
          </button>
        </div>
      </div>
    </main>
  );
}