"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type AIChatbotUserType = "supplier" | "merchant" | "delivery" | "supporter" | "admin";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ProfileAccountType = AIChatbotUserType | "small_business";

const userTypeLabels: Record<AIChatbotUserType, string> = {
  supplier: "المورد",
  merchant: "التاجر",
  delivery: "شركة التوصيل",
  supporter: "الداعم",
  admin: "الإدارة",
};

function normalizeUserType(accountType: string | null | undefined, fallback: AIChatbotUserType): AIChatbotUserType {
  const normalized = accountType?.trim().toLowerCase() as ProfileAccountType | undefined;

  if (normalized === "small_business") return "merchant";
  if (normalized === "merchant" && fallback === "supplier") return "supplier";
  if (normalized === "supplier" || normalized === "merchant" || normalized === "delivery" || normalized === "supporter" || normalized === "admin") {
    return normalized;
  }

  return fallback;
}

function getWelcomeMessage(userType: AIChatbotUserType): ChatMessage {
  const label = userTypeLabels[userType];
  return {
    role: "assistant",
    content: `مرحبا! أنا مساعدك الذكي الخاص بـ${label}. اسألني عن المبيعات، المنتجات، الطلبات، التنبيهات، أو فرص التسويق بناء على بياناتك الحقيقية.`,
  };
}

async function getLatestSession(userId: string) {
  return supabase
    .from("ai_chat_sessions")
    .select("id")
    .eq("profile_id", userId)
    .order("created_at", { ascending: false })
    .limit(1);
}

async function createChatSession(userId: string, userType: AIChatbotUserType) {
  const typedInsert = await supabase
    .from("ai_chat_sessions")
    .insert({ profile_id: userId, user_type: userType })
    .select("id")
    .single();

  if (!typedInsert.error) return typedInsert;

  const missingUserType = typedInsert.error.code === "42703" || typedInsert.error.code === "PGRST204";
  if (!missingUserType) return typedInsert;

  return supabase.from("ai_chat_sessions").insert({ profile_id: userId }).select("id").single();
}

export default function AIChatbot({ userType: fallbackUserType }: { userType: AIChatbotUserType }) {
  const router = useRouter();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [effectiveUserType, setEffectiveUserType] = useState<AIChatbotUserType>(fallbackUserType);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    const initChat = async () => {
      setInitializing(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .maybeSingle();

      const nextUserType = normalizeUserType(profile?.account_type, fallbackUserType);

      if (!active) return;

      setUserId(user.id);
      setEffectiveUserType(nextUserType);

      const { data: sessions, error: sessionsError } = await getLatestSession(user.id);

      if (sessionsError) {
        console.error(sessionsError);
        setErrorMessage("حدث خطأ أثناء تحميل المحادثة.");
        setMessages([getWelcomeMessage(nextUserType)]);
        setInitializing(false);
        return;
      }

      let currentSessionId = sessions?.[0]?.id;

      if (!currentSessionId) {
        const { data: newSession, error: createSessionError } = await createChatSession(user.id, nextUserType);

        if (createSessionError) {
          console.error(createSessionError);
          setErrorMessage("حدث خطأ أثناء إنشاء محادثة جديدة.");
          setMessages([getWelcomeMessage(nextUserType)]);
          setInitializing(false);
          return;
        }

        currentSessionId = newSession?.id;
      }

      setSessionId(currentSessionId || null);

      const { data: history, error: historyError } = await supabase
        .from("ai_chat_messages")
        .select("role, message")
        .eq("session_id", currentSessionId)
        .order("created_at", { ascending: true });

      if (!active) return;

      if (historyError) {
        console.error(historyError);
        setErrorMessage("لم نتمكن من تحميل تاريخ المحادثة.");
        setMessages([getWelcomeMessage(nextUserType)]);
      } else if (history && history.length > 0) {
        setMessages(
          history
            .filter((item) => item.role === "user" || item.role === "assistant")
            .map((item) => ({
              role: item.role as "user" | "assistant",
              content: String(item.message || ""),
            }))
        );
      } else {
        setMessages([getWelcomeMessage(nextUserType)]);
      }

      setInitializing(false);
    };

    initChat();

    return () => {
      active = false;
    };
  }, [fallbackUserType, router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const userMessage = input.trim();
    if (!userMessage || loading) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    setInput("");
    setErrorMessage("");
    setLoading(true);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const res = await fetch("/api/chatbot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: userMessage,
          sessionId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Chatbot request failed.");
      }

      if (data.sessionId) setSessionId(data.sessionId);
      if (data.userType) setEffectiveUserType(data.userType);
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch (error) {
      console.error(error);
      setErrorMessage("حدث خطأ، حاول مرة أخرى.");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "عذرا، حدث خطأ أثناء تحليل البيانات. حاول مرة أخرى بعد قليل.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const newChat = async () => {
    if (!userId || loading) return;

    const { data, error } = await createChatSession(userId, effectiveUserType);

    if (error) {
      console.error(error);
      setErrorMessage("حدث خطأ أثناء إنشاء محادثة جديدة.");
      return;
    }

    setSessionId(data?.id || null);
    setMessages([getWelcomeMessage(effectiveUserType)]);
    setErrorMessage("");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8" dir="rtl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">المساعد الذكي</h1>
          <p className="mt-1 text-sm text-[#273347]/60">
            تجربة مخصصة لـ{userTypeLabels[effectiveUserType]} حسب بياناته داخل النظام.
          </p>
        </div>
        <button
          type="button"
          onClick={newChat}
          disabled={loading || initializing}
          className="rounded-xl bg-[#bbd0e4] px-4 py-2 text-sm font-semibold text-[#273347] transition hover:bg-[#a9c2d8] disabled:opacity-60"
        >
          محادثة جديدة
        </button>
      </div>

      {errorMessage && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <div className="flex h-[500px] flex-col gap-3 overflow-y-auto rounded-2xl border border-[#e6edf5] bg-white p-4 shadow">
        {initializing ? (
          <div className="py-10 text-center text-sm text-[#273347]/50">جاري تحميل المحادثة...</div>
        ) : (
          messages.map((msg, index) => (
            <div key={`${msg.role}-${index}`} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${
                  msg.role === "user"
                    ? "rounded-tr-none bg-[#273347] text-white"
                    : "rounded-tl-none bg-[#eef4fa] text-[#273347]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex justify-end">
            <p className="rounded-2xl rounded-tl-none bg-[#eef4fa] px-4 py-3 text-sm text-[#273347]">
              جاري الكتابة...
            </p>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={sendMessage} className="mt-4 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="اكتب سؤالك..."
          disabled={loading || initializing}
          className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#bbd0e4] disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={loading || initializing || !input.trim()}
          className="rounded-xl bg-[#273347] px-6 py-3 font-semibold text-white transition hover:bg-[#1e2a3a] disabled:opacity-60"
        >
          إرسال
        </button>
      </form>
    </div>
  );
}
