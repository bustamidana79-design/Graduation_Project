"use client";

import { CheckCircle2, Circle, Clock3, PackageCheck, Truck } from "lucide-react";

type TrackingItem = {
  id?: string;
  status?: string | null;
  description?: string | null;
  location?: string | null;
  created_at?: string | null;
};

const statusLabels: Record<string, string> = {
  pending: "بانتظار المعالجة",
  confirmed: "تم تأكيد الدفع",
  processing: "قيد التجهيز",
  shipped: "تم الشحن",
  picked_up: "تم استلام الطلب",
  in_transit: "في الطريق",
  out_for_delivery: "خارج للتسليم",
  delivered: "تم التسليم",
  paid: "مدفوع",
};

const deliverySteps = ["picked_up", "in_transit", "out_for_delivery", "delivered"];

function formatDate(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("ar", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getStatusLabel(status?: string | null) {
  if (!status) return "غير محدد";
  return statusLabels[status] || status;
}

export function StatusPill({ status }: { status?: string | null }) {
  const value = status || "pending";
  const tone =
    value === "delivered" || value === "paid" || value === "confirmed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : value === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-sky-200 bg-sky-50 text-sky-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {getStatusLabel(value)}
    </span>
  );
}

export function TrackingTimeline({
  status,
  tracking = [],
}: {
  status?: string | null;
  tracking?: TrackingItem[];
}) {
  const currentIndex = Math.max(0, deliverySteps.indexOf(status || "picked_up"));
  const sortedTracking = [...tracking].sort((a, b) => {
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4">
        {deliverySteps.map((step, index) => {
          const reached = index <= currentIndex;
          const Icon = step === "delivered" ? PackageCheck : step === "picked_up" ? CheckCircle2 : Truck;

          return (
            <div
              key={step}
              className={`flex min-h-20 items-center gap-3 rounded-lg border p-3 ${
                reached ? "border-[#bbd0e4] bg-[#f6fbff]" : "border-[#e6edf5] bg-white text-[#273347]/45"
              }`}
            >
              <div
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                  reached ? "bg-[#273347] text-white" : "bg-[#eef3f8] text-[#273347]/45"
                }`}
              >
                <Icon size={16} />
              </div>
              <p className="text-xs font-bold leading-5 text-[#273347]">{getStatusLabel(step)}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-3">
        {sortedTracking.length === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-[#e6edf5] bg-white p-3 text-sm text-[#273347]/60">
            <Clock3 size={16} />
            لا توجد تحديثات تتبع بعد.
          </div>
        ) : (
          sortedTracking.map((item, index) => (
            <div key={item.id || `${item.status}-${index}`} className="flex gap-3">
              <div className="flex flex-col items-center">
                <Circle className="mt-1 fill-[#273347] text-[#273347]" size={10} />
                {index < sortedTracking.length - 1 && <div className="mt-1 h-full w-px bg-[#d8e1ec]" />}
              </div>
              <div className="flex-1 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-[#273347]">{getStatusLabel(item.status)}</p>
                  <p className="text-xs text-[#273347]/45">{formatDate(item.created_at)}</p>
                </div>
                <p className="mt-1 text-sm text-[#273347]/70">{item.description || getStatusLabel(item.status)}</p>
                {item.location && <p className="mt-1 text-xs font-semibold text-[#546a85]">{item.location}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
