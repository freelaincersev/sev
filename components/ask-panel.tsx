"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { Bookmark, BookmarkCheck, Send } from "lucide-react";
import { toast } from "sonner";

import { askQuestion } from "@/lib/actions/retrieval";
import { saveAnswerToMemory } from "@/lib/actions/sources";
import { AnswerExportDialog } from "@/components/answer-export-dialog";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_KEY,
  type ChatModelKey,
} from "@/lib/retrieval/models";
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

type Message =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text: string;
      query?: string;
      model?: string;
      results?: RetrievedChunk[];
      saved?: boolean;
    };

function Sources({ results }: { results: RetrievedChunk[] }) {
  return (
    <details className="rounded-md border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Sources ({results.length})
      </summary>
      <ol className="mt-2 space-y-3">
        {results.map((r, i) => (
          <li key={r.chunkId}>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">
                [{i + 1}]
              </span>
              <span className="truncate text-sm font-medium">
                {r.sourceTitle}
              </span>
              <Badge variant="secondary">
                {(r.similarity * 100).toFixed(0)}%
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
    </details>
  );
}

export function AskPanel({ projectId }: { projectId: string }) {
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ChatModelKey>(DEFAULT_CHAT_MODEL_KEY);
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  function onSubmit(formData: FormData) {
    const query = String(formData.get("query") ?? "").trim();
    if (!query) return;
    setError(null);
    // Send prior turns so follow-ups ("summarize what I just listed") resolve.
    // `messages` here is the conversation before this question is added.
    formData.set(
      "history",
      JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))),
    );
    setMessages((m) => [...m, { role: "user", text: query }]);
    formRef.current?.reset();
    startTransition(async () => {
      const res = await askQuestion({}, formData);
      if (res.error) {
        setError(res.error);
        return;
      }
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: res.answer ?? "",
          query: res.query,
          model: res.model,
          results: res.results,
        },
      ]);
    });
  }

  function onSave(index: number) {
    const m = messages[index];
    if (m.role !== "assistant" || !m.query || m.saved) return;
    startSaving(async () => {
      const formData = new FormData();
      formData.set("project_id", projectId);
      formData.set("query", m.query ?? "");
      formData.set("answer", m.text);
      if (m.model) formData.set("model", m.model);
      const res = await saveAnswerToMemory(formData);
      if (res.ok) {
        toast.success("Answer saved to memory.");
        setMessages((msgs) =>
          msgs.map((mm, j) => (j === index ? { ...mm, saved: true } : mm)),
        );
      } else {
        toast.error(res.error ?? "Could not save the answer.");
      }
    });
  }

  return (
    <section className="flex h-[calc(100dvh-13rem)] min-h-[26rem] flex-col rounded-lg border">
      <header className="border-b px-4 py-3">
        <h2 className="text-sm font-semibold">Ask</h2>
        <p className="text-xs text-muted-foreground">
          Get a citation-first answer grounded in this project&apos;s memory.
        </p>
      </header>

      {/* Conversation (grows upward; input stays pinned at the bottom). */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !pending ? (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Ask anything about this project&apos;s memory. Answers cite the
            sources they rely on.
          </div>
        ) : null}

        {messages.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <AnswerText text={m.text} />
              {m.model && m.results && m.results.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Sent to {m.model} · {m.results.length} snippet
                  {m.results.length === 1 ? "" : "s"} from{" "}
                  {new Set(m.results.map((r) => r.sourceId)).size} source
                  {new Set(m.results.map((r) => r.sourceId)).size === 1
                    ? ""
                    : "s"}{" "}
                  · full vault not sent
                </p>
              ) : null}
              {m.results && m.results.length > 0 ? (
                <Sources results={m.results} />
              ) : null}
              {m.query && m.results && m.results.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={m.saved || saving}
                    onClick={() => onSave(i)}
                  >
                    {m.saved ? (
                      <>
                        <BookmarkCheck className="size-4" />
                        Saved to memory
                      </>
                    ) : (
                      <>
                        <Bookmark className="size-4" />
                        {saving ? "Saving…" : "Save to memory"}
                      </>
                    )}
                  </Button>
                  <AnswerExportDialog projectId={projectId} query={m.query} />
                </div>
              ) : null}
            </div>
          ),
        )}

        {pending ? (
          <p className="text-sm text-muted-foreground">Thinking…</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div ref={endRef} />
      </div>

      <form
        ref={formRef}
        action={onSubmit}
        className="flex gap-2 border-t p-3"
      >
        <input type="hidden" name="project_id" value={projectId} />
        <select
          name="model"
          value={model}
          onChange={(e) => setModel(e.target.value as ChatModelKey)}
          aria-label="AI model"
          className="shrink-0 rounded-lg border bg-background px-2 text-sm outline-none focus-visible:border-ring"
        >
          {CHAT_MODELS.map((m) => (
            <option key={m.key} value={m.key}>
              {m.label}
            </option>
          ))}
        </select>
        <Input
          name="query"
          placeholder="Ask a question about this project…"
          autoComplete="off"
          required
        />
        <Button type="submit" disabled={pending}>
          <Send className="size-4" />
          {pending ? "…" : "Ask"}
        </Button>
      </form>
    </section>
  );
}
