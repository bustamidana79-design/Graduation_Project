import { NextRequest, NextResponse } from "next/server";
import { requireAuthProfile } from "@/lib/api-auth";
import { requireSmallBusiness } from "@/lib/services/cart.service";

function cleanText(value: unknown) {
  return String(value || "").trim();
}

export async function GET(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    requireSmallBusiness(profile);

    const { data, error } = await supabase
      .from("addresses")
      .select("id, city, street_address, phone, notes, is_default")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load addresses.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user, profile } = await requireAuthProfile(request);
    requireSmallBusiness(profile);
    const body = await request.json();

    const city = cleanText(body.city);
    const streetAddress = cleanText(body.street_address || body.streetAddress);
    const phone = cleanText(body.phone);
    const notes = cleanText(body.notes);

    if (!city || !streetAddress) {
      return NextResponse.json({ error: "city and street_address are required." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: user.id,
        city,
        street_address: streetAddress,
        phone: phone || null,
        notes: notes || null,
        is_default: Boolean(body.is_default),
      })
      .select("id, city, street_address, phone, notes, is_default")
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message || "Failed to create address." }, { status: 500 });
    }

    return NextResponse.json({ address: data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create address.";
    const status = message === "UNAUTHORIZED" ? 401 : message === "SMALL_BUSINESS_ONLY" ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
