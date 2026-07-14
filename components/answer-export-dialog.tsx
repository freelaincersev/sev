"use client";

import { useState, useTransition } from "react";
import { Copy, Upload } from "lucide-react";
import { toast } from "sonner";

import { createPacket, logPacketCopied } from "@/lib/actions/packets";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type CreatedPacket = { id: string; title: string; llmReadyPrompt: string };

/** Copy targets — the body is identical; the label is the logged provider. */
const COPY_TARGETS: { key: string; label: string }[] = [
  { key: "chatgpt", label: "Copy for ChatGPT" },
  { key: "claude", label: "Copy for Claude" },
  { key: "cursor", label: "Copy for Cursor" },
  { key: "markdown", label: "Copy as Markdown" },
];

/**
 * Export an Ask answer as a Context Packet: reuses the packet assembly logic
 * (relevant memory → LLM-ready prompt) with the answered question as the goal,
 * then offers copy-for-ChatGPT/Claude/Cursor/Markdown. The packet is persisted
 * on build (North Star context_packet.created) and appears under Saved packets.
 */
export function AnswerExportDialog({
  projectId,
  query,
  disabled,
}: {
  projectId: string;
  query: string;
  disabled?: boolean;
}) {
  const [packet, setPacket] = useState<CreatedPacket | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [copying, startCopying] = useTransition();

  function build() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("project_id", projectId);
      formData.set("goal", query);
      const res = await createPacket({}, formData);
      if (res.packet) {
        setPacket(res.packet);
        setSourceCount(res.sourceCount ?? 0);
      } else {
        setError(res.error ?? "Failed to build the packet.");
      }
    });
  }

  function onOpenChange(open: boolean) {
    if (open && !packet && !pending) build();
  }

  function onCopy(provider: string) {
    if (!packet) return;
    startCopying(async () => {
      try {
        await navigator.clipboard.writeText(packet.llmReadyPrompt);
      } catch {
        setError("Clipboard blocked — select the text and copy manually.");
        return;
      }
      const fd = new FormData();
      fd.set("packet_id", packet.id);
      fd.set("project_id", projectId);
      fd.set("provider", provider);
      await logPacketCopied(fd);
      const label =
        COPY_TARGETS.find((t) => t.key === provider)?.label ?? "Copied";
      toast.success(`${label.replace("Copy ", "Copied ")}.`);
    });
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
        >
          <Upload className="size-4" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-6">Export as Context Packet</DialogTitle>
          <DialogDescription>
            The relevant memory, assembled into an LLM-ready prompt you can paste
            into ChatGPT, Claude, or Cursor.
          </DialogDescription>
        </DialogHeader>

        {packet ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {COPY_TARGETS.map((t) => (
                <Button
                  key={t.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={copying}
                  onClick={() => onCopy(t.key)}
                >
                  <Copy className="size-3.5" />
                  {t.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {sourceCount} source{sourceCount === 1 ? "" : "s"} · full vault not
              included · saved to this project
            </p>
            <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
              {packet.llmReadyPrompt}
            </pre>
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{error}</p>
            <button
              type="button"
              onClick={build}
              className="text-xs font-medium underline underline-offset-2"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="space-y-2" aria-label="Building packet…">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <p className="text-xs text-muted-foreground">Building packet…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
