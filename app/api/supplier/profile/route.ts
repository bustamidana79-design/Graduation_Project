import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";

export async function PATCH(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const selectedCompanyId = String(body.shipping_company_id || body.shippingCompanyId || "").trim();

    if (profile.account_type !== "merchant") {
      return NextResponse.json({ error: "هذه العملية متاحة للمورد فقط." }, { status: 403 });
    }

    if (!selectedCompanyId) {
      return NextResponse.json({ error: "يرجى اختيار شركة توصيل" }, { status: 400 });
    }

    const { data: company, error: companyError } = await supabase
      .from("shipping_company_profiles")
      .select("user_id")
      .eq("user_id", selectedCompanyId)
      .maybeSingle();

    if (companyError || !company) {
      return NextResponse.json({ error: "شركة التوصيل غير موجودة." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("supplier_profiles")
      .update({ shipping_company_id: selectedCompanyId })
      .eq("user_id", user.id)
      .select("user_id, shipping_company_id")
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: "ملف المورد غير موجود." }, { status: 404 });
    }

    return NextResponse.json({ supplier_profile: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحديث شركة التوصيل.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
