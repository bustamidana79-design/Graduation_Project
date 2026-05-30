"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { supabase } from "@/lib/supabase";

type NotificationData = {
  action?: string;
  route?: string;
  order_id?: string;
  delivery_order_id?: string;
  product_id?: string;
  product_name?: string;
  reason?: string;
  ticket_id?: string;
  user_role?: string;
};

type NotificationItem = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  notification_type?: string | null;
  data?: NotificationData | null;
  is_read?: boolean | null;
  read_at?: string | null;
  created_at: string;
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

function formatTime(value: string) {
  return new Date(value).toLocaleString("ar-EG", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [supportLoadingId, setSupportLoadingId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read && !item.read_at).length, [items]);
  const latest = items.slice(0, 5);

  useEffect(() => {
    let mounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted || !user) return;
      setUserId(user.id);

      const headers = await getAuthHeaders();
      const response = await fetch("/api/notifications?limit=20", { headers });
      const result = await response.json();

      if (mounted && response.ok) {
        setItems(result.notifications || []);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as NotificationItem;
          setItems((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 20));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    function onClick(event: MouseEvent) {
      if (!dropdownRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const markRead = async () => {
    const unreadIds = items.filter((item) => !item.is_read && !item.read_at).map((item) => item.id);
    if (unreadIds.length === 0) return;

    setItems((current) =>
      current.map((item) =>
        unreadIds.includes(item.id) ? { ...item, is_read: true, read_at: new Date().toISOString() } : item
      )
    );

    const headers = await getAuthHeaders();
    await fetch("/api/notifications/read", {
      method: "PATCH",
      headers,
      body: JSON.stringify({ ids: unreadIds }),
    });
  };

  const toggleOpen = async () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await markRead();
    }
  };

  const handleContactSupport = async (notification: NotificationItem) => {
    if (supportLoadingId) return;

    if (notification.data?.ticket_id) {
      openSupportNotification({
        ...notification,
        notification_type: "support_ticket_message",
        data: {
          ...notification.data,
          user_role: notification.data.user_role || "supplier",
        },
      });
      return;
    }

    setSupportLoadingId(notification.id);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/support/start", {
        method: "POST",
        headers,
        body: JSON.stringify({
          ticketId: notification.data?.ticket_id,
          productId: notification.data?.product_id,
          productName: notification.data?.product_name,
          reason: notification.data?.reason,
        }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "تعذر فتح خدمة العملاء.");
      }

      setOpen(false);
      router.push(result.route || `/dashboard/supplier/customer-service?ticket=${result.ticketId}`);
    } catch (error) {
      alert(error instanceof Error ? error.message : "تعذر فتح خدمة العملاء.");
    } finally {
      setSupportLoadingId(null);
    }
  };

  const openSupportNotification = (notification: NotificationItem) => {
    const ticketId = notification.data?.ticket_id;
    const role = notification.data?.user_role;

    setOpen(false);

    if (notification.data?.action === "open_admin_support") {
      router.push(`/dashboard/admin/customer-service${ticketId ? `?ticket=${ticketId}` : ""}`);
      return;
    }

    const dashboard =
      role === "supplier"
        ? "supplier"
        : role === "small_business"
          ? "small-business"
          : role === "delivery"
            ? "shipping-company"
            : role === "supporter"
              ? "supporter"
              : "supplier";

    router.push(`/dashboard/${dashboard}/customer-service${ticketId ? `?ticket=${ticketId}` : ""}`);
  };

  const openNotification = (notification: NotificationItem) => {
    if (notification.notification_type === "support_ticket_message") {
      openSupportNotification(notification);
      return;
    }

    if (notification.data?.route) {
      setOpen(false);
      router.push(notification.data.route);
      return;
    }

    if (notification.data?.order_id) {
      setOpen(false);
      router.push(`/dashboard/small-business/orders/${notification.data.order_id}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => void toggleOpen()}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-[#e6edf5] bg-white text-[#273347] transition hover:bg-[#f8fafc]"
        aria-label="الإشعارات"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red-600 px-1.5 text-center text-[11px] font-bold leading-5 text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-[#e6edf5] bg-white text-right shadow-xl">
          <div className="border-b border-[#e6edf5] px-4 py-3">
            <p className="text-sm font-bold text-[#273347]">الإشعارات</p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {latest.length === 0 ? (
              <div className="px-4 py-6 text-sm text-[#273347]/50">لا توجد إشعارات حالياً.</div>
            ) : (
              latest.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openNotification(item)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") openNotification(item);
                  }}
                  className="cursor-pointer border-b border-[#f0f4f8] px-4 py-3 transition last:border-b-0 hover:bg-[#f8fafc]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-bold text-[#273347]">{item.title}</p>
                    {!item.is_read && !item.read_at && <span className="mt-1 h-2 w-2 rounded-full bg-red-600" />}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-[#273347]/70">{item.body}</p>
                  {item.notification_type === "product_deleted" && item.data?.action === "contact_support" && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleContactSupport(item);
                      }}
                      disabled={supportLoadingId === item.id}
                      className="mt-3 w-full rounded-xl bg-[#273347] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1e2735] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {supportLoadingId === item.id
                        ? "جاري فتح خدمة العملاء..."
                        : "للمزيد من الاستفسار - خدمة العملاء"}
                    </button>
                  )}
                  {item.notification_type === "support_ticket_message" && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openSupportNotification(item);
                      }}
                      className="mt-3 w-full rounded-xl bg-[#273347] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#1e2735]"
                    >
                      فتح مركز الدعم
                    </button>
                  )}
                  <p className="mt-2 text-[11px] text-[#273347]/40">{formatTime(item.created_at)}</p>
                </div>
              ))
            )}
          </div>

          <button
            type="button"
            onClick={() => void markRead()}
            className="w-full border-t border-[#e6edf5] px-4 py-3 text-sm font-semibold text-[#273347] hover:bg-[#f8fafc]"
          >
            عرض الكل
          </button>
        </div>
      )}
    </div>
  );
}
