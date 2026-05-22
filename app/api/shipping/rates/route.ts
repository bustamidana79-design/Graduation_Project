import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { getShippingRate } from "@/lib/services/shipping.service";

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const { searchParams } = new URL(request.url);
    const shippingCompanyId = String(searchParams.get("shippingCompanyId") || searchParams.get("shipping_company_id") || "").trim();
    const city = String(searchParams.get("city") || "").trim();
    const area = String(searchParams.get("area") || "").trim();
    const companyId = shippingCompanyId || user.id;

    if (city) {
      const rate = await getShippingRate(supabase, companyId, city, area || null);
      return NextResponse.json({ rate });
    }

    if (profile.account_type !== "delivery" && !shippingCompanyId) {
      return NextResponse.json({ error: "هذه العملية متاحة لشركة الشحن فقط." }, { status: 403 });
    }

    const { data, error } = await supabase
      .from("shipping_rates")
      .select("*")
      .eq("shipping_company_id", companyId)
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rates: data || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر تحميل أسعار الشحن.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "شركة الشحن لا تغطي هذه المنطقة" ? 404 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const city = String(body.city || "").trim();
    const area = body.area ? String(body.area).trim() : null;
    const price = Number(body.price);

    if (profile.account_type !== "delivery") {
      return NextResponse.json({ error: "هذه العملية متاحة لشركة الشحن فقط." }, { status: 403 });
    }

    if (!city) {
      return NextResponse.json({ error: "يرجى اختيار المدينة." }, { status: 400 });
    }

    if (!Number.isFinite(price) || price < 0) {
      return NextResponse.json({ error: "يرجى إدخال سعر شحن صحيح." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("shipping_rates")
      .insert({
        shipping_company_id: user.id,
        city,
        area,
        price,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ rate: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "تعذر إضافة سعر الشحن.";
    const status = message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: message === "UNAUTHORIZED" ? "يجب تسجيل الدخول." : message }, { status });
  }
}
