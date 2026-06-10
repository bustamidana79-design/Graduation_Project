"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type AccountType = "merchant" | "supplier" | "small_business" | "delivery" | "shipping_company" | "supporter" | "admin";

type Profile = {
  id: string;
  full_name: string | null;
  email?: string | null;
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
  supplier: "مورد",
  small_business: "مشروع صغير",
  delivery: "شركة شحن",
  shipping_company: "شركة شحن",
  supporter: "داعم",
  admin: "إدارة",
};

function formatMessageTime(value: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ar", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  });
}

function getConversationPeerId(conversation: DirectConversation, currentUserId: string) {
  return conversation.user_one_id === currentUserId ? conversation.user_two_id : conversation.user_one_id;
}

export default function DirectMessagesPage() {
  const [initialConversationId] = useState(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("conversation");
  });
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [conversations, setConversations] = useState<EnrichedConversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState("");
  const [userSearchResults, setUserSearchResults] = useState<Profile[]>([]);
  const [userSearchLoading, setUserSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [startingConversation, setStartingConversation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );

  const filteredConversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return conversations;
    return conversations.filter((conversation) =>
      [
        conversation.otherUser?.full_name,
        conversation.last_message,
        conversation.otherUser ? accountTypeLabels[conversation.otherUser.account_type] : "",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [conversations, search]);

  const filteredUsers = useMemo(() => {
    if (!currentUser) return [];
    const existingPeerIds = new Set(conversations.map((conversation) => getConversationPeerId(conversation, currentUser.id)));
    return userSearchResults.filter((user) => !existingPeerIds.has(user.id));
  }, [conversations, currentUser, userSearchResults]);

  const fetchConversations = async (user: Profile) => {
    const { data, error: conversationsError } = await supabase
      .from("direct_conversations")
      .select("*")
      .or(`user_one_id.eq.${user.id},user_two_id.eq.${user.id}`)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("updated_at", { ascending: false });

    if (conversationsError) throw conversationsError;

    const rawConversations = (data || []) as DirectConversation[];
    const peerIds = [...new Set(rawConversations.map((item) => getConversationPeerId(item, user.id)))];
    let profilesById = new Map<string, Profile>();

    if (peerIds.length > 0) {
      const { data: peers, error: peersError } = await supabase
        .from("profiles")
        .select("id, full_name, account_type, status")
        .in("id", peerIds);

      if (peersError) throw peersError;
      profilesById = new Map((peers || []).map((profile) => [profile.id, profile as Profile]));
    }

    const nextConversations = rawConversations.map((conversation) => ({
      ...conversation,
      otherUser: profilesById.get(getConversationPeerId(conversation, user.id)) || null,
    }));

    setConversations(nextConversations);
    setSelectedConversationId((currentSelected) => {
      if (currentSelected && nextConversations.some((conversation) => conversation.id === currentSelected)) return currentSelected;
      if (initialConversationId && nextConversations.some((conversation) => conversation.id === initialConversationId)) return initialConversationId;
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

    if (messagesError) throw messagesError;
    setMessages((data || []) as DirectMessage[]);
  };

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");

        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("id, full_name, account_type, status")
          .eq("id", user.id)
          .single();
        if (profileError || !profile) throw profileError || new Error("تعذر العثور على ملف المستخدم.");

        const typedProfile = profile as Profile;
        setCurrentUser(typedProfile);
        await fetchConversations(typedProfile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "حدث خطأ أثناء تحميل المحادثات.");
      } finally {
        setLoading(false);
      }
    };

    void bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    fetchMessages(selectedConversationId).catch((err) => {
      setError(err instanceof Error ? err.message : "تعذر تحميل الرسائل.");
    });
  }, [selectedConversationId]);

  useEffect(() => {
    if (!currentUser) return;

    const query = search.trim();
    if (query.length < 2) {
      setUserSearchResults([]);
      setUserSearchLoading(false);
      return;
    }

    let cancelled = false;
    setUserSearchLoading(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const safeQuery = query.replace(/[%,]/g, " ").trim();
        if (safeQuery.length < 2) {
          if (!cancelled) setUserSearchResults([]);
          return;
        }

        const { data, error: searchError } = await supabase
          .from("profiles")
          .select("id, full_name, email, account_type, status")
          .eq("status", "approved")
          .neq("account_type", "admin")
          .neq("id", currentUser.id)
          .ilike("full_name", `%${safeQuery}%`)
          .order("full_name", { ascending: true })
          .limit(8);

        if (searchError) throw searchError;
        if (!cancelled) setUserSearchResults((data || []) as Profile[]);
      } catch (err) {
        if (!cancelled) {
          setUserSearchResults([]);
          setError(err instanceof Error ? err.message : "تعذر البحث عن المستخدمين.");
        }
      } finally {
        if (!cancelled) setUserSearchLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [currentUser, search]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`direct-messages-${currentUser.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const nextMessage = payload.new as DirectMessage;
        const isRelated = nextMessage.sender_id === currentUser.id || nextMessage.receiver_id === currentUser.id;
        if (!isRelated) return;

        fetchConversations(currentUser).catch(() => undefined);
        if (nextMessage.conversation_id === selectedConversationId) {
          setMessages((currentMessages) =>
            currentMessages.some((message) => message.id === nextMessage.id) ? currentMessages : [...currentMessages, nextMessage]
          );
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "direct_conversations" }, () => {
        fetchConversations(currentUser).catch(() => undefined);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, selectedConversationId]);

  const startConversation = async (targetUserId: string) => {
    if (!currentUser || startingConversation) return;

    setStartingConversation(true);
    setError(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.access_token) throw new Error("انتهت الجلسة. يرجى تسجيل الدخول مرة أخرى.");

      const response = await fetch("/api/chat/conversation", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ targetUserId }),
      });

      const result = (await response.json()) as { conversationId?: string; error?: string };
      if (!response.ok || !result.conversationId) {
        throw new Error(result.error || "تعذر فتح المحادثة.");
      }

      await fetchConversations(currentUser);
      setSelectedConversationId(result.conversationId);
      setSearch("");
      setUserSearchResults([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر فتح المحادثة.");
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
        .insert([{ conversation_id: selectedConversation.id, sender_id: currentUser.id, receiver_id: receiverId, content }])
        .select("*")
        .single();
      if (insertError) throw insertError;

      const now = new Date().toISOString();
      const { error: updateConversationError } = await supabase
        .from("direct_conversations")
        .update({ last_message: content, last_message_at: now, last_sender_id: currentUser.id, updated_at: now })
        .eq("id", selectedConversation.id);
      if (updateConversationError) throw updateConversationError;

      setDraft("");
      setMessages((currentMessages) => {
        const next = insertedMessage as DirectMessage;
        return currentMessages.some((message) => message.id === next.id) ? currentMessages : [...currentMessages, next];
      });
      await fetchConversations(currentUser);
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال الرسالة.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-col gap-6" dir="rtl">
      <div className="rounded-3xl bg-[#273347] px-6 py-6 text-white">
        <h1 className="text-2xl font-bold">المحادثات المباشرة</h1>
        <p className="mt-2 text-sm text-white/70">تواصل مباشرة مع المستخدمين من مكان واحد.</p>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid min-h-[560px] gap-6 xl:h-[calc(100vh-220px)] xl:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="flex min-h-0 flex-col rounded-3xl border border-[#e6edf5] bg-white shadow-sm">
          <div className="border-b border-[#eef3f8] px-5 py-4">
            <h2 className="text-lg font-bold text-[#273347]">قائمة المحادثات</h2>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ابحث عن مستخدم أو محادثة"
              className="mt-3 w-full rounded-xl border border-[#d9e3ee] px-4 py-2 text-sm text-[#273347] outline-none focus:border-[#273347]"
            />
            {userSearchLoading && <p className="mt-2 text-xs text-[#273347]/50">جاري البحث عن المستخدمين...</p>}
            {!userSearchLoading && search.trim().length >= 2 && userSearchResults.length > 0 && filteredUsers.length === 0 && (
              <p className="mt-2 text-xs text-[#273347]/50">كل النتائج المطابقة موجودة ضمن محادثاتك الحالية.</p>
            )}
            {!userSearchLoading && search.trim().length >= 2 && userSearchResults.length === 0 && filteredConversations.length === 0 && (
              <p className="mt-2 text-xs text-[#273347]/50">لا يوجد مستخدم مطابق بهذا الاسم.</p>
            )}
            {filteredUsers.length > 0 && (
              <div className="mt-2 space-y-1 rounded-xl border border-[#e6edf5] bg-[#f8fafc] p-2">
                {filteredUsers.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    disabled={startingConversation}
                    onClick={() => void startConversation(user.id)}
                    className="block w-full rounded-lg px-3 py-2 text-right text-sm font-semibold text-[#273347] hover:bg-white"
                  >
                    {user.full_name || "مستخدم"} - {accountTypeLabels[user.account_type]}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="rounded-2xl px-4 py-8 text-center text-sm text-[#273347]/50">جاري تحميل المحادثات...</div>
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#d9e3ee] px-4 py-8 text-center text-sm text-[#273347]/50">
                لا توجد محادثات مطابقة. ابحث عن مستخدم لبدء محادثة معه.
              </div>
            ) : (
              filteredConversations.map((conversation) => {
                const isActive = conversation.id === selectedConversationId;
                return (
                  <button
                    key={conversation.id}
                    onClick={() => setSelectedConversationId(conversation.id)}
                    className={`mb-2 w-full rounded-2xl border px-4 py-4 text-right transition ${
                      isActive ? "border-[#bbd0e4] bg-[#f4f8fc]" : "border-transparent bg-white hover:border-[#e6edf5] hover:bg-[#fafcff]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-[#273347]">{conversation.otherUser?.full_name || "مستخدم"}</p>
                        <p className="mt-1 text-xs text-[#273347]/50">
                          {conversation.otherUser ? accountTypeLabels[conversation.otherUser.account_type] : "حساب على المنصة"}
                        </p>
                      </div>
                      <span className="text-[11px] text-[#273347]/40">{formatMessageTime(conversation.last_message_at || conversation.created_at)}</span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-[#273347]/65">{conversation.last_message || "لا توجد رسائل بعد."}</p>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-3xl border border-[#e6edf5] bg-white shadow-sm xl:min-h-0">
          {selectedConversation ? (
            <>
              <div className="border-b border-[#eef3f8] bg-[#fcfdff] px-6 py-5">
                <h2 className="text-xl font-bold text-[#273347]">{selectedConversation.otherUser?.full_name || "المحادثة"}</h2>
                <p className="mt-1 text-sm text-[#273347]/55">
                  {selectedConversation.otherUser ? accountTypeLabels[selectedConversation.otherUser.account_type] : "مستخدم على المنصة"}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-[#f6f9fc] px-4 py-5">
                {messagesLoading ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">جاري تحميل الرسائل...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">لا توجد رسائل بعد.</div>
                ) : (
                  messages.map((message) => {
                    const isMine = message.sender_id === currentUser?.id;
                    return (
                      <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm shadow-sm ${isMine ? "rounded-br-md bg-blue-600 text-white" : "rounded-bl-md border border-[#e2e8f0] bg-white text-[#273347]"}`}>
                          <p className="leading-7">{message.content}</p>
                          <span className={`mt-2 block text-[11px] ${isMine ? "text-white/65" : "text-[#273347]/40"}`}>{formatMessageTime(message.created_at)}</span>
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
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder="اكتب رسالتك هنا..."
                    rows={3}
                    className="min-h-[88px] flex-1 resize-none rounded-2xl border border-[#d9e3ee] px-4 py-3 text-sm text-[#273347] outline-none transition focus:border-[#273347]"
                    disabled={sending}
                  />
                  <button
                    onClick={() => void handleSend()}
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
              اختر محادثة من القائمة أو ابحث عن مستخدم لبدء محادثة معه.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
