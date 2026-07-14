import Link from "next/link";

import type { MemoryInsights as MemoryInsightsData } from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border p-4">
      <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function MemoryInsights({ data }: { data: MemoryInsightsData }) {
  const { week, reuse, attention } = data;
  const weekRows = [
    { label: "sources added", value: week.sourcesAdded, plus: true },
    { label: "packets created", value: week.packetsCreated, plus: true },
    { label: "packet reuses", value: week.packetsReused, plus: false },
    { label: "AI answers saved", value: week.answers, plus: false },
  ];

  return (
    <div className="space-y-4">
      <Card title="This week">
        <dl className="space-y-2">
          {weekRows.map((r) => (
            <div
              key={r.label}
              className="flex items-baseline justify-between gap-2"
            >
              <dt className="text-sm text-muted-foreground">{r.label}</dt>
              <dd className="text-base font-semibold tabular-nums">
                {r.plus && r.value > 0 ? "+" : ""}
                {r.value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card title="Memory loop">
        <p className="text-sm">
          <span className="font-semibold">
            {reuse.reusedPackets} of {reuse.totalPackets}
          </span>{" "}
          packet{reuse.totalPackets === 1 ? "" : "s"} reused
          {reuse.totalPackets > 0 ? ` · ${reuse.rate}% reuse rate` : ""}.
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          Your memory becomes valuable when it is reused.
        </p>
      </Card>

      {attention ? (
        <Card title="Needs attention">
          <p className="text-sm">
            <span className="font-medium">{attention.name}</span> has{" "}
            {attention.sourceCount} source
            {attention.sourceCount === 1 ? "" : "s"} but only{" "}
            {attention.packetCount} context packet
            {attention.packetCount === 1 ? "" : "s"}.
          </p>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="mt-3 rounded-full"
          >
            <Link href={`/projects/${attention.projectId}`}>
              Create a packet
            </Link>
          </Button>
        </Card>
      ) : null}
    </div>
  );
}
