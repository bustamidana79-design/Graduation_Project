import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createNotification } from "@/lib/services/notification.service";

const allowedStatuses = new Set(["active", "cancelled", "completed"]);

const statusLabels: Record<string, string> = {
  active: "تم قبول طلب الاستثمار",
  cancelled: "تم رفض طلب الاستثمار",
  completed: "تم إكمال الاستثمار",
};

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const { id } = await params;
    const body = await request.json();
    const status = String(body.status || "").trim();

    if (profile.account_type !== "small_business") {
      return NextResponse.json({ error: "Only project owners can update investment requests." }, { status: 403 });
    }

    if (!allowedStatuses.has(status)) {
      return NextResponse.json({ error: "Invalid investment status." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: investment, error: loadError } = await admin
      .from("investments")
      .select("*")
      .eq("id", id)
      .single();

    if (loadError || !investment) {
      return NextResponse.json({ error: "Investment was not found." }, { status: 404 });
    }

    if (investment.small_business_id !== user.id && investment.project_owner_id !== user.id) {
      return NextResponse.json({ error: "You cannot update this investment." }, { status: 403 });
    }

    const { data: updatedInvestment, error: updateError } = await admin
      .from("investments")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await createNotification({
      supabase: admin,
      userId: investment.supporter_id,
      title: statusLabels[status] || "تحديث على الاستثمار",
      body: `${profile.full_name || "صاحب المشروع"} حدّث حالة طلب الاستثمار إلى: ${statusLabels[status] || status}.`,
      type: "investment_status_updated",
      data: {
        investment_id: id,
        status,
        project_owner_id: user.id,
        route: "/dashboard/supporter/investments",
      },
    });

    return NextResponse.json({ investment: updatedInvestment });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update investment status.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Unauthorized" : message }, { status });
  }
}
