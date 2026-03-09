// app/auth/callback/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

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
        .select("status")
        .eq("id", userId)
        .single();

      if (profile?.status === "approved") {
        router.push("/dashboard");
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