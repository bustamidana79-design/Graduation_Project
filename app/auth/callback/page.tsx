// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { provisionApprovedAccount } from "@/lib/account-provisioning";

function redirectByAccountType(accountType: string) {
  const redirects: Record<string, string> = {
    merchant: "/dashboard/supplier",
    small_business: "/dashboard/small-business",
    delivery: "/dashboard/shipping-company",
    supporter: "/dashboard/supporter",
    admin: "/dashboard/admin",
  };
  return redirects[accountType] || "/dashboard";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : "";
}

async function getCallbackSession() {
  const url = new URL(window.location.href);
  const code = url.searchParams.get("code");

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      window.history.replaceState({}, document.title, url.pathname);
    }

    return { session: data.session, error };
  }

  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handle = async () => {
      const { session, error } = await getCallbackSession();

      if (error || !session) {
        router.push("/login");
        return;
      }

      const user = session.user;
      const userId = user.id;
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;

      // نضع email_verified = true في الـ profile
      await supabase
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", userId);

      // نفحص الـ status ونوجّه
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("status, account_type, full_name, email, phone, country, city")
        .eq("id", userId)
        .maybeSingle();

      let profile = existingProfile;

      if (!profile) {
        const accountType = getString(metadata.account_type);
        const email = getString(metadata.email) || user.email || "";

        if (!accountType || !email) {
          router.push("/login");
          return;
        }

        const { data: createdProfile, error: profileError } = await supabase
          .from("profiles")
          .upsert(
            {
              id: userId,
              full_name: getString(metadata.full_name) || email,
              email,
              phone: getString(metadata.phone) || null,
              country: getString(metadata.country) || null,
              city: getString(metadata.city) || null,
              preferred_currency: getString(metadata.preferred_currency) || "ILS",
              account_type: accountType,
              status: "pending",
              email_verified: true,
            },
            { onConflict: "id" }
          )
          .select("status, account_type, full_name, email, phone, country, city")
          .single();

        if (profileError || !createdProfile) {
          console.error("Creating callback profile failed:", profileError);
          router.push("/pending");
          return;
        }

        profile = createdProfile;
      }

      const applicationDataJson = asRecord(metadata.application_data_json);
      const applicationProofJson = asRecord(metadata.application_proof_json);
      const metadataAccountType = getString(metadata.account_type);

      if (applicationDataJson && applicationProofJson && metadataAccountType) {
        const { data: existingApplication } = await supabase
          .from("applications")
          .select("id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();

        if (!existingApplication) {
          const { error: applicationError } = await supabase.from("applications").insert({
            user_id: userId,
            account_type: metadataAccountType,
            data_json: applicationDataJson,
            proof_json: applicationProofJson,
            status: "pending",
          });

          if (applicationError) {
            console.error("Creating callback application failed:", applicationError);
          }
        }
      }

      if (profile?.status === "approved") {
        const { data: application } = await supabase
          .from("applications")
          .select("account_type, data_json, proof_json")
          .eq("user_id", userId)
          .eq("status", "approved")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (application?.account_type) {
          try {
            await provisionApprovedAccount({
              supabase,
              userId,
              accountType: application.account_type,
              basic: application.data_json?.basic || {
                full_name: profile.full_name,
                email: profile.email,
                phone: profile.phone,
                country: profile.country,
                city: profile.city,
              },
              typeSpecific: application.data_json?.type_specific || {},
              proofJson: application.proof_json || {},
            });
          } catch (error) {
            console.error("Provisioning approved account failed:", error);
          }
        }

        router.push(redirectByAccountType(profile.account_type));
      } else {
        router.push("/pending");
      }
    };

    handle();
  }, [router]);

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <p className="text-sm text-[#273347]/60">جارٍ التحقق...</p>
    </main>
  );
}
