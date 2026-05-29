import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { createSupabaseAdmin } from "@/lib/supabase-admin";
import { requireSmallBusiness } from "@/lib/services/cart.service";
import { createOrdersFromCart } from "@/lib/services/order.service";
import { normalizeCurrency } from "@/lib/currency";

const validationErrors = new Set([
  "PHONE_REQUIRED",
  "COUNTRY_REQUIRED",
  "CITY_REQUIRED",
  "AREA_REQUIRED",
  "ADDRESS_REQUIRED",
  "POSTAL_CODE_REQUIRED",
  "CUSTOMER_TYPE_REQUIRED",
  "NATIONAL_ID_REQUIRED",
  "PASSPORT_NUMBER_REQUIRED",
  "CART_EMPTY",
]);

export async function POST(request: NextRequest) {
  try {
    const { user, profile } = await requireAuthProfile(request);
    const body = await request.json();
    const phone = String(body.phone || "").trim();
    const country = String(body.country || "").trim();
    const city = String(body.city || "").trim();
    const area = String(body.area || "").trim();
    const addressText = String(body.address_text || body.addressText || "").trim();
    const postalCode = body.postal_code || body.postalCode ? String(body.postal_code || body.postalCode).trim() : null;
    const customerType = String(body.customer_type || body.customerType || "").trim();
    const nationalId = body.national_id || body.nationalId ? String(body.national_id || body.nationalId).trim() : null;
    const passportNumber =
      body.passport_number || body.passportNumber ? String(body.passport_number || body.passportNumber).trim() : null;
    const notes = body.notes ? String(body.notes).trim() : null;
    const currency = normalizeCurrency(body.currency || profile.preferred_currency);
    const selectedProductIds = Array.isArray(body.product_ids)
      ? body.product_ids.map(String)
      : Array.isArray(body.productIds)
        ? body.productIds.map(String)
        : [];

    requireSmallBusiness(profile);

    const supabase = createSupabaseAdmin();
    const orders = await createOrdersFromCart(
      supabase,
      user.id,
      {
        phone,
        country,
        city,
        area,
        addressText,
        postalCode,
        customerType: customerType as "citizen" | "visitor" | "",
        nationalId,
        passportNumber,
        notes,
      },
      currency,
      selectedProductIds
    );

    return NextResponse.json({ orders }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create order.";
    const status =
      message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : validationErrors.has(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
