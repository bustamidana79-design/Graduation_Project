import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { createNotification } from "@/lib/services/notification.service";

const investmentTypes = new Set(["funding", "partnership", "mentorship", "services", "other"]);
const currencies = new Set(["ILS", "USD", "JOD"]);

function toPositiveNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue > 0 ? numberValue : null;
}

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json();

    if (profile.account_type !== "supporter") {
      return NextResponse.json({ error: "Only supporters can create investments." }, { status: 403 });
    }

    const smallBusinessId = String(body.small_business_id || body.project_owner_id || "").trim();
    const amount = toPositiveNumber(body.amount);
    const currency = currencies.has(String(body.currency)) ? String(body.currency) : "ILS";
    const investmentType = investmentTypes.has(String(body.investment_type)) ? String(body.investment_type) : "funding";
    const expectedReturn =
      body.expected_return === null || body.expected_return === "" || body.expected_return === undefined
        ? null
        : Number(body.expected_return);

    if (!smallBusinessId || !amount) {
      return NextResponse.json({ error: "Missing investment project or amount." }, { status: 400 });
    }

    if (expectedReturn !== null && (!Number.isFinite(expectedReturn) || expectedReturn < 0)) {
      return NextResponse.json({ error: "Invalid expected return." }, { status: 400 });
    }

    const admin = createSupabaseAdmin();
    const { data: projectProfile, error: projectError } = await admin
      .from("profiles")
      .select("id, full_name, account_type, status")
      .eq("id", smallBusinessId)
      .single();

    if (projectError || !projectProfile || projectProfile.account_type !== "small_business" || projectProfile.status !== "approved") {
      return NextResponse.json({ error: "Project is not available for investment." }, { status: 404 });
    }

    const { data: investment, error: insertError } = await admin
      .from("investments")
      .insert({
        supporter_id: user.id,
        small_business_id: smallBusinessId,
        project_owner_id: smallBusinessId,
        amount,
        currency,
        investment_type: investmentType,
        expected_return: expectedReturn,
        notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
        status: "pending",
      })
      .select("*")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    await createNotification({
      supabase: admin,
      userId: smallBusinessId,
      title: "طلب استثمار جديد",
      body: `${profile.full_name || "داعم"} سجّل طلب استثمار بقيمة ${amount.toLocaleString("ar")} ${currency}.`,
      type: "investment_requested",
      data: {
        investment_id: investment.id,
        supporter_id: user.id,
        route: "/dashboard/small-business/investments",
      },
    });

    return NextResponse.json({ investment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create investment.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "Unauthorized" : message }, { status });
  }
}
