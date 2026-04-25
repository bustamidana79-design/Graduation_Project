"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export type DashboardAccountType =
  | "merchant"
  | "small_business"
  | "delivery"
  | "supporter"
  | "admin";

export type DashboardProfile = {
  id: string;
  full_name: string | null;
  account_type: DashboardAccountType;
  status: string | null;
};

type UseDashboardAccessOptions = {
  requiredAccountType: DashboardAccountType;
};

export function useDashboardAccess({ requiredAccountType }: UseDashboardAccessOptions) {
  const router = useRouter();
  const [profile, setProfile] = useState<DashboardProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, account_type, status")
        .eq("id", user.id)
        .single();

      if (error || !data) {
        router.replace("/login");
        return;
      }

      const nextProfile = data as DashboardProfile;

      if (requiredAccountType !== "admin" && nextProfile.status !== "approved") {
        router.replace("/pending");
        return;
      }

      if (nextProfile.account_type !== requiredAccountType) {
        router.replace("/");
        return;
      }

      if (active) {
        setProfile(nextProfile);
        setLoading(false);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [requiredAccountType, router]);

  return { profile, loading };
}

export function getProfileInitial(name: string | null | undefined, fallback: string) {
  return name?.trim()?.charAt(0) || fallback;
}
