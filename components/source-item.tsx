"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Download, FolderInput, Trash2 } from "lucide-react";

import {
  deleteSource,
  getSourceChunks,
  moveSource,
  summarizeSource,
  type SourceChunk,
} from "@/lib/actions/sources";
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
 * A source row whose detail expands inline (accordion). The detail has two
 * views: the AI Summary (generated once on first open, cached on the source)
 * and Content — the actual indexed chunks, lazy-loaded on demand so you can see
 * exactly what Sev retrieves. A compact folder picker moves the source between
 * folders without leaving the list.
 */
export function SourceItem({
  source,
  projectId,
  folders,
}: {
  source: SourceWithCount;
  projectId: string;
  folders: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"summary" | "content">("summary");
  const [summary, setSummary] = useState(source.summary);
  const [model, setModel] = useState(source.summary_model);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [chunks, setChunks] = useState<SourceChunk[] | null>(null);
  const [chunksError, setChunksError] = useState<string | null>(null);
  const [chunksPending, startChunks] = useTransition();

  const [moving, startMoving] = useTransition();

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

  function loadChunks() {
    setChunksError(null);
    startChunks(async () => {
      const formData = new FormData();
      formData.set("id", source.id);
      const result = await getSourceChunks(formData);
      if (result.chunks) setChunks(result.chunks);
      else setChunksError(result.error ?? "Could not load content.");
    });
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && view === "summary" && !summary && !pending) summarize();
  }

  function showContent() {
    setView("content");
    if (!chunks && !chunksPending) loadChunks();
  }

  function onMoveChange(folderId: string) {
    startMoving(async () => {
      const formData = new FormData();
      formData.set("id", source.id);
      formData.set("project_id", projectId);
      formData.set("folder_id", folderId);
      await moveSource(formData);
    });
  }

  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2">
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
            {source.origin ? ` · from ${source.origin}` : ""}
            {source.status === "error" && source.error_message
              ? ` · ${source.error_message}`
              : ""}
          </p>
          {source.intent ? (
            <p className="pl-[1.125rem] text-xs text-foreground/70">
              <span className="text-muted-foreground">Why it matters: </span>
              {source.intent}
            </p>
          ) : null}
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
        <div className="mt-2 space-y-2 pl-[1.125rem]">
          {folders.length > 0 ? (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <FolderInput className="size-3.5" />
              <span>Folder</span>
              <select
                value={source.folder_id ?? ""}
                disabled={moving}
                onChange={(e) => onMoveChange(e.target.value)}
                className="max-w-[10rem] truncate rounded-md border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring disabled:opacity-50"
                aria-label="Move to folder"
              >
                <option value="">All sources (no folder)</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {/* View switch */}
          <div className="flex gap-1 text-xs">
            <button
              type="button"
              onClick={() => setView("summary")}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition",
                view === "summary"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Summary
            </button>
            <button
              type="button"
              onClick={showContent}
              className={cn(
                "rounded-full px-2.5 py-1 font-medium transition",
                view === "content"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent",
              )}
            >
              Content
            </button>
          </div>

          {view === "summary" ? (
            summary ? (
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
            )
          ) : chunks ? (
            chunks.length === 0 ? (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm text-muted-foreground">
                No indexed content yet.
              </p>
            ) : (
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">
                  {chunks.length} chunk{chunks.length === 1 ? "" : "s"} — what
                  Sev indexes and retrieves.
                </p>
                <div className="max-h-80 space-y-3 overflow-y-auto">
                  {chunks.map((c) => (
                    <div key={c.id} className="space-y-1">
                      <p className="text-[11px] font-medium text-muted-foreground">
                        #{c.index + 1}
                        {c.headingPath ? ` · ${c.headingPath}` : ""}
                        {c.page != null ? ` · p.${c.page}` : ""}
                      </p>
                      <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-foreground/90">
                        {c.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : chunksError ? (
            <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
              <p className="text-sm text-destructive">{chunksError}</p>
              <button
                type="button"
                onClick={loadChunks}
                className="text-xs font-medium underline underline-offset-2"
              >
                Try again
              </button>
            </div>
          ) : (
            <div
              className="space-y-2 rounded-lg border bg-muted/30 p-3"
              aria-label="Loading content…"
            >
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-3/4" />
              <p className="text-xs text-muted-foreground">Loading content…</p>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
