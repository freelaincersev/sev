"use client";

import { useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { logPacketCopied } from "@/lib/actions/packets";
import type { RecentPacket } from "@/lib/data/packets";

/**
 * Reuse strip: the packets you've pulled, one click to re-copy into any AI.
 * The copy body is carried in the payload so re-copy needs no round trip; the
 * copy is still logged (context_packet.copied) for the North Star.
 */
export function RecentPackets({ packets }: { packets: RecentPacket[] }) {
  const [copying, startCopying] = useTransition();

  function onCopy(p: RecentPacket) {
    startCopying(async () => {
      try {
        await navigator.clipboard.writeText(p.llmReadyPrompt);
      } catch {
        toast.error("Clipboard blocked — open the packet to copy manually.");
        return;
      }
      const fd = new FormData();
      fd.set("packet_id", p.id);
      fd.set("project_id", p.projectId);
      fd.set("provider", "dashboard");
      await logPacketCopied(fd);
      toast.success("Packet copied — paste it into any AI.");
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {packets.map((p) => (
        <button
          key={p.id}
          type="button"
          disabled={copying}
          onClick={() => onCopy(p)}
          title={`Copy “${p.title}”`}
          className="group inline-flex max-w-full items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition hover:bg-accent/50 disabled:opacity-60"
        >
          <Copy className="size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          <span className="truncate">{p.title}</span>
        </button>
      ))}
    </div>
  );
}
