import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { provisionApprovedAccount } from "@/lib/account-provisioning";

type ReviewStatus = "approved" | "rejected";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";

    if (!token) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const applicationId = String(body.applicationId || "");
    const status = body.status as ReviewStatus;
    const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";

    if (!applicationId || !["approved", "rejected"].includes(status)) {
      return jsonError("Invalid review request", 400);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return jsonError("Unauthorized", 401);
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("account_type")
      .eq("id", user.id)
      .single();

    if (profileError || profile?.account_type !== "admin") {
      return jsonError("Admin access required", 403);
    }

    const adminSupabase = process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createSupabaseAdmin()
      : userClient;

    const { data: application, error: fetchError } = await adminSupabase
      .from("applications")
      .select("*")
      .eq("id", applicationId)
      .single();

    if (fetchError || !application) {
      return jsonError(fetchError?.message || "Application not found", 404);
    }

    const reviewedAt = new Date().toISOString();

    const { error: appError } = await adminSupabase
      .from("applications")
      .update({
        status,
        admin_note: adminNote || null,
        reviewed_at: reviewedAt,
        reviewed_by: user.id,
      })
      .eq("id", applicationId);

    if (appError) {
      return jsonError(appError.message, 500);
    }

    const { error: reviewError } = await adminSupabase.from("admin_reviews").insert({
      application_id: applicationId,
      admin_id: user.id,
      decision: status,
      reason: adminNote || null,
    });

    if (reviewError) {
      return jsonError(reviewError.message, 500);
    }

    if (status === "approved") {
      const basic = application.data_json?.basic || {};
      const accountType = application.account_type;

      const { error: profileUpsertError } = await adminSupabase.from("profiles").upsert(
        {
          id: application.user_id,
          full_name: basic.full_name,
          email: basic.email,
          phone: basic.phone,
          country: basic.country,
          city: basic.city,
          account_type: accountType,
          status: "approved",
        },
        { onConflict: "id" }
      );

      if (profileUpsertError) {
        return jsonError(profileUpsertError.message, 500);
      }

      await provisionApprovedAccount({
        supabase: adminSupabase,
        userId: application.user_id,
        accountType,
        basic,
        typeSpecific: application.data_json?.type_specific || {},
        proofJson: application.proof_json,
      });
    } else {
      const { error: rejectProfileError } = await adminSupabase
        .from("profiles")
        .update({ status: "rejected" })
        .eq("id", application.user_id);

      if (rejectProfileError) {
        return jsonError(rejectProfileError.message, 500);
      }
    }

    return NextResponse.json({ success: true, status, reviewedAt });
  } catch (error: any) {
    return jsonError(error.message || "Unexpected review error", 500);
  }
}
