"use client";

import { useState, useTransition } from "react";

import { summarizeSource } from "@/lib/actions/sources";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { SourceWithCount } from "@/lib/data/sources";

/**
 * A-3: click a source title → its summary. Generated once on first open
 * (GPT-4o mini) and stored on the source; later opens read the cached copy.
 */
export function SourceSummaryDialog({
  source,
  projectId,
}: {
  source: SourceWithCount;
  projectId: string;
}) {
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

  function onOpenChange(open: boolean) {
    if (open && !summary && !pending) summarize();
  }

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="min-w-0 truncate text-left text-sm font-medium hover:underline"
        >
          {source.title}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="pr-6">{source.title}</DialogTitle>
          <DialogDescription>
            {source.type.replace("_", " ")} · {source.chunk_count} chunk
            {source.chunk_count === 1 ? "" : "s"}
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <>
            <p className="max-h-80 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed">
              {summary}
            </p>
            <p className="text-xs text-muted-foreground">
              Summarized by {model ?? "AI"} · stored with this source
            </p>
          </>
        ) : error ? (
          <div className="space-y-2">
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
          <div className="space-y-2" aria-label="Summarizing…">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
            <p className="text-xs text-muted-foreground">Summarizing…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
