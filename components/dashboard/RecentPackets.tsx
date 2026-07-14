import Link from "next/link";

import { PacketRow } from "@/components/dashboard/PacketRow";
import type { DashboardPacket } from "@/lib/data/dashboard";

/**
 * Recent Context Packets as readable list rows (not chips) — Sev's core
 * output, so it reads as content: title, project, sources, age, reuse count.
 */
export function RecentPackets({
  packets,
  viewAllHref,
}: {
  packets: DashboardPacket[];
  viewAllHref?: string;
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Recent Context Packets
        </h2>
        {packets.length > 0 && viewAllHref ? (
          <Link
            href={viewAllHref}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            View all
          </Link>
        ) : null}
      </div>

      {packets.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm font-medium">No context packets yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask your memory a question to create your first reusable packet.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border px-4">
          {packets.map((p) => (
            <PacketRow key={p.id} packet={p} />
          ))}
        </div>
      )}
    </section>
  );
}
