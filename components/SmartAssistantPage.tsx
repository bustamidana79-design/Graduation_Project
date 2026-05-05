"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Send, ThumbsDown, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

type Message = {
  id?: string;
  role: "user" | "assistant";
  message: string;
  rating?: 1 | -1 | null;
};

const assistantConfig: Record<
  AccountType,
  {
    title: string;
    subtitle: string;
    greeting: string;
    placeholder: string;
    quickPrompts: string[];
  }
> = {
  merchant: {
    title: "المساعد الذكي للتجار",
    subtitle: "اكتب وصف منتجات، حسّن التسعير، وخطط لمحتوى تسويقي يبيع بشكل أوضح.",
    greeting:
      "مرحباً! أنا مساعدك الذكي للتجارة والتسويق. أقدر أساعدك بوصف المنتجات، التسعير، أفكار السوشال ميديا، والرد على العملاء.",
    placeholder: "مثلاً: اكتب وصف تسويقي لمنتج جديد...",
    quickPrompts: [
      "اكتب وصف منتج جذاب",
      "اقترح سعر بيع مناسب",
      "اعمل خطة محتوى لأسبوع",
      "اكتب رد احترافي لعميل",
    ],
  },
  small_business: {
    title: "المساعد الذكي للمشاريع الصغيرة",
    subtitle: "اسأل عن التسويق، الموردين، المنتجات المناسبة، وخطة نمو عملية لمشروعك.",
    greeting:
      "أهلاً! أنا مساعدك لنمو المشروع. أقدر أساعدك تلاقي موردين، تخطط لحملة تسويق، تكتب بوستات، وتحسّن عرض مشروعك.",
    placeholder: "مثلاً: اعمل خطة تسويق لمشروع حلويات بيتي...",
    quickPrompts: [
      "اقترح موردين مناسبين",
      "اعمل خطة تسويق بسيطة",
      "اكتب بوست إنستغرام",
      "كيف أزيد المبيعات بميزانية قليلة؟",
    ],
  },
  delivery: {
    title: "المساعد الذكي لشركات الشحن",
    subtitle: "حسّن خدمة العملاء، اكتب ردود جاهزة، وخطط لتسويق خدمات التوصيل.",
    greeting:
      "مرحباً! أقدر أساعدك بصياغة ردود للعملاء، تحسين تجربة الشحن، وتسويق خدمات التوصيل للتجار والمشاريع.",
    placeholder: "مثلاً: اكتب رد لعميل يسأل عن مدة التوصيل...",
    quickPrompts: [
      "اكتب رد لعميل عن التأخير",
      "اقترح عرض لشركات صغيرة",
      "حسّن وصف خدمة التوصيل",
      "اعمل خطة محتوى لشركة شحن",
    ],
  },
  supporter: {
    title: "المساعد الذكي للداعمين",
    subtitle: "حلّل فرص الدعم، قارن المشاريع، واكتب رسائل تواصل واضحة مع أصحاب المشاريع.",
    greeting:
      "أهلاً! أنا مساعدك في تقييم المشاريع وفرص الدعم. أقدر أساعدك بالمقارنة، الأسئلة المهمة، وصياغة رسائل التواصل.",
    placeholder: "مثلاً: ما الأسئلة التي أسألها قبل دعم مشروع؟",
    quickPrompts: [
      "اقترح معايير تقييم مشروع",
      "اكتب رسالة لصاحب مشروع",
      "قارن بين فرص دعم",
      "لخّص مخاطر دعم مشروع صغير",
    ],
  },
  admin: {
    title: "المساعد الذكي للإدارة",
    subtitle: "لخّص الطلبات، اكتب ملاحظات مراجعة، وساعدك بصياغة قرارات أو ردود واضحة.",
    greeting:
      "مرحباً! أنا مساعد الإدارة. أقدر أساعدك بتلخيص طلبات التسجيل، كتابة ملاحظات قبول أو رفض، وتحسين رسائل التواصل.",
    placeholder: "مثلاً: لخّص طلب تسجيل واكتب ملاحظات مراجعة...",
    quickPrompts: [
      "اكتب سبب قبول مهني",
      "اكتب سبب رفض واضح",
      "لخّص طلب تسجيل",
      "اقترح أسئلة تحقق إضافية",
    ],
  },
};

export default function SmartAssistantPage({ accountType }: { accountType: AccountType }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const config = assistantConfig[accountType];

  const initialMessages = useMemo<Message[]>(
    () => [{ role: "assistant", message: config.greeting }],
    [config.greeting]
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const createSession = useCallback(async (profileIdValue: string) => {
    const { data, error: sessionError } = await supabase
      .from("ai_chat_sessions")
      .insert({ profile_id: profileIdValue })
      .select("id")
      .single();

    if (sessionError) throw sessionError;
    return data.id as string;
  }, []);

  const loadChat = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) {
        router.push("/login");
        return;
      }

      setProfileId(user.id);

      const { data: sessions, error: sessionsError } = await supabase
        .from("ai_chat_sessions")
        .select("id")
        .eq("profile_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (sessionsError) throw sessionsError;

      let nextSessionId = sessions?.[0]?.id as string | undefined;
      if (!nextSessionId) nextSessionId = await createSession(user.id);

      setSessionId(nextSessionId);

      const { data: history, error: historyError } = await supabase
        .from("ai_chat_messages")
        .select("id, role, message, rating")
        .eq("session_id", nextSessionId)
        .order("created_at", { ascending: true });

      if (historyError) throw historyError;
      setMessages(history && history.length > 0 ? (history as Message[]) : initialMessages);
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر تحميل المساعد الذكي.";
      setError(message);
      setMessages(initialMessages);
    } finally {
      setLoading(false);
    }
  }, [createSession, initialMessages, router]);

  useEffect(() => {
    void loadChat();
  }, [loadChat]);

  const newChat = async () => {
    if (!profileId || sending) return;
    setError(null);

    try {
      const nextSessionId = await createSession(profileId);
      setSessionId(nextSessionId);
      setMessages(initialMessages);
      setInput("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر إنشاء محادثة جديدة.";
      setError(message);
    }
  };

  const rateMessage = async (messageId: string, rating: 1 | -1) => {
    setMessages((current) =>
      current.map((item) => (item.id === messageId ? { ...item, rating } : item))
    );

    const { error: ratingError } = await supabase
      .from("ai_chat_messages")
      .update({ rating, rated_at: new Date().toISOString() })
      .eq("id", messageId);

    if (ratingError) {
      setError("تعذر حفظ تقييم الرد.");
    }
  };

  const sendMessage = async (preset?: string) => {
    const text = (preset || input).trim();
    if (!text || !sessionId || !profileId || sending) return;

    setInput("");
    setError(null);
    setSending(true);
    setMessages((current) => [...current, { role: "user", message: text }]);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          sessionId,
          profileId,
          accountType,
        }),
      });

      const data = (await res.json()) as { reply?: string; messageId?: string | null; error?: string };

      if (!res.ok || data.error) {
        throw new Error(data.error || "تعذر الحصول على رد من المساعد.");
      }

      setMessages((current) => [
        ...current,
        {
          id: data.messageId || undefined,
          role: "assistant",
          message: data.reply || "عذراً، لم أستطع توليد رد مناسب.",
        },
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "حدث خطأ أثناء إرسال الرسالة.";
      setError(message);
      setMessages((current) => [
        ...current,
        { role: "assistant", message: "عذراً، حدث خطأ. حاول مرة أخرى." },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-90px)] w-full max-w-6xl flex-col gap-5 px-5 py-6" dir="rtl">
      <header className="flex flex-col gap-4 border-b border-[#e6edf5] pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#273347]">{config.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#273347]/60">{config.subtitle}</p>
        </div>
        <button
          onClick={newChat}
          disabled={!profileId || sending}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d9e3ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#273347] transition hover:bg-[#f4f8fc] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw size={16} />
          محادثة جديدة
        </button>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid flex-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <p className="text-xs font-semibold text-[#273347]/50">اقتراحات سريعة</p>
          <div className="grid gap-2">
            {config.quickPrompts.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={loading || sending || !sessionId}
                className="rounded-lg border border-[#e6edf5] bg-white px-4 py-3 text-right text-sm font-medium text-[#273347] transition hover:border-[#bbd0e4] hover:bg-[#f7fbff] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {prompt}
              </button>
            ))}
          </div>
        </aside>

        <section className="flex min-h-[640px] flex-col overflow-hidden rounded-lg border border-[#e6edf5] bg-white shadow-sm">
          <div className="flex-1 overflow-y-auto bg-[#f6f9fc] px-4 py-5">
            {loading ? (
              <div className="py-16 text-center text-sm text-[#273347]/50">
                جاري تحميل المساعد الذكي...
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, index) => {
                  const isUser = msg.role === "user";

                  return (
                    <div key={msg.id || `${msg.role}-${index}`} className={`flex ${isUser ? "justify-start" : "justify-end"}`}>
                      <div className="max-w-[82%]">
                        <div
                          className={`whitespace-pre-wrap rounded-lg px-4 py-3 text-sm leading-7 shadow-sm ${
                            isUser
                              ? "bg-[#273347] text-white"
                              : "border border-[#e2e8f0] bg-white text-[#273347]"
                          }`}
                        >
                          {msg.message}
                        </div>
                        {!isUser && msg.id && (
                          <div className="mt-1 flex justify-end gap-1">
                            <button
                              onClick={() => rateMessage(msg.id as string, 1)}
                              title="رد مفيد"
                              className={`rounded-md p-1.5 transition ${
                                msg.rating === 1
                                  ? "bg-green-100 text-green-700"
                                  : "text-[#273347]/45 hover:bg-white hover:text-[#273347]"
                              }`}
                            >
                              <ThumbsUp size={15} />
                            </button>
                            <button
                              onClick={() => rateMessage(msg.id as string, -1)}
                              title="رد غير مفيد"
                              className={`rounded-md p-1.5 transition ${
                                msg.rating === -1
                                  ? "bg-red-100 text-red-700"
                                  : "text-[#273347]/45 hover:bg-white hover:text-[#273347]"
                              }`}
                            >
                              <ThumbsDown size={15} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {sending && (
                  <div className="flex justify-end">
                    <div className="rounded-lg border border-[#e2e8f0] bg-white px-4 py-3 text-sm text-[#273347]/60 shadow-sm">
                      جاري الكتابة...
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          <div className="border-t border-[#eef3f8] bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                placeholder={config.placeholder}
                rows={3}
                disabled={loading || sending || !sessionId}
                className="min-h-[86px] flex-1 resize-none rounded-lg border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347] disabled:cursor-not-allowed disabled:bg-[#f8fafc]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading || sending || !sessionId}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#273347] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1e2735] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send size={16} />
                إرسال
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
