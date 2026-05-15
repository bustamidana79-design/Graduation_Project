import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAuthProfile } from "@/lib/api-auth";
import { createNotification } from "@/lib/services/notification.service";

const allowedTransitions: Record<string, string[]> = {
  small_business: ["merchant"],
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: unknown, maxLength = 1200) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maxLength);
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await requireAuthProfile(request);
    const { data, error } = await supabase
      .from("upgrade_requests")
      .select("id, user_id, status, request_json, admin_note, reviewed_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return jsonError(error.message, 500);
    return NextResponse.json({ requests: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (message === "PROFILE_NOT_FOUND") return jsonError("Profile not found", 404);
    return jsonError(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const targetAccountType = String(body.target_account_type || "");
    const currentAccountType = String(profile.account_type || "");
    const reason = normalizeText(body.reason);
    const experience = normalizeText(body.experience);
    const expectedUsage = normalizeText(body.expected_usage);

    if (!allowedTransitions[currentAccountType]?.includes(targetAccountType)) {
      return jsonError("هذا النوع من طلبات الترقية غير متاح لهذا الحساب.", 400);
    }

    if (reason.length < 12) {
      return jsonError("سبب الطلب يجب أن يكون أوضح من ذلك.", 400);
    }

    const { data: existingPending, error: pendingError } = await supabase
      .from("upgrade_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pending")
      .limit(1);

    if (pendingError) return jsonError(pendingError.message, 500);
    if (existingPending && existingPending.length > 0) {
      return jsonError("لديك طلب ترقية قيد المراجعة بالفعل.", 409);
    }

    const requestJson = {
      current_account_type: currentAccountType,
      target_account_type: targetAccountType,
      reason,
      experience,
      expected_usage: expectedUsage,
      profile_snapshot: {
        full_name: profile.full_name,
        email: profile.email,
        phone: profile.phone,
        country: profile.country,
        city: profile.city,
      },
    };

    const { data: upgradeRequest, error: insertError } = await supabase
      .from("upgrade_requests")
      .insert({
        user_id: user.id,
        status: "pending",
        request_json: requestJson,
      })
      .select("id, user_id, status, request_json, admin_note, reviewed_at, created_at")
      .single();

    if (insertError) return jsonError(insertError.message, 500);

    try {
      const admin = createSupabaseAdmin();
      const { data: admins } = await admin.from("profiles").select("id").eq("account_type", "admin");
      await Promise.all(
        (admins || []).map((adminProfile: { id: string }) =>
          createNotification({
            supabase: admin,
            userId: adminProfile.id,
            title: "طلب ترقية جديد",
            body: `${profile.full_name || "مستخدم"} طلب الترقية إلى ${targetAccountType}.`,
            type: "upgrade_requested",
            data: {
              upgrade_request_id: upgradeRequest.id,
              route: "/dashboard/admin/upgrade_requests",
            },
          })
        )
      );
    } catch (notificationError) {
      console.error("Upgrade admin notification failed:", notificationError);
    }

    return NextResponse.json({ request: upgradeRequest }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (message === "PROFILE_NOT_FOUND") return jsonError("Profile not found", 404);
    return jsonError(message, 500);
  }
}
