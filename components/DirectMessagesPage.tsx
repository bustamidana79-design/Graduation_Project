"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  read_at?: string | null;
};

type EnrichedConversation = DirectConversation & {
  otherUser: Profile | null;
  unreadCount: number;
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

const isOutgoingMessage = (
  message: DirectMessage,
  conversation: DirectConversation | null,
  currentUserId: string | null,
  otherUserId: string | null
) => {
  if (!conversation) return false;

  const effectiveCurrentUserId =
    currentUserId ||
    (otherUserId
      ? conversation.user_one_id === otherUserId
        ? conversation.user_two_id
        : conversation.user_one_id
      : null);

  if (effectiveCurrentUserId) {
    if (message.sender_id === effectiveCurrentUserId) return true;
    if (message.receiver_id === effectiveCurrentUserId) return false;
  }

  const peerId =
    otherUserId ||
    (effectiveCurrentUserId ? getConversationPeerId(conversation, effectiveCurrentUserId) : null);

  if (effectiveCurrentUserId && peerId) {
    if (message.sender_id === effectiveCurrentUserId && message.receiver_id === peerId) return true;
    if (message.sender_id === peerId && message.receiver_id === effectiveCurrentUserId) return false;
  }

  if (peerId) {
    if (message.receiver_id === peerId) return true;
    if (message.sender_id === peerId) return false;
  }

  return message.sender_id === conversation.last_sender_id;
};

export default function DirectMessagesPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
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
  const autoStartedUserRef = useRef<string | null>(null);
  const requestedUserId = searchParams.get("user")?.trim() || "";

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId) ?? null,
    [conversations, selectedConversationId]
  );
  const dashboardBasePath = useMemo(() => pathname.replace(/\/messages$/, ""), [pathname]);
  const selectedUserProfileHref = selectedConversation?.otherUser
    ? `${dashboardBasePath}/users/${selectedConversation.otherUser.id}`
    : null;

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
    const conversationIds = rawConversations.map((conversation) => conversation.id);
    const peerIds = [...new Set(rawConversations.map((item) => getConversationPeerId(item, user.id)))];

    let profilesById = new Map<string, Profile>();
    const unreadCountsByConversationId = new Map<string, number>();

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

    if (conversationIds.length > 0) {
      const { data: unreadMessages, error: unreadError } = await supabase
        .from("direct_messages")
        .select("conversation_id")
        .in("conversation_id", conversationIds)
        .eq("receiver_id", user.id)
        .is("read_at", null);

      if (unreadError) {
        throw unreadError;
      }

      for (const message of unreadMessages || []) {
        const conversationId = (message as Pick<DirectMessage, "conversation_id">).conversation_id;
        unreadCountsByConversationId.set(
          conversationId,
          (unreadCountsByConversationId.get(conversationId) || 0) + 1
        );
      }
    }

    const nextConversations = rawConversations.map((conversation) => ({
      ...conversation,
      otherUser: profilesById.get(getConversationPeerId(conversation, user.id)) || null,
      unreadCount: unreadCountsByConversationId.get(conversation.id) || 0,
    }));

    setConversations(nextConversations);

    setSelectedConversationId((currentSelected) => {
      if (currentSelected && nextConversations.some((conversation) => conversation.id === currentSelected)) {
        return currentSelected;
      }

      return null;
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

  const markConversationAsRead = useCallback(
    async (conversationId: string) => {
      if (!currentUser) return;

      const readAt = new Date().toISOString();
      const { error: markReadError } = await supabase
        .from("direct_messages")
        .update({ read_at: readAt })
        .eq("conversation_id", conversationId)
        .eq("receiver_id", currentUser.id)
        .is("read_at", null);

      if (markReadError) {
        throw markReadError;
      }

      setConversations((currentConversations) =>
        currentConversations.map((conversation) =>
          conversation.id === conversationId ? { ...conversation, unreadCount: 0 } : conversation
        )
      );

      setMessages((currentMessages) =>
        currentMessages.map((message) =>
          message.conversation_id === conversationId && message.receiver_id === currentUser.id && !message.read_at
            ? { ...message, read_at: readAt }
            : message
        )
      );
    },
    [currentUser]
  );

  const startConversationWithUser = useCallback(
    async (targetUserId: string, clearSelection = true) => {
      if (!currentUser || !targetUserId || startingConversation) return null;

      setStartingConversation(true);
      setError(null);

      try {
        const existingFilter =
          `and(user_one_id.eq.${currentUser.id},user_two_id.eq.${targetUserId}),` +
          `and(user_one_id.eq.${targetUserId},user_two_id.eq.${currentUser.id})`;

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
                user_two_id: targetUserId,
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

        if (clearSelection) {
          setStartingChatUserId("");
        }

        return conversationId;
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر بدء المحادثة.";
        setError(message);
        return null;
      } finally {
        setStartingConversation(false);
      }
    },
    [currentUser, startingConversation]
  );

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

        setCurrentUserId(user.id);

        const { data: profileById, error: profileByIdError } = await supabase
          .from("profiles")
          .select("id, full_name, account_type, status")
          .eq("id", user.id)
          .maybeSingle();

        const { data: profileByEmail, error: profileByEmailError } = profileById || profileByIdError
          ? { data: null, error: null }
          : await supabase
              .from("profiles")
              .select("id, full_name, account_type, status")
              .ilike("email", user.email || "")
              .maybeSingle();

        if (profileByIdError || profileByEmailError) {
          throw profileByIdError || profileByEmailError;
        }

        const profile = profileById || profileByEmail;

        if (!profile) {
          throw new Error("تعذر العثور على ملف المستخدم. يرجى التواصل مع الإدارة.");
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
          setError("جداول المحادثات المباشرة غير جاهزة بعد. نفّذ ملف SQL المرفق أولًا.");
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

    const loadSelectedConversation = async () => {
      try {
        await fetchMessages(selectedConversationId);
        await markConversationAsRead(selectedConversationId);
      } catch (err) {
        const message = err instanceof Error ? err.message : "تعذر تحميل الرسائل.";
        setError(message);
      }
    };

    loadSelectedConversation();
  }, [markConversationAsRead, selectedConversationId]);

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

            if (nextMessage.receiver_id === currentUser.id) {
              markConversationAsRead(nextMessage.conversation_id).catch(() => undefined);
            }
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
  }, [currentUser, markConversationAsRead, selectedConversationId]);

  useEffect(() => {
    if (!requestedUserId) {
      autoStartedUserRef.current = null;
      return;
    }

    if (!currentUser || loading || startingConversation) return;

    if (requestedUserId === currentUser.id) {
      setError("لا يمكنك بدء محادثة مع نفسك.");
      autoStartedUserRef.current = requestedUserId;
      router.replace(pathname);
      return;
    }

    if (autoStartedUserRef.current === requestedUserId) return;

    const existingConversation = conversations.find(
      (conversation) => getConversationPeerId(conversation, currentUser.id) === requestedUserId
    );

    if (existingConversation) {
      setSelectedConversationId(existingConversation.id);
      setStartingChatUserId("");
      autoStartedUserRef.current = requestedUserId;
      router.replace(pathname);
      return;
    }

    if (availableUsers.length > 0 && !availableUsers.some((user) => user.id === requestedUserId)) {
      setError("هذا المستخدم غير متاح لبدء محادثة حالياً.");
      autoStartedUserRef.current = requestedUserId;
      router.replace(pathname);
      return;
    }

    autoStartedUserRef.current = requestedUserId;
    setStartingChatUserId(requestedUserId);

    startConversationWithUser(requestedUserId, false).then((conversationId) => {
      if (conversationId) {
        router.replace(pathname);
      } else {
        autoStartedUserRef.current = null;
      }
    });
  }, [
    availableUsers,
    conversations,
    currentUser,
    loading,
    pathname,
    requestedUserId,
    router,
    startConversationWithUser,
    startingConversation,
  ]);

  const handleStartConversation = async () => {
    if (!startingChatUserId) return;
    await startConversationWithUser(startingChatUserId);
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
        <p className="mt-2 text-sm text-white/70">تواصل مباشرة مع بقية المستخدمين على المنصة من مكان واحد.</p>
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
                  const unreadCount = conversation.unreadCount || 0;

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
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-[11px] text-[#273347]/40">
                            {formatMessageTime(conversation.last_message_at || conversation.created_at)}
                          </span>
                          {unreadCount > 0 && !isActive && (
                            <span className="flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold leading-none text-white">
                              {unreadCount > 99 ? "99+" : unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <p
                        className={`mt-3 line-clamp-2 text-sm ${
                          unreadCount > 0 && !isActive ? "font-semibold text-[#273347]" : "text-[#273347]/65"
                        }`}
                      >
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
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-[#273347]">
                      {selectedConversation.otherUser?.full_name || "المحادثة"}
                    </h2>
                    <p className="mt-1 text-sm text-[#273347]/55">
                      {selectedConversation.otherUser
                        ? accountTypeLabels[selectedConversation.otherUser.account_type]
                        : "مستخدم على المنصة"}
                    </p>
                  </div>

                  {selectedUserProfileHref && (
                    <Link
                      href={selectedUserProfileHref}
                      className="inline-flex items-center justify-center rounded-2xl border border-[#d9e3ee] bg-white px-4 py-2.5 text-sm font-semibold text-[#273347] transition hover:bg-[#f4f8fc]"
                    >
                      عرض الملف الشخصي
                    </Link>
                  )}
                </div>
              </div>

              <div className="flex flex-1 flex-col gap-4 overflow-y-auto bg-[#f6f9fc] px-4 py-5" dir="ltr">
                {messagesLoading ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">جاري تحميل الرسائل...</div>
                ) : messages.length === 0 ? (
                  <div className="py-12 text-center text-sm text-[#273347]/50">
                    لا توجد رسائل بعد. أرسل أول رسالة لبدء الحوار.
                  </div>
                ) : (
                  messages.map((message) => {
                    const isMine = isOutgoingMessage(
                      message,
                      selectedConversation,
                      currentUserId ?? currentUser?.id ?? null,
                      selectedConversation.otherUser?.id ?? null
                    );
                    const senderLabel = isMine
                      ? "أنت"
                      : selectedConversation.otherUser?.full_name || "الطرف الآخر";

                    return (
                      <div
                        key={message.id}
                        className="flex w-full"
                        style={{ justifyContent: isMine ? "flex-end" : "flex-start" }}
                      >
                        <div
                          dir="rtl"
                          className={`max-w-[80%] rounded-3xl px-4 py-3 text-sm shadow-sm ${
                            isMine ? "rounded-br-md" : "rounded-bl-md border border-[#e2e8f0]"
                          }`}
                          style={{
                            backgroundColor: isMine ? "#2563eb" : "#ffffff",
                            color: isMine ? "#ffffff" : "#273347",
                          }}
                        >
                          <div
                            className={`mb-1 text-[11px] font-medium ${
                              isMine ? "text-blue-100" : "text-[#273347]/45"
                            }`}
                          >
                            {senderLabel}
                          </div>
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
