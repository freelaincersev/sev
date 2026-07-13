"use client";

import { Fragment, useState, useTransition } from "react";
import { Search } from "lucide-react";

import { askQuestion } from "@/lib/actions/retrieval";
import type { RetrievedChunk } from "@/lib/retrieval/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Render an answer, turning inline [n] markers into styled citation chips. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[\d+\](?:\[\d+\])*)/g);
  return (
    <p className="whitespace-pre-wrap text-sm leading-relaxed">
      {parts.map((part, i) =>
        /^(\[\d+\])+$/.test(part) ? (
          <sup key={i} className="mx-0.5 font-medium text-primary">
            {part}
          </sup>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

export function AskPanel({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [answer, setAnswer] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [results, setResults] = useState<RetrievedChunk[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      setError(null);
      const res = await askQuestion({}, formData);
      if (res.error) {
        setError(res.error);
        setAnswer(null);
        setModel(null);
        setResults(null);
        return;
      }
      setAnswer(res.answer ?? null);
      setModel(res.model ?? null);
      setResults(res.results ?? []);
    });
  }

  const sourceCount = results
    ? new Set(results.map((r) => r.sourceId)).size
    : 0;

  return (
    <section className="rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Ask</h2>
        <p className="text-xs text-muted-foreground">
          Get a citation-first answer grounded in this project&apos;s memory.
        </p>
      </header>

      <form action={onSubmit} className="flex gap-2 px-4 py-3">
        <input type="hidden" name="project_id" value={projectId} />
        <Input
          name="query"
          placeholder="Ask a question about this project…"
          autoComplete="off"
          required
        />
        <Button type="submit" disabled={pending}>
          <Search className="size-4" />
          {pending ? "Thinking…" : "Ask"}
        </Button>
      </form>

      {error ? (
        <p className="px-4 pb-4 text-sm text-destructive">{error}</p>
      ) : null}

      {answer && !error ? (
        <div className="border-t px-4 py-3">
          <AnswerText text={answer} />
          {model && results && results.length > 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Sent to {model} · {results.length} snippet
              {results.length === 1 ? "" : "s"} from {sourceCount} source
              {sourceCount === 1 ? "" : "s"} · full vault not sent
            </p>
          ) : null}
        </div>
      ) : null}

      {results && results.length > 0 && !error ? (
        <div className="border-t">
          <p className="px-4 pt-3 text-xs font-medium text-muted-foreground">
            Sources
          </p>
          <ol className="divide-y">
            {results.map((r, i) => (
              <li key={r.chunkId} className="px-4 py-3">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-xs font-semibold text-primary">
                    [{i + 1}]
                  </span>
                  <span className="truncate text-sm font-medium">
                    {r.sourceTitle}
                  </span>
                  <Badge variant="secondary">
                    {(r.similarity * 100).toFixed(0)}% match
                  </Badge>
                </div>
                {r.headingPath ? (
                  <p className="mb-1 text-xs text-muted-foreground">
                    {r.headingPath}
                  </p>
                ) : null}
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                  {r.content}
                </p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
    </section>
  );
}
