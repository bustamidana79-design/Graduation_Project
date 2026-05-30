"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Inbox,
  MessageCircle,
  Search,
  SlidersHorizontal,
  UserRound,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import TicketChatModal from "@/components/TicketChatModal";

type TicketStatus = "open" | "pending" | "closed" | string;
type TicketPriority = "low" | "medium" | "high" | string;
type SenderType = "user" | "admin" | string;

interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  status: TicketStatus;
  user_role: string;
  last_sender_type: SenderType;
  ai_summary: string | null;
  created_at: string;
  priority: TicketPriority;
  requester_name?: string | null;
  requester_email?: string | null;
}

type RequesterProfile = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  country: string | null;
};

type TicketGroup = {
  userId: string;
  tickets: Ticket[];
  latestDate: string;
};

const tabs = [
  { id: "supplier", name: "التجار" },
  { id: "small_business", name: "المشاريع الصغيرة" },
  { id: "delivery", name: "شركات الشحن" },
  { id: "supporter", name: "الداعمين" },
];

const statusLabels: Record<string, string> = {
  all: "كل الحالات",
  open: "مفتوحة",
  pending: "معلقة",
  closed: "مغلقة",
};

const priorityLabels: Record<string, string> = {
  all: "كل الأولويات",
  high: "عالية",
  medium: "متوسطة",
  low: "منخفضة",
};

const responseLabels: Record<string, string> = {
  all: "كل التذاكر",
  needs_reply: "بحاجة رد",
  answered: "تم الرد",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ar", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

export default function AdminCustomerService() {
  const searchParams = useSearchParams();
  const ticketIdFromUrl = searchParams.get("ticket");

  const [activeTab, setActiveTab] = useState("supplier");
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [requesters, setRequesters] = useState<Record<string, RequesterProfile>>({});
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [responseFilter, setResponseFilter] = useState("all");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const getRequesterName = useCallback(
    (ticket: Ticket) => requesters[ticket.user_id]?.full_name || ticket.requester_name || "مستخدم بدون اسم",
    [requesters]
  );

  const getRequesterMeta = useCallback(
    (ticket: Ticket) => {
      const requester = requesters[ticket.user_id];
      return [requester?.email || ticket.requester_email, requester?.phone, requester?.city || requester?.country]
        .filter(Boolean)
        .join(" • ");
    },
    [requesters]
  );

  const stats = useMemo(
    () => ({
      total: tickets.length,
      needsReply: tickets.filter((ticket) => ticket.last_sender_type === "user").length,
      highPriority: tickets.filter((ticket) => ticket.priority === "high").length,
      closed: tickets.filter((ticket) => ticket.status === "closed").length,
    }),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const requesterName = getRequesterName(ticket).toLowerCase();
      const requesterMeta = getRequesterMeta(ticket).toLowerCase();
      const summary = (ticket.ai_summary || "").toLowerCase();
      const subject = ticket.subject.toLowerCase();
      const matchesQuery =
        !normalizedQuery ||
        subject.includes(normalizedQuery) ||
        summary.includes(normalizedQuery) ||
        requesterName.includes(normalizedQuery) ||
        requesterMeta.includes(normalizedQuery);

      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;
      const matchesPriority = priorityFilter === "all" || ticket.priority === priorityFilter;
      const matchesResponse =
        responseFilter === "all" ||
        (responseFilter === "needs_reply" && ticket.last_sender_type === "user") ||
        (responseFilter === "answered" && ticket.last_sender_type === "admin");

      return matchesQuery && matchesStatus && matchesPriority && matchesResponse;
    });
  }, [tickets, query, getRequesterName, getRequesterMeta, statusFilter, priorityFilter, responseFilter]);

  const groupedTickets = useMemo(() => {
    const groups = new Map<string, TicketGroup>();

    filteredTickets.forEach((ticket) => {
      const current = groups.get(ticket.user_id);
      if (!current) {
        groups.set(ticket.user_id, {
          userId: ticket.user_id,
          tickets: [ticket],
          latestDate: ticket.created_at,
        });
        return;
      }

      current.tickets.push(ticket);
      if (new Date(ticket.created_at) > new Date(current.latestDate)) {
        current.latestDate = ticket.created_at;
      }
    });

    return Array.from(groups.values()).sort(
      (a, b) => new Date(b.latestDate).getTime() - new Date(a.latestDate).getTime()
    );
  }, [filteredTickets]);

  useEffect(() => {
    const fetchTickets = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("user_role", activeTab)
        .order("created_at", { ascending: false });

      if (!error && data) {
        const nextTickets = data as Ticket[];
        setTickets(nextTickets);

        const userIds = Array.from(new Set(nextTickets.map((ticket) => ticket.user_id)));
        if (userIds.length > 0) {
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email, phone, city, country")
            .in("id", userIds);

          setRequesters(
            Object.fromEntries(((profilesData || []) as RequesterProfile[]).map((profile) => [profile.id, profile]))
          );
        } else {
          setRequesters({});
        }
      }
      setLoading(false);
    };

    void fetchTickets();
  }, [activeTab]);

  useEffect(() => {
    if (!ticketIdFromUrl) return;

    const fetchTicket = async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("id", ticketIdFromUrl)
        .maybeSingle();

      if (!error && data) {
        const ticket = data as Ticket;
        setActiveTab(ticket.user_role);

        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, email, phone, city, country")
          .eq("id", ticket.user_id)
          .maybeSingle();

        if (profileData) {
          const requester = profileData as RequesterProfile;
          setRequesters((prev) => ({ ...prev, [requester.id]: requester }));
          setExpandedGroups((prev) => ({ ...prev, [ticket.user_id]: true }));
          setSelectedTicket({
            ...ticket,
            requester_name: requester.full_name,
            requester_email: requester.email,
          });
          return;
        }

        setSelectedTicket(ticket);
        setExpandedGroups((prev) => ({ ...prev, [ticket.user_id]: true }));
      }
    };

    void fetchTicket();
  }, [ticketIdFromUrl]);

  const handleOpenTicket = async (ticket: Ticket) => {
    const requester = requesters[ticket.user_id];
    const ticketWithRequester = {
      ...ticket,
      requester_name: requester?.full_name || ticket.requester_name,
      requester_email: requester?.email || ticket.requester_email,
    };

    if (ticket.last_sender_type === "user") {
      try {
        const { error } = await supabase
          .from("support_tickets")
          .update({ last_sender_type: "admin" })
          .eq("id", ticket.id);

        if (!error) {
          setTickets((prev) =>
            prev.map((item) => (item.id === ticket.id ? { ...item, last_sender_type: "admin" } : item))
          );
          setSelectedTicket({ ...ticketWithRequester, last_sender_type: "admin" });
          return;
        }
      } catch (err) {
        console.error("Error updating ticket status:", err);
      }
    }

    setSelectedTicket(ticketWithRequester);
  };

  const toggleGroup = (userId: string) => {
    setExpandedGroups((prev) => ({ ...prev, [userId]: !prev[userId] }));
  };

  const resetFilters = () => {
    setQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setResponseFilter("all");
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] p-4 sm:p-6" dir="rtl">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#52789f]">لوحة الإدارة</p>
            <h1 className="mt-2 text-2xl font-bold text-[#273347] sm:text-3xl">مركز دعم العملاء</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#273347]/60">
              متابعة تذاكر المستخدمين حسب نوع الحساب، ترتيب الأولويات، والرد من نفس المحادثة.
            </p>
          </div>

          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d9e3ef] bg-white px-4 py-2.5 text-sm font-semibold text-[#273347] shadow-sm transition hover:border-[#52789f]"
          >
            <SlidersHorizontal className="h-4 w-4" />
            تصفير الفلاتر
          </button>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Inbox} label="إجمالي التذاكر" value={stats.total} tone="blue" />
          <StatCard icon={AlertCircle} label="بحاجة رد" value={stats.needsReply} tone="red" />
          <StatCard icon={Clock3} label="أولوية عالية" value={stats.highPriority} tone="amber" />
          <StatCard icon={CheckCircle2} label="مغلقة" value={stats.closed} tone="green" />
        </section>

        <section className="rounded-lg border border-[#dfe8f2] bg-white p-3 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-[#273347] text-white shadow-sm"
                      : "bg-[#f4f7fb] text-[#273347]/70 hover:bg-[#e9f0f8] hover:text-[#273347]"
                  }`}
                >
                  {tab.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="grid gap-3 rounded-lg border border-[#dfe8f2] bg-white p-4 shadow-sm lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#52789f]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث بالعنوان، المستخدم، البريد، أو ملخص الذكاء الاصطناعي"
              className="h-11 w-full rounded-lg border border-[#d9e3ef] bg-[#fbfdff] pr-10 pl-3 text-sm text-[#273347] outline-none transition focus:border-[#52789f] focus:bg-white"
            />
          </label>

          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={statusLabels} />
          <FilterSelect value={priorityFilter} onChange={setPriorityFilter} options={priorityLabels} />
          <FilterSelect value={responseFilter} onChange={setResponseFilter} options={responseLabels} />
        </section>

        <section className="space-y-4">
          {loading ? (
            <div className="rounded-lg border border-dashed border-[#d9e3ef] bg-white py-16 text-center text-sm font-semibold text-[#52789f]">
              جاري تحميل التذاكر...
            </div>
          ) : groupedTickets.length > 0 ? (
            groupedTickets.map((group) => {
              const firstTicket = group.tickets[0];
              const unreadCount = group.tickets.filter((ticket) => ticket.last_sender_type === "user").length;
              const isExpanded = Boolean(expandedGroups[group.userId]);

              return (
                <section key={group.userId} className="overflow-hidden rounded-lg border border-[#dfe8f2] bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.userId)}
                    className="flex w-full flex-col gap-3 p-4 text-right transition hover:bg-[#fbfdff] md:flex-row md:items-center md:justify-between"
                    aria-expanded={isExpanded}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e3ef] text-[#52789f] transition ${
                          isExpanded ? "bg-[#273347] text-white" : "bg-white"
                        }`}
                      >
                        <ChevronDown className={`h-4 w-4 transition ${isExpanded ? "rotate-180" : ""}`} />
                      </span>
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#edf4fb] text-[#52789f]">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[#273347]">{getRequesterName(firstTicket)}</h2>
                        <p className="mt-1 truncate text-xs text-[#273347]/55">
                          {getRequesterMeta(firstTicket) || `ID: ${group.userId.slice(0, 8)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {unreadCount > 0 && (
                        <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-bold text-red-600">
                          {unreadCount.toLocaleString("ar")} بحاجة رد
                        </span>
                      )}
                      <span className="rounded-full bg-[#edf4fb] px-3 py-1 text-xs font-bold text-[#52789f]">
                        {group.tickets.length.toLocaleString("ar")} تذاكر
                      </span>
                      <span className="rounded-full bg-[#f6f8fb] px-3 py-1 text-xs font-bold text-[#273347]/60">
                        آخر تحديث {formatDate(group.latestDate)}
                      </span>
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="divide-y divide-[#edf2f7] border-t border-[#edf2f7]">
                      {group.tickets.map((ticket) => (
                        <button
                          key={ticket.id}
                          type="button"
                          onClick={() => handleOpenTicket(ticket)}
                          className="group grid w-full gap-4 bg-[#fcfdff] p-4 text-right transition hover:bg-white md:grid-cols-[1fr_auto]"
                        >
                          <div className="flex min-w-0 gap-3">
                            <span
                              className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                                ticket.last_sender_type === "user" ? "bg-red-500" : "bg-green-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="max-w-full truncate text-base font-bold text-[#273347] group-hover:text-[#52789f]">
                                  {ticket.subject || "تذكرة بدون عنوان"}
                                </h3>
                                <TicketPill value={ticket.status} kind="status" />
                                <TicketPill value={ticket.priority} kind="priority" />
                              </div>
                              <div className="mt-2 flex max-w-3xl items-start gap-2 rounded-lg border border-[#d9e3ef] bg-[#f4f8fc] px-3 py-2">
                                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#52789f]" />
                                <p className="line-clamp-2 text-sm leading-6 text-[#42617f]">
                                  {ticket.ai_summary || "لا يوجد ملخص متاح حاليا."}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                ticket.last_sender_type === "user"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-green-50 text-green-700"
                              }`}
                            >
                              {ticket.last_sender_type === "user" ? "بانتظار الإدارة" : "آخر رد من الإدارة"}
                            </span>
                            <p className="text-xs font-semibold text-[#273347]/45">{formatDate(ticket.created_at)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          ) : (
            <div className="rounded-lg border border-dashed border-[#d9e3ef] bg-white p-12 text-center">
              <Inbox className="mx-auto h-10 w-10 text-[#9eb3c7]" />
              <h2 className="mt-4 text-base font-bold text-[#273347]">لا توجد تذاكر مطابقة</h2>
              <p className="mt-2 text-sm text-[#273347]/55">جرّب تغيير الفلاتر أو اختيار فئة أخرى من المستخدمين.</p>
            </div>
          )}
        </section>
      </div>

      {selectedTicket && <TicketChatModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone: "blue" | "red" | "amber" | "green";
}) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-green-50 text-green-700",
  };

  return (
    <div className="rounded-lg border border-[#dfe8f2] bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#273347]/55">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[#273347]">{value.toLocaleString("ar")}</p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Record<string, string>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-lg border border-[#d9e3ef] bg-[#fbfdff] px-3 text-sm font-semibold text-[#273347] outline-none transition focus:border-[#52789f] focus:bg-white"
    >
      {Object.entries(options).map(([optionValue, label]) => (
        <option key={optionValue} value={optionValue}>
          {label}
        </option>
      ))}
    </select>
  );
}

function TicketPill({ value, kind }: { value: string; kind: "status" | "priority" }) {
  const labels = kind === "status" ? statusLabels : priorityLabels;
  const classes =
    kind === "priority" && value === "high"
      ? "bg-red-50 text-red-600"
      : kind === "priority" && value === "medium"
        ? "bg-amber-50 text-amber-700"
        : kind === "priority"
          ? "bg-blue-50 text-blue-700"
          : value === "closed"
            ? "bg-green-50 text-green-700"
            : "bg-[#edf4fb] text-[#52789f]";

  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes}`}>{labels[value] || value}</span>;
}
