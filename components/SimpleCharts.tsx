type BarDatum = {
  key: string;
  label: string;
  value: number;
  hint?: string;
  color?: string;
};

type StackedDatum = {
  key: string;
  label: string;
  segments: Array<{
    key: string;
    label: string;
    value: number;
    color: string;
  }>;
};

type GroupedDatum = StackedDatum;

const chartColors = {
  ink: "#273347",
  blue: "#52789f",
  sky: "#6f9cc3",
  mist: "#8fb1cf",
  slate: "#546a85",
  ice: "#bbd0e4",
  cyan: "#5b94a6",
  muted: "#8aa0b8",
  track: "#edf2f7",
  grid: "#f6f8fb",
};

const fallbackColors = [
  chartColors.blue,
  chartColors.sky,
  chartColors.slate,
  chartColors.mist,
  chartColors.cyan,
  chartColors.ink,
  chartColors.ice,
  chartColors.muted,
];

function safeMax(values: number[]) {
  return Math.max(...values, 1);
}

export function VerticalBarChart({ data, heightClass = "h-44" }: { data: BarDatum[]; heightClass?: string }) {
  const max = safeMax(data.map((item) => item.value));

  return (
    <div
      className={`flex ${heightClass} items-stretch gap-3 rounded-lg border border-[#edf2f7] bg-[linear-gradient(to_top,#f6f8fb_1px,transparent_1px)] bg-[length:100%_25%] px-3 pt-3`}
    >
      {data.map((item, index) => {
        const height = Math.max((item.value / max) * 100, item.value ? 8 : 2);
        const color = item.color || fallbackColors[index % fallbackColors.length];

        return (
          <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <p className="text-xs font-bold text-[#273347]">{item.value.toLocaleString("ar")}</p>
            <div className="flex min-h-0 w-full flex-1 items-end rounded-md bg-white/70 px-1.5 pt-2 shadow-[inset_0_0_0_1px_rgba(39,51,71,0.04)]">
              <div
                className="w-full rounded-t-sm shadow-sm transition-all duration-300 hover:brightness-95"
                style={{
                  height: `${height}%`,
                  background: `linear-gradient(180deg, ${color} 0%, ${color}dd 100%)`,
                }}
                title={item.hint || `${item.label}: ${item.value}`}
              />
            </div>
            <p className="max-w-full truncate text-[11px] text-[#273347]/55">{item.label}</p>
          </div>
        );
      })}
    </div>
  );
}

export function GroupedBarChart({
  data,
  legend,
  heightClass = "h-52",
}: {
  data: GroupedDatum[];
  legend: Array<{ key: string; label: string; color: string }>;
  heightClass?: string;
}) {
  const max = safeMax(data.flatMap((item) => item.segments.map((segment) => segment.value)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-[#273347]/60">
        {legend.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div
        className={`flex ${heightClass} items-stretch gap-3 rounded-lg border border-[#edf2f7] bg-[linear-gradient(to_top,#f6f8fb_1px,transparent_1px)] bg-[length:100%_25%] px-3 pt-3`}
      >
        {data.map((item) => {
          const total = item.segments.reduce((sum, segment) => sum + segment.value, 0);
          const hint = item.segments.map((segment) => `${segment.label}: ${segment.value}`).join(" | ");

          return (
            <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <p className="text-xs font-bold text-[#273347]">{total.toLocaleString("ar")}</p>
              <div className="flex min-h-0 w-full flex-1 items-end justify-center gap-1 rounded-md bg-white/70 px-1.5 pt-2 shadow-[inset_0_0_0_1px_rgba(39,51,71,0.04)]" title={hint}>
                {item.segments.map((segment) => {
                  const height = Math.max((segment.value / max) * 100, segment.value ? 8 : 2);
                  return (
                    <div
                      key={segment.key}
                      className="min-w-1 flex-1 rounded-t-sm shadow-sm transition-all hover:brightness-95"
                      style={{ height: `${height}%`, background: `linear-gradient(180deg, ${segment.color} 0%, ${segment.color}dd 100%)` }}
                      title={`${segment.label}: ${segment.value}`}
                    />
                  );
                })}
              </div>
              <p className="max-w-full truncate text-[11px] text-[#273347]/55">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StackedBarChart({
  data,
  legend,
  heightClass = "h-52",
}: {
  data: StackedDatum[];
  legend: Array<{ key: string; label: string; color: string }>;
  heightClass?: string;
}) {
  const max = safeMax(data.map((item) => item.segments.reduce((sum, segment) => sum + segment.value, 0)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 text-xs text-[#273347]/60">
        {legend.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label}
          </span>
        ))}
      </div>

      <div
        className={`flex ${heightClass} items-stretch gap-3 rounded-lg border border-[#edf2f7] bg-[linear-gradient(to_top,#f6f8fb_1px,transparent_1px)] bg-[length:100%_25%] px-3 pt-3`}
      >
        {data.map((item) => {
          const total = item.segments.reduce((sum, segment) => sum + segment.value, 0);
          const height = Math.max((total / max) * 100, total ? 8 : 2);
          const hint = item.segments.map((segment) => `${segment.label}: ${segment.value}`).join(" | ");

          return (
            <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-2">
              <p className="text-xs font-bold text-[#273347]">{total.toLocaleString("ar")}</p>
              <div className="flex min-h-0 w-full flex-1 items-end rounded-md bg-white/70 px-1.5 pt-2 shadow-[inset_0_0_0_1px_rgba(39,51,71,0.04)]">
                <div className="flex w-full flex-col-reverse overflow-hidden rounded-t-md" style={{ height: `${height}%` }} title={hint}>
                  {item.segments.map((segment) => {
                    const percent = total ? Math.max((segment.value / total) * 100, segment.value ? 8 : 0) : 0;
                    return (
                      <div
                        key={segment.key}
                        style={{ height: `${percent}%`, backgroundColor: segment.color }}
                        className="transition-all hover:brightness-95"
                      />
                    );
                  })}
                </div>
              </div>
              <p className="max-w-full truncate text-[11px] text-[#273347]/55">{item.label}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function HorizontalBarChart({ data }: { data: BarDatum[] }) {
  const max = safeMax(data.map((item) => item.value));

  if (data.length === 0) {
    return <p className="text-sm text-[#273347]/45">لا توجد بيانات بعد.</p>;
  }

  return (
    <div className="space-y-3">
      {data.map((item, index) => {
        const width = Math.max((item.value / max) * 100, item.value ? 5 : 1);
        const color = item.color || fallbackColors[index % fallbackColors.length];

        return (
          <div key={item.key} className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-semibold text-[#273347]">{item.label}</span>
              <span className="shrink-0 text-[#273347]/60">{item.value.toLocaleString("ar")}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[#edf2f7] shadow-[inset_0_0_0_1px_rgba(39,51,71,0.03)]">
              <div
                className="h-full rounded-full shadow-sm transition-all duration-300 hover:brightness-95"
                style={{ width: `${width}%`, background: `linear-gradient(90deg, ${color} 0%, ${color}dd 100%)` }}
                title={item.hint || `${item.label}: ${item.value}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
