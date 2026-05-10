"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getDashboardMessagesRoute } from "@/lib/profile-routes";

export default function ChatRedirectPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("جاري فتح المحادثة...");

  useEffect(() => {
    const redirectToDashboardMessages = async () => {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .single();

      if (profileError || !profile) {
        setMessage("تعذر تحديد لوحة التحكم المناسبة للمحادثة.");
        return;
      }

      router.replace(`${getDashboardMessagesRoute(profile.account_type)}?conversation=${params.id}`);
    };

    void redirectToDashboardMessages();
  }, [params.id, router]);

  return (
    <div className="p-6" dir="rtl">
      <p className="text-sm text-[#273347]/60">{message}</p>
    </div>
  );
}
