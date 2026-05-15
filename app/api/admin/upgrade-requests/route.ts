import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);
    const admin = createSupabaseAdmin();

    const { data: requests, error } = await admin
      .from("upgrade_requests")
      .select("id, user_id, status, request_json, admin_note, reviewed_at, reviewed_by, created_at")
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);

    const userIds = Array.from(new Set((requests || []).map((item: { user_id: string }) => item.user_id).filter(Boolean)));
    const { data: profiles, error: profilesError } = userIds.length
      ? await admin.from("profiles").select("id, full_name, email, phone, country, city, account_type, status").in("id", userIds)
      : { data: [], error: null };

    if (profilesError) return jsonError(profilesError.message, 500);

    const profilesById = Object.fromEntries((profiles || []).map((profile: { id: string }) => [profile.id, profile]));

    return NextResponse.json({
      requests: (requests || []).map((item: { user_id: string }) => ({
        ...item,
        profile: profilesById[item.user_id] || null,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (message === "PROFILE_NOT_FOUND") return jsonError("Profile not found", 404);
    if (message === "FORBIDDEN") return jsonError("Admin access required", 403);
    return jsonError(message, 500);
  }
}
