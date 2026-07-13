"use client";

import { useState, useTransition } from "react";
import { Copy, Package } from "lucide-react";
import { toast } from "sonner";

import { createPacket, logPacketCopied } from "@/lib/actions/packets";
import type { PacketListItem } from "@/lib/data/packets";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type CreatedPacket = { id: string; title: string; llmReadyPrompt: string };

const PROVIDERS: { key: string; label: string }[] = [
  { key: "chatgpt", label: "ChatGPT" },
  { key: "claude", label: "Claude" },
  { key: "cursor", label: "Cursor" },
];

export function PacketPanel({
  projectId,
  packets,
}: {
  projectId: string;
  packets: PacketListItem[];
}) {
  const [pending, startTransition] = useTransition();
  const [packet, setPacket] = useState<CreatedPacket | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const res = await createPacket({}, formData);
      if (res.error) {
        setError(res.error);
        setPacket(null);
        return;
      }
      setPacket(res.packet ?? null);
      setSourceCount(res.sourceCount ?? 0);
      toast.success("Context Packet created.");
    });
  }

  function onCopy(provider: string) {
    if (!packet) return;
    startTransition(async () => {
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
      toast.success(`Copied for ${provider}.`);
    });
  }

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Context Packets</h2>
        <p className="text-xs text-muted-foreground">
          Assemble the relevant memory into an LLM-ready packet, then copy it into
          ChatGPT, Claude, or Cursor.
        </p>
      </header>

      <form action={onSubmit} className="space-y-2 px-4 py-3">
        <input type="hidden" name="project_id" value={projectId} />
        <Textarea
          name="goal"
          rows={3}
          placeholder="What do you want to do? e.g. Draft a launch plan using this project's research."
          required
        />
        <Button type="submit" disabled={pending} className="rounded-full">
          <Package className="size-4" />
          {pending ? "Building…" : "Build packet"}
        </Button>
      </form>

      {error ? (
        <p className="px-4 pb-4 text-sm text-destructive">{error}</p>
      ) : null}

      {packet && !error ? (
        <div className="border-t px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{packet.title}</span>
            <span className="text-xs text-muted-foreground">
              {sourceCount} source{sourceCount === 1 ? "" : "s"} · full vault not
              included
            </span>
            <div className="ml-auto flex gap-1">
              {PROVIDERS.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onCopy(p.key)}
                >
                  <Copy className="size-3.5" />
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
            {packet.llmReadyPrompt}
          </pre>
        </div>
      ) : null}

      {packets.length > 0 ? (
        <div className="border-t">
          <p className="px-4 pt-3 text-xs font-medium text-muted-foreground">
            Saved packets
          </p>
          <ul className="divide-y">
            {packets.map((p) => (
              <li key={p.id} className="px-4 py-2 text-sm">
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
