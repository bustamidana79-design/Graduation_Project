"use client";

import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

export default function OrderRealtimeBridge() {
  useEffect(() => {
    const channel = supabase
      .channel("orders-updates")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
        },
        (payload) => {
          window.dispatchEvent(new CustomEvent("orders:changed", { detail: payload }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_orders",
        },
        (payload) => {
          window.dispatchEvent(new CustomEvent("delivery-orders:changed", { detail: payload }));
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "delivery_tracking",
        },
        (payload) => {
          window.dispatchEvent(new CustomEvent("delivery-tracking:changed", { detail: payload }));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  return null;
}
