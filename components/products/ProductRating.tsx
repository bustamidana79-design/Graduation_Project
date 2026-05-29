"use client";

import { Star } from "lucide-react";

export function ProductRating({
  value,
  count,
  compact = false,
}: {
  value?: number | null;
  count?: number | null;
  compact?: boolean;
}) {
  const rating = Math.max(0, Math.min(5, Number(value || 0)));
  const label = rating > 0 ? rating.toFixed(1) : "لا يوجد تقييم";

  return (
    <div className="flex items-center gap-2 text-sm text-[#273347]">
      <div className="flex items-center gap-0.5" aria-label={`التقييم ${label}`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={compact ? 14 : 16}
            className={star <= Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-[#c8d3df]"}
          />
        ))}
      </div>
      <span className="font-semibold">{label}</span>
      {!compact && <span className="text-[#273347]/45">({Number(count || 0)} تقييم)</span>}
    </div>
  );
}
