"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "small_business" | "delivery" | "supporter" | "admin";

type Profile = {
  id: string;
  full_name: string | null;
  account_type: AccountType;
  status?: string | null;
};

type DirectConversation = {
  id: string;
  user_one_id: string;
  user_two_id: string;
  last_message: string | null;
  last_message_at: string | null;
  last_sender_id: string | null;
  updated_at?: string | null;
  created_at: string;
};

type DirectMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
};

type EnrichedConversation = DirectConversation & {
  otherUser: Profile | null;
};

const accountTypeLabels: Record<AccountType, string> = {
  merchant: "تاجر",
  small_business: "صاحب مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم",
  admin: "إدارة",
};

const formatMessageTime = (value: string | null) => {
  if (!value) return "";

  return new Date(value).toLocaleString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
};

const getConversationPeerId = (conversation: DirectConversation, currentUserId: string) =>
  conversation.user_one_id === currentUserId ? conversation.user_two_id : conversation.user_one_id;

export default function DirectMessagesPage() {
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [availableUsers, setAvailableUsers] = useState<Profile[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [startingChatUserId, setStartingChatUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schemaHint, setSchemaHint] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const fetchAvailableUsers = async (userId: string) => {
    const { data, error: profilesError } = await supabase
      .from("profiles")
      .select("id, full_name, account_type, status")
      .eq("status", "approved")
      .neq("id", userId)
      .neq("account_type", "admin")
      .order("full_name", { ascending: true });

    if (profilesError) {
      throw profilesError;
    }

    setAvailableUsers((data || []) as Profile[]);
  };

  const fetchConversations = async (user: Profile) => {
    const { data, error: conversationsError } = await supabase
      .from("direct_conversations")
      .select("*")
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (conversationsError) {
      throw conversationsError;
    }

    const rawConversations = (data || []) as DirectConversation[];
    const peerIds = [...new Set(rawConversations.map((item) => getConversationPeerId(item, user.id)))];

    let profilesById = new Map<string, Profile>();

    if (peerIds.length > 0) {
      const { data: peers, error: peersError } = await supabase
        .from("profiles")
        .select("id, full_name, account_type, status")
        .in("id", peerIds);

      if (peersError) {
        throw peersError;
      }

      profilesById = new Map((peers || []).map((profile) => [profile.id, profile as Profile]));
    }

    const nextConversations = rawConversations.map((conversation) => ({
      ...conversation,
      otherUser: profilesById.get(getConversationPeerId(conversation, user.id)) || null,
    }));

    setConversations(nextConversations);

    setSelectedConversationId((currentSelected) => {
      if (currentSelected && nextConversations.some((conversation) => conversation.id === currentSelected)) {
        return currentSelected;
      }

      return nextConversations[0]?.id ?? null;
    });
  };

  const fetchMessages = async (conversationId: string) => {
    setMessagesLoading(true);

    const { data, error: messagesError } = await supabase
      .from("direct_messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    setMessagesLoading(false);

    if (messagesError) {
      throw messagesError;
    }

    setMessages((data || []) as DirectMessage[]);
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);
      setSchemaHint(false);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError) {
          throw authError;
        }

        if (!user) {
          setError("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");
          return;
        }

<<<<<<< HEAD
=======
        setCurrentUserId(user.id);

>>>>>>> 2aebb4364fea5a43bc74bfe029a65aabf0a26899
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, account_type, status")
          .eq("id", user.id)
          .single();

        if (profileError) {
          throw profileError;
<<<<<<< HEAD
=======
        }

        if (!profile) {
          throw new Error("تعذر العثور على ملف المستخدم. يرجى التواصل مع الإدارة.");
>>>>>>> 2aebb4364fea5a43bc74bfe029a65aabf0a26899
        }

        const typedProfile = profile as Profile;
        setCurrentUser(typedProfile);

        await Promise.all([fetchAvailableUsers(user.id), fetchConversations(typedProfile)]);
      } catch (err) {
        const message = err instanceof Error ? err.message : "حدث خطأ غير متوقع أثناء تحميل المحادثات.";
        const normalized = message.toLowerCase();

        if (
          normalized.includes("direct_conversations") ||
          normalized.includes("direct_messages") ||
          normalized.includes("relation") ||
          normalized.includes("schema cache")
        ) {
          setSchemaHint(true);
          setError("جداول المحادثات المباشرة غير جاهزة بعد. نفّذ ملف SQL المرفق أولاً.");
        } else {
          setError(message);
        }
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedConversationId).catch((err) => {
      const message = err instanceof Error ? err.message : "تعذر تحميل الرسائل.";
      setError(message);
    });
  }, [selectedConversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`direct-messages-${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_messages",
        },
        (payload) => {
          const nextMessage = payload.new as DirectMessage;
          const isRelated =
            nextMessage.sender_id === currentUser.id || nextMessage.receiver_id === currentUser.id;

          if (!isRelated) return;

          fetchConversations(currentUser).catch(() => undefined);

          if (nextMessage.conversation_id === selectedConversationId) {
            setMessages((currentMessages) => {
              if (currentMessages.some((message) => message.id === nextMessage.id)) {
                return currentMessages;
              }

              return [...currentMessages, nextMessage];
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_conversations",
        },
        () => {
          fetchConversations(currentUser).catch(() => undefined);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, selectedConversationId]);

  const handleStartConversation = async () => {
    if (!currentUser || !startingChatUserId || startingConversation) return;

    setStartingConversation(true);
    setError(null);

    try {
      const existingFilter =
        `and(user_one_id.eq.${currentUser.id},user_two_id.eq.${startingChatUserId}),` +
        `and(user_one_id.eq.${startingChatUserId},user_two_id.eq.${currentUser.id})`;

      const { data: existingConversation, error: existingError } = await supabase
        .from("direct_conversations")
        .select("*")
        .or(existingFilter)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      let conversationId = (existingConversation as DirectConversation | null)?.id ?? null;

      if (!conversationId) {
        const { data: createdConversation, error: createError } = await supabase
          .from("direct_conversations")
          .insert([
            {
              user_one_id: currentUser.id,
              user_two_id: startingChatUserId,
            },
          ])
          .select("*")
          .single();

        if (createError) {
          throw createError;
        }

        conversationId = (createdConversation as DirectConversation).id;
      }

      await fetchConversations(currentUser);
      setSelectedConversationId(conversationId);
      setStartingChatUserId("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر بدء المحادثة.";
      setError(message);
    } finally {
      setStartingConversation(false);
    }
  };

  const handleSend = async () => {
    if (!currentUser || !selectedConversation || !draft.trim() || sending) return;

    setSending(true);
    setError(null);

    try {
      const receiverId = getConversationPeerId(selectedConversation, currentUser.id);
      const content = draft.trim();

      const { data: insertedMessage, error: insertError } = await supabase
        .from("direct_messages")
        .insert([
          {
            conversation_id: selectedConversation.id,
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content,
          },
        ])
        .select("*")
        .single();

      if (insertError) {
        throw insertError;
      }

      const now = new Date().toISOString();
      const { error: updateConversationError } = await supabase
        .from("direct_conversations")
        .update({
          last_message: content,
          last_message_at: now,
          last_sender_id: currentUser.id,
          updated_at: now,
        })
        .eq("id", selectedConversation.id);

      if (updateConversationError) {
        throw updateConversationError;
      }

      setDraft("");
      setMessages((currentMessages) => {
        const next = insertedMessage as DirectMessage;

        if (currentMessages.some((message) => message.id === next.id)) {
          return currentMessages;
        }

        return [...currentMessages, next];
      });

      await fetchConversations(currentUser);
    } catch (err) {
      const message = err instanceof Error ? err.message : "تعذر إرسال الرسالة.";
      setError(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-3xl bg-[#273347] px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">المحادثات المباشرة</h1>
        <p className="mt-2 text-sm text-white/70">
          تواصل مباشرة مع بقية المستخدمين على المنصة من مكان واحد.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p>{error}</p>
          {schemaHint && (
            <p className="mt-2 text-red-600">
              ملف الإعداد موجود في <span className="font-semibold">supabase/direct-messages.sql</span>
            </p>
          )}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-[#e6edf5] bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-[#273347]">بدء محادثة جديدة</h2>
            <p className="mt-1 text-sm text-[#273347]/60">اختر مستخدمًا وابدأ المحادثة فورًا.</p>

            <div className="mt-4 space-y-3">
              <select
                value={startingChatUserId}
                onChange={(event) => setStartingChatUserId(event.target.value)}
                className="w-full rounded-2xl border border-[#d9e3ee] bg-white px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
                disabled={loading || availableUsers.length === 0}
              >
                <option value="">اختر المستخدم</option>
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {(user.full_name || "مستخدم") + " - " + accountTypeLabels[user.account_type]}
                  </option>
                ))}
              </select>

              <button
                onClick={handleStartConversation}
                disabled={!startingChatUserId || startingConversation}
                className="w-full rounded-2xl bg-[#bbd0e4] px-4 py-3 text-sm font-semibold text-[#273347] transition hover:bg-[#a9c2d8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {startingConversation ? "جاري الإنشاء..." : "بدء المحادثة"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-[#e6edf5] bg-white shadow-sm">
            <div className="border-b border-[#eef3f8] px-5 py-4">
              <h2 className="text-lg font-bold text-[#273347]">قائمة المحادثات</h2>
            </div>

            <div className="max-h-[640px] overflow-y-auto p-3">
              {loading ? (
                <div className="rounded-2xl px-4 py-8 text-center text-sm text-[#273347]/50">
                  جاري تحميل المحادثات...
                </div>
              ) : conversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-8 text-center text-sm text-[#273347]/50">
                  لا توجد محادثات بعد. ابدأ أول محادثة من الأعلى.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const isActive = conversation.id === selectedConversationId;

                  return (
                    <button
                      key={conversation.id}
                      onClick={() => setSelectedConversationId(conversation.id)}
                      className={`mb-2 w-full rounded-2xl border px-4 py-4 text-right transition ${
                        isActive
                          ? "border-[#bbd0e4] bg-[#f4f8fc]"
                          : "border-transparent bg-white hover:border-[#e6edf5] hover:bg-[#fafcff]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-[#273347]">
                            {conversation.otherUser?.full_name || "مستخدم"}
                          </p>
                          <p className="mt-1 text-xs text-[#273347]/50">
                            {conversation.otherUser
                              ? accountTypeLabels[conversation.otherUser.account_type]
                              : "حساب على المنصة"}
                          </p>
                        </div>
                        <span className="text-[11px] text-[#273347]/40">
                          {formatMessageTime(conversation.last_message_at || conversation.created_at)}
                        </span>
                      </div>

                      <p className="mt-3 line-clamp-2 text-sm text-[#273347]/65">
                        {conversation.last_message || "لا توجد رسائل بعد. ابدأ المحادثة الآن."}
                      </p>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        <section className="flex min-h-[720px] flex-col overflow-hidden rounded-3xl border border-[#e6edf5] bg-white shadow-sm">
          {selectedConversation ? (
            <>
              <div className="border-b border-[#eef3f8] bg-[#fcfdff] px-6 py-5">
                <h2 className="text-xl font-bold text-[#273347]">
                  {selectedConversation.otherUser?.full_name || "المحادثة"}
                </h2>
                <p className="mt-1 text-sm text-[#273347]/55">
                  {selectedConversation.otherUser
                    ? accountTypeLabels[selectedConversation.otherUser.account_type]
                    : "مستخدم على المنصة"}
                </p>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto bg-[#f6f9fc] px-4 py-5">
                {messagesLoading ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">جاري تحميل الرسائل...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">
                    لا توجد رسائل بعد. أرسل أول رسالة لبدء الحوار.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === currentUser?.id;

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                            isMine
                              ? "rounded-br-md bg-blue-600 text-white"
                              : "rounded-bl-md border border-[#e2e8f0] bg-white text-[#273347]"
                          }`}
                        >
                          <p className="leading-7">{message.content}</p>
                          <span
                            className={`mt-2 block text-[11px] ${
                              isMine ? "text-white/65" : "text-[#273347]/40"
                            }`}
                          >
                            {formatMessageTime(message.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              <div className="border-t border-[#eef3f8] bg-white px-4 py-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-end">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="اكتب رسالتك هنا..."
                    rows={3}
                    className="min-h-[88px] flex-1 resize-none rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
                    disabled={sending}
                  />

                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="rounded-2xl bg-[#273347] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1e2735] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? "جاري الإرسال..." : "إرسال"}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center bg-[#f6f9fc] px-6 text-center text-[#273347]/55">
              اختر محادثة من القائمة أو ابدأ محادثة جديدة حتى تظهر الرسائل هنا.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
