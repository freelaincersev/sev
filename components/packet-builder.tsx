"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Copy, Sparkles } from "lucide-react";
import { toast } from "sonner";

import {
  createPacket,
  logPacketCopied,
  suggestPacketContext,
  type SuggestedSource,
} from "@/lib/actions/packets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const COPY_TARGETS = [
  { key: "chatgpt", label: "Copy for ChatGPT" },
  { key: "claude", label: "Copy for Claude" },
  { key: "cursor", label: "Copy for Cursor" },
  { key: "markdown", label: "Copy as Markdown" },
];

type BuiltPacket = { id: string; title: string; llmReadyPrompt: string };
type BuilderProject = { id: string; name: string };

/**
 * The "Sev speaks first" packet flow: for a goal, Sev proposes the relevant
 * sources; the user confirms/adjusts the selection; then a Context Packet is
 * assembled from just those and offered for copy into any AI. Reused by the
 * Ask-answer Export dialog (fixed goal) and the dashboard Build-a-packet dialog
 * (typed goal + project picker).
 */
export function PacketBuilder({
  projectId: fixedProjectId,
  projects,
  initialGoal = "",
  goalEditable = false,
}: {
  projectId?: string;
  projects?: BuilderProject[];
  initialGoal?: string;
  goalEditable?: boolean;
}) {
  const [projectId, setProjectId] = useState(
    fixedProjectId ?? projects?.[0]?.id ?? "",
  );
  const [goal, setGoal] = useState(initialGoal);
  const [suggestions, setSuggestions] = useState<SuggestedSource[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [packet, setPacket] = useState<BuiltPacket | null>(null);
  const [sourceCount, setSourceCount] = useState(0);
  const [snippetCount, setSnippetCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, startSuggest] = useTransition();
  const [building, startBuild] = useTransition();
  const [copying, startCopy] = useTransition();
  const didAuto = useRef(false);

  function runSuggest(g: string, pid: string) {
    const goalText = g.trim();
    if (!goalText || !pid) return;
    startSuggest(async () => {
      const fd = new FormData();
      fd.set("project_id", pid);
      fd.set("goal", goalText);
      const res = await suggestPacketContext({}, fd);
      setPacket(null);
      if (res.error) {
        setError(res.error);
        setSuggestions(null);
        return;
      }
      setError(null);
      const s = res.suggestions ?? [];
      setSuggestions(s);
      setSelected(new Set(s.map((x) => x.sourceId)));
    });
  }

  // Fixed-goal mode (Export): propose context once on open.
  useEffect(() => {
    if (didAuto.current || goalEditable) return;
    if (initialGoal.trim() && projectId) {
      didAuto.current = true;
      runSuggest(initialGoal, projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setError("Select at least one source to include.");
      return;
    }
    setError(null);
    startBuild(async () => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("goal", goal.trim());
      fd.set("source_ids", [...selected].join(","));
      const res = await createPacket({}, fd);
      if (res.packet) {
        setPacket(res.packet);
        setSourceCount(selected.size);
        setSnippetCount(res.sourceCount ?? 0);
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
    <div className="min-w-0 space-y-4">
      {/* Goal + project (typed-goal mode) */}
      {goalEditable ? (
        <div className="space-y-2">
          <Textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            rows={2}
            placeholder="What are you about to do? e.g. Draft an investor pitch deck"
            className="max-h-40 resize-none"
          />
          <div className="flex items-center justify-between gap-2">
            {projects && projects.length > 1 ? (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                From
                <select
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  aria-label="Project"
                  className="max-w-[12rem] truncate rounded-md border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              disabled={suggesting || !goal.trim() || !projectId}
              onClick={() => runSuggest(goal, projectId)}
            >
              <Sparkles className="size-4" />
              {suggesting ? "Finding…" : "Find context"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Suggestion loading */}
      {suggesting && !suggestions ? (
        <div className="space-y-2" aria-label="Finding relevant context…">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-5/6" />
          <Skeleton className="h-8 w-2/3" />
          <p className="text-xs text-muted-foreground">
            Finding relevant context…
          </p>
        </div>
      ) : null}

      {/* Suggested context checklist */}
      {suggestions && !packet ? (
        suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No matching memory found. Add sources or refine the goal.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">
                Suggested context{" "}
                <span className="font-normal text-muted-foreground">
                  — {selected.size} of {suggestions.length} selected
                </span>
              </p>
            </div>
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {suggestions.map((s) => {
                const on = selected.has(s.sourceId);
                return (
                  <li key={s.sourceId}>
                    <label className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 transition hover:bg-accent/50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(s.sourceId)}
                        className="size-4 shrink-0 accent-foreground"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {s.sourceTitle}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {s.snippetCount} snippet{s.snippetCount === 1 ? "" : "s"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            <Button
              type="button"
              disabled={building || selected.size === 0}
              onClick={build}
            >
              {building
                ? "Building…"
                : `Build packet from ${selected.size} source${selected.size === 1 ? "" : "s"}`}
            </Button>
          </div>
        )
      ) : null}

      {/* Built packet: copy targets + preview */}
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
            {sourceCount} source{sourceCount === 1 ? "" : "s"} · {snippetCount}{" "}
            snippet{snippetCount === 1 ? "" : "s"} · full vault not included ·
            saved to this project
          </p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-relaxed">
            {packet.llmReadyPrompt}
          </pre>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
