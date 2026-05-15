import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireAdmin } from "@/lib/api-auth";
import { provisionApprovedAccount } from "@/lib/account-provisioning";
import { createNotification } from "@/lib/services/notification.service";

type ReviewStatus = "approved" | "rejected";

const accountTypeLabels: Record<string, string> = {
  merchant: "مورد",
  small_business: "مشروع صغير",
  delivery: "شركة شحن",
  supporter: "داعم",
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeAdminNote(value: unknown) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, 1200);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "") as ReviewStatus;
    const adminNote = normalizeAdminNote(body.admin_note);

    if (!id || !["approved", "rejected"].includes(status)) {
      return jsonError("Invalid review request.", 400);
    }

    const admin = createSupabaseAdmin();
    const { data: upgradeRequest, error: requestError } = await admin
      .from("upgrade_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (requestError || !upgradeRequest) {
      return jsonError(requestError?.message || "Upgrade request not found.", 404);
    }

    if (upgradeRequest.status !== "pending") {
      return jsonError("تمت مراجعة هذا الطلب مسبقًا.", 409);
    }

    const targetAccountType = String(upgradeRequest.request_json?.target_account_type || "");
    const reviewedAt = new Date().toISOString();

    if (status === "approved") {
      if (!accountTypeLabels[targetAccountType]) {
        return jsonError("نوع الحساب المطلوب غير صالح.", 400);
      }

      const { data: profile, error: profileError } = await admin
        .from("profiles")
        .select("id, full_name, email, phone, country, city")
        .eq("id", upgradeRequest.user_id)
        .single();

      if (profileError || !profile) {
        return jsonError(profileError?.message || "Profile not found.", 404);
      }

      const { error: profileUpdateError } = await admin
        .from("profiles")
        .update({
          account_type: targetAccountType,
          status: "approved",
          updated_at: reviewedAt,
        })
        .eq("id", upgradeRequest.user_id);

      if (profileUpdateError) return jsonError(profileUpdateError.message, 500);

      await provisionApprovedAccount({
        supabase: admin,
        userId: upgradeRequest.user_id,
        accountType: targetAccountType,
        basic: {
          full_name: profile.full_name,
          email: profile.email,
          phone: profile.phone,
          country: profile.country,
          city: profile.city,
        },
        typeSpecific: {
          previous_experience: upgradeRequest.request_json?.experience,
          interests: upgradeRequest.request_json?.expected_usage,
          support_type: "financial",
          project_name: profile.full_name,
          store_name: profile.full_name,
          company_name: profile.full_name,
        },
      });
    }

    const { data: updatedRequest, error: updateError } = await admin
      .from("upgrade_requests")
      .update({
        status,
        admin_note: adminNote || null,
        reviewed_at: reviewedAt,
        reviewed_by: user.id,
      })
      .eq("id", id)
      .select("id, user_id, status, request_json, admin_note, reviewed_at, reviewed_by, created_at")
      .single();

    if (updateError) return jsonError(updateError.message, 500);

    await createNotification({
      supabase: admin,
      userId: upgradeRequest.user_id,
      title: status === "approved" ? "تم قبول طلب الترقية" : "تم رفض طلب الترقية",
      body:
        status === "approved"
          ? `تمت ترقية حسابك إلى ${accountTypeLabels[targetAccountType]}.`
          : adminNote || "راجعت الإدارة طلب الترقية ولم تتم الموافقة عليه حاليًا.",
      type: "upgrade_status_updated",
      data: {
        upgrade_request_id: id,
        status,
        route: "/",
      },
    });

    return NextResponse.json({ request: updatedRequest });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (message === "UNAUTHORIZED") return jsonError("Unauthorized", 401);
    if (message === "PROFILE_NOT_FOUND") return jsonError("Profile not found", 404);
    if (message === "FORBIDDEN") return jsonError("Admin access required", 403);
    return jsonError(message, 500);
  }
}
