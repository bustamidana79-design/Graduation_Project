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

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handle = async () => {
      // Supabase يعالج الـ token من الـ URL تلقائياً
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.push("/login");
        return;
      }

      const userId = data.session.user.id;

      // نضع email_verified = true في الـ profile
      await supabase
        .from("profiles")
        .update({ email_verified: true })
        .eq("id", userId);

      // نفحص الـ status ونوجّه
      const { data: profile } = await supabase
        .from("profiles")
        .select("status, account_type, full_name, email, phone, country, city")
        .eq("id", userId)
        .single();

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
  }, []);

  return (
    <main className="min-h-screen bg-[#f8fafc] flex items-center justify-center">
      <p className="text-sm text-[#273347]/60">جارٍ التحقق...</p>
    </main>
  );
}
