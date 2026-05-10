import { createSupabaseAdmin } from "@/lib/supabase-admin";

type SupabaseClient = {
  from: (table: string) => any;
};

type NotificationParams = {
  supabase: SupabaseClient;
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, unknown>;
};

export async function createNotification({ supabase, userId, title, body, type, data: metadata }: NotificationParams) {
  if (!userId) return null;

  const payload = {
    user_id: userId,
    title,
    body,
    notification_type: type,
    data: metadata || {},
    is_read: false,
  };

  const { data: notification, error } = await supabase
    .from("notifications")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    try {
      const admin = createSupabaseAdmin();
      const fallback = await admin.from("notifications").insert(payload).select("*").single();
      if (fallback.error) throw new Error(fallback.error.message);
      return fallback.data;
    } catch (fallbackError) {
      console.error("Notification create failed:", fallbackError);
      return null;
    }
  }

  return notification;
}

export async function listNotifications(supabase: SupabaseClient, userId: string, limit = 20) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data || [];
}

export async function markNotificationsRead(supabase: SupabaseClient, userId: string, ids?: string[]) {
  let query = supabase
    .from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("user_id", userId);

  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }

  const { error } = await query;
  if (error) throw new Error(error.message);
}
