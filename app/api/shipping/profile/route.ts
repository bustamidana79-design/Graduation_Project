import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

function asText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asTextList(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean);
  }

  return asText(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);

    if (profile.account_type !== "delivery") {
      return NextResponse.json({ error: "هذه العملية مخصصة لشركات التوصيل فقط" }, { status: 403 });
    }

    const body = await request.json();
    const payload = {
      company_name: asText(body.company_name) || null,
      delivery_scope: asText(body.delivery_scope) || null,
      delivery_cities: asTextList(body.delivery_cities),
      avg_delivery_time: asText(body.avg_delivery_time) || null,
      license_no: asText(body.license_no) || null,
    };

    const { data, error } = await supabase
      .from("shipping_company_profiles")
      .update(payload)
      .eq("user_id", user.id)
      .select("company_name, delivery_scope, delivery_cities, avg_delivery_time, license_no")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
    const status = message === "UNAUTHORIZED" ? 401 : message === "PROFILE_NOT_FOUND" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
