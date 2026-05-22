"use client";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

const supportRoleLabels: Record<string, string> = {
  supplier: "التاجر",
  small_business: "صاحب المشروع الصغير",
  delivery: "شركة الشحن",
  supporter: "الداعم",
};

type TicketChatModalProps = {
  ticket: SupportTicket;
  onClose: () => void;
  supportLabel?: string;
};

type SupportTicket = {
  id: string;
  subject: string;
  ai_summary: string | null;
  user_role?: string;
  user_id: string;
  message?: string;
  created_at: string;
};

type TicketMessage = {
  id: string;
  ticket_id: string;
  message: string;
  sender_type?: "user" | "admin";
  sender_id: string;
  created_at: string;
};

const sortMessages = (items: TicketMessage[]) =>
  [...items].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

const mergeMessages = (current: TicketMessage[], incoming: TicketMessage[]) => {
  const byId = new Map<string, TicketMessage>();

  [...current, ...incoming].forEach((message) => {
    byId.set(message.id, message);
  });

  return sortMessages(Array.from(byId.values()));
};

export default function TicketChatModal({
  ticket,
  onClose,
  supportLabel,
}: TicketChatModalProps) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCustomerView = Boolean(supportLabel);
  const senderTypeForCurrentUser: "user" | "admin" = isCustomerView ? "user" : "admin";
  const currentUserLabel = isCustomerView
    ? supportRoleLabels[ticket.user_role || ""] || supportLabel || "اليوزر"
    : "أدمن";
  const otherPartyLabel = isCustomerView
    ? "أدمن"
    : supportRoleLabels[ticket.user_role || ""] || "اليوزر";

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from("ticket_messages")
          .select("*")
          .eq("ticket_id", ticket.id)
          .order("created_at", { ascending: true });

        if (fetchError) {
          console.error("Error fetching messages:", fetchError);
          setError("فشل في تحميل الرسائل");
          return;
        }

        const allMessages = (data || []) as TicketMessage[];
        const hasInitialMessage = allMessages.some(
          (msg) => msg.message === ticket.message && msg.sender_type === "user"
        );

        if (!hasInitialMessage && ticket.message) {
          allMessages.unshift({
            id: `ticket-${ticket.id}`,
            ticket_id: ticket.id,
            message: ticket.message,
            sender_type: "user",
            sender_id: ticket.user_id,
            created_at: ticket.created_at,
          });
        }

        setMessages((prev) => mergeMessages(prev, allMessages));
      } catch (err) {
        console.error("Unexpected error fetching messages:", err);
        setError("حدث خطأ غير متوقع");
      }
    };

    fetchMessages();
    const syncInterval = window.setInterval(fetchMessages, 2000);

    const ticketChannel = supabase
      .channel(`chat-${ticket.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_messages",
          filter: `ticket_id=eq.${ticket.id}`,
        },
        (payload) => {
          setMessages((prev) => mergeMessages(prev, [payload.new as TicketMessage]));
        }
      )
      .subscribe();

    return () => {
      window.clearInterval(syncInterval);
      supabase.removeChannel(ticketChannel);
    };
  }, [ticket.id, ticket.message, ticket.user_id, ticket.created_at]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    setIsSending(true);
    setError(null);

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        setError("خطأ في المصادقة: " + authError.message);
        setIsSending(false);
        return;
      }

      if (!user) {
        setError("انتهت الجلسة، يرجى إعادة تسجيل الدخول");
        setIsSending(false);
        return;
      }

      const trimmedMessage = newMessage.trim();
      const { data: insertedMessage, error: msgError } = await supabase
        .from("ticket_messages")
        .insert([
          {
            ticket_id: ticket.id,
            message: trimmedMessage,
            sender_type: senderTypeForCurrentUser,
            sender_id: user.id,
          },
        ])
        .select("*")
        .single();

      if (msgError) {
        console.error("خطأ في إرسال الرسالة:", msgError);
        setError("خطأ في إرسال الرسالة: " + msgError.message);
        setIsSending(false);
        return;
      }

      if (insertedMessage) {
        setMessages((prev) => mergeMessages(prev, [insertedMessage as TicketMessage]));
      }

      const { error: updateError } = await supabase
        .from("support_tickets")
        .update({
          last_sender_type: senderTypeForCurrentUser,
          status: "open",
        })
        .eq("id", ticket.id);

      if (updateError) {
        console.error("فشل تحديث الحالة:", updateError.message);
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      await fetch("/api/tickets/notify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          ticketId: ticket.id,
          senderType: senderTypeForCurrentUser,
          message: trimmedMessage,
        }),
      }).catch((notifyError) => {
        console.error("فشل إرسال إشعار التذكرة:", notifyError);
      });

      setNewMessage("");
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "خطأ غير معروف";
      console.error("خطأ مفاجئ:", err);
      setError("حدث خطأ غير متوقع: " + errorMessage);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm shadow-inner"
      style={{ zIndex: 99999 }}
    >
      <div
        className="relative flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200"
        dir="rtl"
      >
        <div className="flex items-center justify-between border-b bg-gray-50 p-4">
          <div className="flex-1 text-right">
            <h2 className="line-clamp-1 text-lg font-bold text-gray-800">{ticket.subject}</h2>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-md bg-purple-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                AI Summary
              </span>
              <p className="line-clamp-1 text-xs italic text-gray-500">
                {ticket.ai_summary || "لا يوجد ملخص"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-4 text-3xl font-light text-gray-400 transition-colors hover:text-red-500"
          >
            &times;
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-[#f0f2f5] p-4" dir="ltr">
          {messages.map((msg) => {
            const senderType = msg.sender_type || "user";
            const isCurrentUserMessage = senderType === senderTypeForCurrentUser;
            const senderLabel = isCurrentUserMessage ? currentUserLabel : otherPartyLabel;

            return (
              <div
                key={msg.id}
                className={`flex ${isCurrentUserMessage ? "justify-end" : "justify-start"}`}
              >
                <div
                  dir="rtl"
                  className={`max-w-[75%] rounded-2xl p-3 shadow-sm ${
                    isCurrentUserMessage
                      ? "rounded-tl-none bg-blue-600 text-white"
                      : "rounded-tr-none border border-gray-200 bg-white text-gray-800"
                  }`}
                >
                  <div
                    className={`mb-1 text-[10px] font-medium ${
                      isCurrentUserMessage ? "text-blue-100" : "text-gray-500"
                    }`}
                  >
                    {senderLabel}
                  </div>
                  <p className="text-sm leading-relaxed">{msg.message}</p>
                  <span
                    className={`mt-1 block text-[10px] ${
                      isCurrentUserMessage ? "text-blue-100" : "text-gray-400"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            );
          })}
          <div ref={scrollRef} />
        </div>

        <div className="border-t bg-white p-4">
          {error && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-sm text-red-700">
              {error}
            </div>
          )}
          <div className="flex items-center gap-2 rounded-full border bg-gray-100 px-4 py-2 transition-all focus-within:border-blue-500 focus-within:bg-white">
            <input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !isSending && handleSendMessage()}
              placeholder="اكتب ردك هنا..."
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none"
              disabled={isSending}
            />
            <button
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || isSending}
              className="text-sm font-bold text-blue-600 transition-colors hover:text-blue-800 disabled:text-gray-300"
            >
              {isSending ? "جاري الإرسال..." : "إرسال"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
