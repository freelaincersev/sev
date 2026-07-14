"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Download, Trash2 } from "lucide-react";

import { deleteSource, summarizeSource } from "@/lib/actions/sources";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { SourceWithCount } from "@/lib/data/sources";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "ready"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

/**
 * A source row whose summary expands inline (accordion) instead of a modal.
 * The summary is generated once on first expand (GPT-4o mini) and stored on the
 * source; later expands read the cached copy — same logic as before, new shell.
 */
export function SourceItem({
  source,
  projectId,
}: {
  source: SourceWithCount;
  projectId: string;
}) {
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(source.summary);
  const [model, setModel] = useState(source.summary_model);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function summarize() {
    setError(null);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", source.id);
      formData.set("project_id", projectId);
      const result = await summarizeSource(formData);
      if (result.summary) {
        setSummary(result.summary);
        setModel(result.model ?? null);
      } else {
        setError(result.error ?? "Summarization failed.");
      }
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && !summary && !pending) summarize();
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              className="flex min-w-0 items-center gap-1 text-left text-sm font-medium"
            >
              <ChevronRight
                className={cn(
                  "size-3.5 shrink-0 text-muted-foreground transition-transform",
                  open && "rotate-90",
                )}
              />
              <span className="truncate hover:underline">{source.title}</span>
            </button>
            <StatusBadge status={source.status} />
          </div>
          <p className="pl-[1.125rem] text-xs text-muted-foreground">
            {source.type.replace("_", " ")} · {source.chunk_count} chunk
            {source.chunk_count === 1 ? "" : "s"}
            {source.status === "error" && source.error_message
              ? ` · ${source.error_message}`
              : ""}
          </p>
        </div>
        {source.storage_path ? (
          <Button
            asChild
            variant="ghost"
            size="icon"
            aria-label={`Download original of ${source.title}`}
          >
            <a
              href={`/projects/${projectId}/sources/${source.id}/original`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download className="size-4" />
            </a>
          </Button>
        ) : null}
        <form action={deleteSource}>
          <input type="hidden" name="id" value={source.id} />
          <input type="hidden" name="project_id" value={projectId} />
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            aria-label="Delete source"
          >
            <Trash2 className="size-4" />
          </Button>
        </form>
      </div>

      {open ? (
        <div className="mt-2 pl-[1.125rem]">
          {summary ? (
            <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3">
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {summary}
              </p>
              <p className="text-xs text-muted-foreground">
                Summarized by {model ?? "AI"} · stored with this source
              </p>
            </div>
          ) : error ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-destructive">{error}</p>
              <button
                type="button"
                onClick={summarize}
                className="text-xs font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : (
            <div
              className="space-y-2 rounded-lg border bg-muted/30 p-3"
              aria-label="Summarizing…"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-2/3" />
              <p className="text-xs text-muted-foreground">Summarizing…</p>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
