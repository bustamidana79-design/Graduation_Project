type SupabaseLike = {
  from: (table: string) => any;
};

type SupportTicket = {
  id: string;
  user_id: string;
  subject: string;
  user_role?: string | null;
};

export async function notifyAdminsAboutSupportMessage(
  supabase: SupabaseLike,
  ticket: SupportTicket,
  messagePreview: string
) {
  const { data: admins, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("account_type", "admin")
    .eq("status", "approved");

  if (error || !admins?.length) return;

  await supabase.from("notifications").insert(
    admins.map((admin: { id: string }) => ({
      user_id: admin.id,
      title: "رسالة دعم جديدة",
      body: `${ticket.subject}: ${messagePreview.slice(0, 120)}`,
      notification_type: "support_ticket_message",
      data: {
        action: "open_admin_support",
        ticket_id: ticket.id,
        user_id: ticket.user_id,
        user_role: ticket.user_role,
      },
      is_read: false,
    }))
  );
}

export async function notifyUserAboutAdminSupportMessage(
  supabase: SupabaseLike,
  ticket: SupportTicket,
  messagePreview: string
) {
  await supabase.from("notifications").insert({
    user_id: ticket.user_id,
    title: "رد جديد من الإدارة",
    body: `${ticket.subject}: ${messagePreview.slice(0, 120)}`,
    notification_type: "support_ticket_message",
    data: {
      action: "open_user_support",
      ticket_id: ticket.id,
      user_role: ticket.user_role,
    },
    is_read: false,
  });
}
