"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import TicketChatModal from "./TicketChatModal";

interface Props {
  role: 'supplier' | 'small_business' | 'delivery' | 'supporter';
  title: string;
}

type SupportTicket = {
  id: string;
  subject: string;
  status: string;
  ai_summary: string | null;
  last_sender_type: 'user' | 'admin';
  user_id: string;
  user_role: Props["role"];
  message?: string;
  created_at: string;
};

type CreateTicketResponse = {
  error?: string;
  warning?: string;
};

export default function SupportServiceTemplate({ role, title }: Props) {
  const searchParams = useSearchParams();
  const ticketIdFromUrl = searchParams.get("ticket");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);

  const handleTicketClick = async (ticket: SupportTicket) => {
    if (ticket.last_sender_type === 'admin') {
      try {
        const { error } = await supabase
          .from('support_tickets')
          .update({ last_sender_type: 'user' })
          .eq('id', ticket.id);

        if (!error) {
          setMyTickets((prev) => prev.map((item) =>
            item.id === ticket.id ? { ...item, last_sender_type: 'user' } : item
          ));
          setSelectedTicket({ ...ticket, last_sender_type: 'user' });
          return;
        }
      } catch (updateError) {
        console.error('Error updating ticket status:', updateError);
      }
    }

    setSelectedTicket(ticket);
  };
  const [error, setError] = useState<string | null>(null);

  const fetchMyTickets = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("Auth error:", authError);
        return;
      }
      if (user) {
        const { data, error } = await supabase
          .from('support_tickets')
          .select('*')
          .eq('user_id', user.id)
          .eq('user_role', role)
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching tickets:", error);
          return;
        }
        
        const nextTickets = (data || []) as SupportTicket[];
        setMyTickets(nextTickets);

        if (ticketIdFromUrl) {
          const requestedTicket = nextTickets.find((ticket) => ticket.id === ticketIdFromUrl);
          if (requestedTicket) setSelectedTicket(requestedTicket);
        }
      }
    } catch (err) {
      console.error("Unexpected error in fetchMyTickets:", err);
    }
  }, [role, ticketIdFromUrl]);

  useEffect(() => {
    fetchMyTickets();

    // إضافة real-time subscription لتحديث قائمة التذاكر
    const channel = supabase
      .channel('tickets-updates')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'support_tickets'
      }, (payload) => {
        console.log('Ticket updated:', payload.new);
        fetchMyTickets();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchMyTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !message.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();

      if (authError) {
        setError("خطأ في المصادقة: " + authError.message);
        setIsSubmitting(false);
        return;
      }

      if (!user) {
        setError("انتهت الجلسة، يرجى إعادة تسجيل الدخول");
        setIsSubmitting(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          subject: subject.trim(),
          first_message: message.trim(),
          user_role: role,
        }),
      });

      const result: CreateTicketResponse = await response.json();

      if (!response.ok) {
        setError(result.error || "فشل في إنشاء التذكرة");
        setIsSubmitting(false);
        return;
      }

      // تحديث القائمة
      await fetchMyTickets();

      // إعادة تعيين النموذج
      setSubject("");
      setMessage("");

      if (result.warning) {
        setError(result.warning);
      }

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "خطأ غير معروف";
      console.error("خطأ مفاجئ:", err);
      setError("حدث خطأ غير متوقع: " + errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto min-h-screen bg-gray-50">
      <h1 className="text-2xl font-bold mb-8 text-gray-800">{title}</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Ù†Ù…ÙˆØ°Ø¬ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCreateTicket} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="font-bold mb-4 text-gray-700">رسالة جديدة </h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <input 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                placeholder="عنوان الرسالة"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                disabled={isSubmitting}
                maxLength={100}
                required
              />
              <textarea 
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl h-32 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                placeholder="محتوى الرسالة (وصف المشكلة بالتفصيل)"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                disabled={isSubmitting}
                maxLength={1000}
                required
              />
              <button 
                type="submit"
                disabled={isSubmitting || !subject.trim() || !message.trim()}
                className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "جاري الإرسال..." : "إرسال"}
              </button>
            </div>
          </form>
        </div>

        {/* Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„ØªØ°Ø§ÙƒØ± */}
        <div className="lg:col-span-2 space-y-4">رسائلي السابقة
          <h2 className="font-bold text-gray-700 mb-2"></h2>
          {myTickets.length > 0 ? myTickets.map((ticket) => (
            <div 
              key={ticket.id}
              onClick={() => handleTicketClick(ticket)}
              className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center cursor-pointer hover:border-blue-200 hover:shadow-md transition-all group"
            >
              <div className="flex items-center gap-4">
                <span className={`w-3 h-3 rounded-full ${ticket.last_sender_type === 'admin' ? 'bg-green-500 animate-pulse' : 'bg-gray-300'}`}></span>
                <div>
                  <h3 className="font-bold text-gray-800 group-hover:text-blue-600">{ticket.subject}</h3>
                  <p className="mt-1 text-xs font-medium italic text-[#52789f]">AI: {ticket.ai_summary || "جاري التلخيص..."}</p>
                </div>
              </div>
              <div className="text-left">
                <span className={`text-[10px] px-2 py-1 rounded-full font-bold ${ticket.last_sender_type === 'admin' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
  {ticket.last_sender_type === 'admin' ? 'تم الرد' : 'بانتظار الرد'}
</span>
              </div>
            </div>
          )) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
لا يوجد تذاكر حالياً             </div>
          )}
        </div>
      </div>

      {selectedTicket && (
        <TicketChatModal
          ticket={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          supportLabel={title}
        />
      )}
    </div>
  );
}
