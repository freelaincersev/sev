import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PacketListItem } from "@/lib/data/packets";
import type { ProjectSummary } from "@/lib/data/usage";

export function DataUsagePanel({
  projectId,
  summary,
  packets: savedPackets = [],
}: {
  projectId: string;
  summary: ProjectSummary;
  packets?: PacketListItem[];
}) {
  const { sources, chunks, packets, monthTokens, monthEvents } = summary;

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Data &amp; Usage</h2>
        <p className="text-xs text-muted-foreground">
          Your memory is yours — export it as Markdown or delete it anytime.
        </p>
      </header>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-muted-foreground">Stored</dt>
          <dd>
            {sources} source{sources === 1 ? "" : "s"} · {chunks} chunk
            {chunks === 1 ? "" : "s"} · {packets} packet{packets === 1 ? "" : "s"}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tokens this month</dt>
          <dd>{monthTokens.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Activity this month</dt>
          <dd>
            {monthEvents.packetsCreated} created · {monthEvents.packetsCopied}{" "}
            copied · {monthEvents.generation} answers
          </dd>
        </div>
      </dl>

      <div className="border-t px-4 py-3">
        <Button asChild variant="outline" size="sm">
          <a href={`/projects/${projectId}/export`} download>
            <Download className="size-4" />
            Export as Markdown
          </a>
        </Button>
      </div>

      {savedPackets.length > 0 ? (
        <div className="border-t">
          <p className="px-4 pt-3 text-xs font-medium text-muted-foreground">
            Saved packets
          </p>
          <ul className="divide-y">
            {savedPackets.map((p) => (
              <li key={p.id} className="truncate px-4 py-2 text-sm">
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
