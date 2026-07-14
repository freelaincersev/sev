import { TrendingUp } from "lucide-react";

import type { WeeklyActivity } from "@/lib/data/dashboard";

/**
 * "This week" momentum: last-7-days deltas that show the memory is alive and
 * growing — distinct from the lifetime totals in the stat tiles. Rendered only
 * when there's activity, so a quiet week never shows a wall of zeros.
 */
export function WeeklyMomentum({ activity }: { activity: WeeklyActivity }) {
  const items = [
    { value: activity.sourcesAdded, label: "sources added", plus: true },
    { value: activity.packetsCreated, label: "packets created", plus: true },
    { value: activity.answers, label: "AI answers", plus: false },
    { value: activity.packetsReused, label: "packets reused", plus: false },
  ];

  return (
    <section className="rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">This week</h2>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <TrendingUp className="size-3.5" />
          Memory growing
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-xl font-semibold tracking-tight">
              {it.plus && it.value > 0 ? "+" : ""}
              {it.value.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">{it.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
