"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TicketChatModal from "@/components/TicketChatModal";

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: string;
  user_role: string;
  last_sender_type: string;
  ai_summary: string | null;
  created_at: string;
  priority: string;
}

export default function AdminCustomerService() {
  const tabs = [
    { id: "supplier", name: "التجار" },
    { id: "small_business", name: "المشاريع الصغيرة" },
    { id: "delivery", name: "شركات الشحن" },
    { id: "supporter", name: "الداعمين" },
  ];

  const [activeTab, setActiveTab] = useState("supplier");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_role", activeTab)
        .order("created_at", { ascending: false });

      if (!error && data) {
        setTickets(data as Ticket[]);
      }
      setLoading(false);
    };

    fetchTickets();
  }, [activeTab]);

  const handleOpenTicket = async (ticket: Ticket) => {
    if (ticket.last_sender_type === "user") {
      try {
        const { error } = await supabase
          .from("support_tickets")
          .update({ last_sender_type: "admin" })
          .eq("id", ticket.id);

        if (!error) {
          setTickets((prev) =>
            prev.map((item) =>
              item.id === ticket.id ? { ...item, last_sender_type: "admin" } : item
            )
          );
          setSelectedTicket({ ...ticket, last_sender_type: "admin" });
          return;
        }
      } catch (err) {
        console.error("Error updating ticket status:", err);
      }
    }

    setSelectedTicket(ticket);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <h1 className="mb-8 text-3xl font-bold text-gray-800">مركز دعم العملاء - إدارة التذاكر</h1>

        <div className="mb-6 inline-flex space-x-2 rounded-xl border bg-white p-1 shadow-sm">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-6 py-2 text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-md"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {tab.name}
            </button>
          ))}
        </div>

        <div className="space-y-4">
          {loading ? (
            <div className="py-10 text-center font-medium text-gray-400">جاري تحميل التذاكر...</div>
          ) : tickets.length > 0 ? (
            tickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => handleOpenTicket(ticket)}
                className="group flex cursor-pointer items-center justify-between rounded-xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:border-blue-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="mt-1.5">
                    <span
                      className={`flex h-3 w-3 rounded-full ${
                        ticket.last_sender_type === "user"
                          ? "animate-pulse bg-red-500"
                          : "bg-green-500"
                      }`}
                    ></span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-gray-900 transition-colors group-hover:text-blue-600">
                      {ticket.subject}
                    </h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-purple-700">
                        AI Summary
                      </span>
                      <p className="line-clamp-1 text-sm italic text-gray-600">
                        {ticket.ai_summary || "لا يوجد ملخص متاح حالياً."}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-2 text-left">
                  <span
                    className={`rounded-full px-3 py-1 text-[11px] font-bold ${
                      ticket.priority === "high"
                        ? "bg-red-100 text-red-600"
                        : ticket.priority === "medium"
                          ? "bg-orange-100 text-orange-600"
                          : "bg-blue-100 text-blue-600"
                    }`}
                  >
                    {ticket.priority.toUpperCase()}
                  </span>
                  <p className="text-xs font-medium text-gray-400">
                    {new Date(ticket.created_at).toLocaleDateString("ar-EG")}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center text-gray-500">
              لا توجد تذاكر مفتوحة لهذه الفئة حالياً.
            </div>
          )}
        </div>
      </div>

      {selectedTicket && (
        <TicketChatModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
      )}
    </div>
  );
}
