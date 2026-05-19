"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Lightbulb, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type DailyTip = {
  title: string;
  body: string;
  action_label: string;
  action_href: string;
  priority: "low" | "medium" | "high";
  tip_date: string;
};

async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${data.session?.access_token || ""}`,
  };
}

function formatTipDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function DailyTipCard() {
  const [tip, setTip] = useState<DailyTip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTip() {
      setLoading(true);
      setError(null);

      try {
        const headers = await getAuthHeaders();
        const response = await fetch("/api/daily-tip", { headers });
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "فشل تحميل نصيحة اليوم.");
        }

        if (mounted) setTip(result.tip || null);
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "فشل تحميل نصيحة اليوم.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadTip();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="mb-6 flex items-center gap-3 rounded-2xl border border-[#e6edf5] bg-white px-5 py-4 text-sm text-[#273347]/60">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>جاري تجهيز نصيحة اليوم...</span>
      </div>
    );
  }

  if (error || !tip) {
    return null;
  }

  return (
    <section className="mb-6 overflow-hidden rounded-2xl border border-[#d7e4ef] bg-white shadow-sm">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#edf4fb] text-[#273347]">
            <Lightbulb size={22} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold text-[#273347]/45">{formatTipDate(tip.tip_date)}</p>
              {tip.priority === "high" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                  مهم اليوم
                </span>
              )}
            </div>
            <h3 className="text-base font-bold text-[#273347]">{tip.title}</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-[#273347]/70">{tip.body}</p>
          </div>
        </div>

        <Link
          href={tip.action_href}
          className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#273347] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1f2938]"
        >
          {tip.action_label}
        </Link>
      </div>
    </section>
  );
}
