"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { logPacketCopied } from "@/lib/actions/packets";
import type { DashboardPacket } from "@/lib/data/dashboard";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/relative-time";

export function PacketRow({ packet }: { packet: DashboardPacket }) {
  const [copying, startCopying] = useTransition();

  function onCopy() {
    startCopying(async () => {
      try {
        await navigator.clipboard.writeText(packet.llmReadyPrompt);
      } catch {
        toast.error("Clipboard blocked — open the packet to copy manually.");
        return;
      }
      const fd = new FormData();
      fd.set("packet_id", packet.id);
      fd.set("project_id", packet.projectId);
      fd.set("provider", "dashboard");
      await logPacketCopied(fd);
      toast.success("Packet copied — paste it into any AI.");
    });
  }

  return (
    <div className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{packet.title}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          {packet.projectName} · {packet.sourceCount} source
          {packet.sourceCount === 1 ? "" : "s"} · Created{" "}
          {relativeTime(packet.createdAt)}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {packet.reuseCount === 0
            ? "Not reused yet"
            : `Reused ${packet.reuseCount} time${packet.reuseCount === 1 ? "" : "s"}`}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={copying || !packet.llmReadyPrompt}
          onClick={onCopy}
        >
          <Copy className="size-3.5" />
          Copy
        </Button>
        <Button asChild size="sm" variant="ghost" className="rounded-full">
          <Link href={`/projects/${packet.projectId}?tab=usage`}>Open</Link>
        </Button>
      </div>
    </div>
  );
}
