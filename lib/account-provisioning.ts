type SupabaseLikeClient = {
  from: (table: string) => {
    upsert: (values: Record<string, unknown>, options?: { onConflict?: string }) => {
      error?: { message?: string } | null;
    } | Promise<{ error?: { message?: string } | null }>;
  };
};

type BasicInfo = {
  full_name?: string;
  email?: string;
  phone?: string;
  country?: string;
  city?: string;
};

type ProvisionParams = {
  supabase: SupabaseLikeClient;
  userId: string;
  accountType: string;
  basic: BasicInfo;
  typeSpecific?: Record<string, unknown>;
  proofJson?: {
    proof_link_1?: string | null;
  };
};

async function runUpsert(
  supabase: SupabaseLikeClient,
  table: string,
  values: Record<string, unknown>
) {
  const result = await supabase.from(table).upsert(values, { onConflict: "user_id" });
  if (result?.error) {
    throw new Error(result.error.message || `Failed to provision ${table}`);
  }
}

export async function provisionApprovedAccount(params: ProvisionParams) {
  const { supabase, userId, accountType, basic, typeSpecific = {}, proofJson } = params;

  if (accountType === "merchant") {
    await runUpsert(supabase, "supplier_profiles", {
      user_id: userId,
      store_name: typeSpecific.store_name || basic.full_name || "متجر المورد",
      product_category: typeSpecific.product_category || typeSpecific.product_type || "—",
      store_link: proofJson?.proof_link_1 || "—",
      commercial_reg_no: typeSpecific.commercial_reg_no || null,
    });
    return;
  }

  if (accountType === "small_business") {
    await runUpsert(supabase, "small_business_profiles", {
      user_id: userId,
      project_name: typeSpecific.project_name || basic.full_name || "مشروع",
      project_field: typeSpecific.project_field || typeSpecific.business_field || "—",
      project_stage: typeSpecific.project_stage || "running",
      needs: Array.isArray(typeSpecific.needs) ? typeSpecific.needs : [],
      social_link: proofJson?.proof_link_1 || "—",
    });
    return;
  }

  if (accountType === "delivery") {
    await runUpsert(supabase, "shipping_company_profiles", {
      user_id: userId,
      company_name: typeSpecific.company_name || basic.full_name || "شركة شحن",
      delivery_scope: typeSpecific.delivery_scope || "local",
      delivery_cities: Array.isArray(typeSpecific.delivery_cities) ? typeSpecific.delivery_cities : [],
      avg_delivery_time: typeSpecific.avg_delivery_time || "—",
      license_no: typeSpecific.license_no || typeSpecific.commercial_reg_no || "—",
    });
    return;
  }

  if (accountType === "supporter") {
    await runUpsert(supabase, "supporter_profiles", {
      user_id: userId,
      support_type: typeSpecific.support_type || "financial",
      funding_range: typeSpecific.funding_range || null,
      interests: typeSpecific.interests || "—",
      professional_link: proofJson?.proof_link_1 || "—",
      previous_experience: typeSpecific.previous_experience || "—",
    });
  }
}
