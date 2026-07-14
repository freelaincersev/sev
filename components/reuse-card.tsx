"use client";

import { useState, useTransition } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { createReusePacket } from "@/lib/actions/reuse";
import { logPacketCopied } from "@/lib/actions/packets";
import type { RelatedProject } from "@/lib/data/related";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

const COPY_TARGETS = [
  { key: "chatgpt", label: "Copy for ChatGPT" },
  { key: "claude", label: "Copy for Claude" },
  { key: "cursor", label: "Copy for Cursor" },
  { key: "markdown", label: "Copy as Markdown" },
];

/** Mirror of REUSE_STRONG_SIMILARITY (server-only const) for the label word only. */
const STRONG = 0.7;

type BuiltPacket = { id: string; title: string; llmReadyPrompt: string };

/**
 * Cross-project reuse (#3): when the current project's memory looks related to
 * the user's past work, Sev offers to reuse it. The card names the related
 * project(s) qualitatively ("related", never a %); the dialog lets the user
 * confirm which past sources to pull, then assembles a Context Packet saved to
 * this project and offers it for copy into any AI.
 */
export function ReuseCard({
  projectId,
  related,
}: {
  projectId: string;
  related: RelatedProject[];
}) {
  const [dismissed, setDismissed] = useState(false);
  const [open, setOpen] = useState(false);

  const allSourceIds = related.flatMap((p) => p.sources.map((s) => s.sourceId));
  const [selected, setSelected] = useState<Set<string>>(
    new Set(allSourceIds),
  );
  const [goal, setGoal] = useState("");
  const [packet, setPacket] = useState<BuiltPacket | null>(null);
  const [stats, setStats] = useState({ sources: 0, snippets: 0 });
  const [error, setError] = useState<string | null>(null);
  const [building, startBuild] = useTransition();
  const [copying, startCopy] = useTransition();

  if (dismissed || related.length === 0) return null;

  const top = related[0];
  const strong = top.topSimilarity >= STRONG;
  const others = related.length - 1;
  const lead = strong ? "is closely related to" : "looks related to";

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function build() {
    if (selected.size === 0) {
      setError("Select at least one source to reuse.");
      return;
    }
    setError(null);
    startBuild(async () => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("goal", goal.trim());
      fd.set("source_ids", [...selected].join(","));
      const res = await createReusePacket({}, fd);
      if (res.packet) {
        setPacket(res.packet);
        setStats({
          sources: res.sourceCount ?? 0,
          snippets: res.snippetCount ?? 0,
        });
      } else {
        setError(res.error ?? "Failed to build the packet.");
      }
    });
  }

  function onCopy(provider: string) {
    if (!packet) return;
    startCopy(async () => {
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
    <div className="mt-4 flex items-start gap-3 rounded-xl border bg-card px-4 py-3 shadow-sm">
      <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          This project {lead}{" "}
          <span className="font-medium">{top.projectTitle}</span>
          {others > 0 ? (
            <span className="text-muted-foreground">
              {" "}
              and {others} other{others === 1 ? "" : "s"}
            </span>
          ) : null}
          . Reuse context from it?
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button type="button" size="sm">
                Reuse context
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle className="pr-6">Reuse past context</DialogTitle>
                <DialogDescription>
                  Confirm which past sources to pull in, then paste the packet
                  into ChatGPT, Claude, or Cursor. Saved to this project.
                </DialogDescription>
              </DialogHeader>

              {!packet ? (
                <div className="min-w-0 space-y-4">
                  <Textarea
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    rows={2}
                    placeholder="What are you about to do with this? (optional) e.g. Draft the market-size section"
                    className="max-h-40 resize-none"
                  />

                  <div className="max-h-72 space-y-4 overflow-y-auto">
                    {related.map((p) => (
                      <div key={p.projectId} className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">
                          {p.projectTitle}
                        </p>
                        <ul className="space-y-1">
                          {p.sources.map((s) => {
                            const on = selected.has(s.sourceId);
                            return (
                              <li key={s.sourceId}>
                                <label className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 transition hover:bg-accent/50">
                                  <input
                                    type="checkbox"
                                    checked={on}
                                    onChange={() => toggle(s.sourceId)}
                                    className="mt-0.5 size-4 shrink-0 accent-foreground"
                                  />
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-medium">
                                      {s.sourceTitle}
                                    </span>
                                    {s.intent ? (
                                      <span className="block truncate text-xs text-muted-foreground">
                                        {s.intent}
                                      </span>
                                    ) : null}
                                  </span>
                                </label>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    disabled={building || selected.size === 0}
                    onClick={build}
                  >
                    <Sparkles className="size-4" />
                    {building
                      ? "Building…"
                      : `Build packet from ${selected.size} source${selected.size === 1 ? "" : "s"}`}
                  </Button>
                </div>
              ) : (
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
                    {stats.sources} source{stats.sources === 1 ? "" : "s"} ·{" "}
                    {stats.snippets} snippet{stats.snippets === 1 ? "" : "s"} ·
                    reused from past projects · saved to this project
                  </p>
                  <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
                    {packet.llmReadyPrompt}
                  </pre>
                </div>
              )}

              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
            </DialogContent>
          </Dialog>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => setDismissed(true)}
          >
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
