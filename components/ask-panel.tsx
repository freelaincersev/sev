"use client";

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUp, Bookmark, BookmarkCheck, Folder } from "lucide-react";
import { toast } from "sonner";

import { askQuestion } from "@/lib/actions/retrieval";
import { saveAnswerToMemory } from "@/lib/actions/sources";
import { AnswerExportDialog } from "@/components/answer-export-dialog";
import {
  CHAT_MODELS,
  DEFAULT_CHAT_MODEL_KEY,
  type ChatModelKey,
} from "@/lib/retrieval/models";
import type { RetrievedChunk, RetrievedDecision } from "@/lib/retrieval/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const SUGGESTIONS = [
  "Summarize this project's memory",
  "What are the main themes across my sources?",
  "What did I save most recently?",
];

/** Render an answer, turning inline [n] / [Dn] markers into styled citation chips. */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\[D?\d+\](?:\[D?\d+\])*)/g);
  return (
    <p className="whitespace-pre-wrap text-[15px] leading-relaxed">
      {parts.map((part, i) =>
        /^(\[D?\d+\])+$/.test(part) ? (
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
      decisions?: RetrievedDecision[];
      saved?: boolean;
    };

/** Decision records the answer drew on — cited inline as [Dn]. */
function DecisionSources({ decisions }: { decisions: RetrievedDecision[] }) {
  return (
    <details className="rounded-lg border bg-muted/30 px-3 py-2">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
        Decision records ({decisions.length})
      </summary>
      <ol className="mt-2 space-y-3">
        {decisions.map((d, i) => (
          <li key={d.id}>
            <div className="mb-1 flex items-center gap-2">
              <span className="shrink-0 text-xs font-semibold text-primary">
                [D{i + 1}]
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {d.decision}
              </span>
              <Badge
                variant={d.verification === "verified" ? "default" : "outline"}
                className="shrink-0 text-[10px]"
              >
                {d.verification}
              </Badge>
              {d.status === "superseded" && (
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  superseded
                </Badge>
              )}
            </div>
            {d.rationale ? (
              <p className="text-xs text-muted-foreground">{d.rationale}</p>
            ) : null}
          </li>
        ))}
      </ol>
    </details>
  );
}

function Sources({ results }: { results: RetrievedChunk[] }) {
  return (
    <details className="rounded-lg border bg-muted/30 px-3 py-2">
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

export function AskPanel({
  projectId,
  folderId,
  folderName,
  initialQuery,
}: {
  projectId: string;
  folderId?: string;
  folderName?: string;
  initialQuery?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saving, startSaving] = useTransition();
  const [messages, setMessages] = useState<Message[]>([]);
  const [model, setModel] = useState<ChatModelKey>(DEFAULT_CHAT_MODEL_KEY);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Which answer is capturing an intent line before saving, and its draft.
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [intentDraft, setIntentDraft] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const didInitialAsk = useRef(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  // Grow the composer with its content, up to a cap (Claude/GPT-style).
  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function runQuery(raw: string) {
    const query = raw.trim();
    if (!query || pending) return;
    setError(null);
    const formData = new FormData();
    formData.set("project_id", projectId);
    formData.set("query", query);
    formData.set("model", model);
    // When a folder is open, scope retrieval to just that folder's sources.
    if (folderId) formData.set("folder_id", folderId);
    // Send prior turns so follow-ups ("summarize what I just listed") resolve.
    formData.set(
      "history",
      JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))),
    );
    setMessages((m) => [...m, { role: "user", text: query }]);
    setValue("");
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
          decisions: res.decisions,
        },
      ]);
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      runQuery(value);
    }
  }

  // Auto-run a question handed off from the dashboard (?q=), once, then drop the
  // param so a refresh doesn't re-ask.
  useEffect(() => {
    if (didInitialAsk.current || !initialQuery?.trim()) return;
    didInitialAsk.current = true;
    runQuery(initialQuery);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  function onSave(index: number, intent: string) {
    const m = messages[index];
    if (m.role !== "assistant" || !m.query || m.saved) return;
    startSaving(async () => {
      const formData = new FormData();
      formData.set("project_id", projectId);
      formData.set("query", m.query ?? "");
      formData.set("answer", m.text);
      if (m.model) formData.set("model", m.model);
      if (intent.trim()) formData.set("intent", intent.trim());
      const res = await saveAnswerToMemory(formData);
      if (res.ok) {
        toast.success("Answer saved to memory.");
        setSavingIndex(null);
        setIntentDraft("");
        setMessages((msgs) =>
          msgs.map((mm, j) => (j === index ? { ...mm, saved: true } : mm)),
        );
      } else {
        toast.error(res.error ?? "Could not save the answer.");
      }
    });
  }

  const empty = messages.length === 0 && !pending;

  return (
    <section className="flex min-h-[30rem] flex-col lg:h-full lg:min-h-0">
      {folderName ? (
        <div className="flex items-center justify-center gap-1.5 border-b bg-muted/40 px-4 py-2 text-center text-xs text-muted-foreground">
          <Folder className="size-3.5 shrink-0" />
          <span>
            Answering only within{" "}
            <span className="font-medium text-foreground">{folderName}</span>
          </span>
        </div>
      ) : null}

      {/* Conversation (grows; composer stays pinned at the bottom). */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-1 py-6">
          {empty ? (
            <div className="flex h-full min-h-[24rem] flex-col items-center justify-center px-6 text-center">
              <h2 className="text-xl font-semibold tracking-tight">
                Ask your memory anything
              </h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Answers pull only the relevant pieces from this project and cite
                the sources they rely on — your full vault is never sent.
              </p>
              <div className="mt-6 flex flex-col items-stretch gap-2 sm:w-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => runQuery(s)}
                    className="rounded-full border bg-card px-4 py-2 text-sm text-foreground/80 transition hover:bg-accent/50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-muted px-4 py-2.5 text-[15px] leading-relaxed">
                      {m.text}
                    </div>
                  </div>
                ) : (
                  <div key={i} className="space-y-3">
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
                    {m.decisions && m.decisions.length > 0 ? (
                      <DecisionSources decisions={m.decisions} />
                    ) : null}
                    {m.results && m.results.length > 0 ? (
                      <Sources results={m.results} />
                    ) : null}
                    {m.query && m.results && m.results.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {m.saved ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              disabled
                            >
                              <BookmarkCheck className="size-4" />
                              Saved to memory
                            </Button>
                          ) : savingIndex === i ? null : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="rounded-full"
                              onClick={() => {
                                setSavingIndex(i);
                                setIntentDraft("");
                              }}
                            >
                              <Bookmark className="size-4" />
                              Save to memory
                            </Button>
                          )}
                          <AnswerExportDialog
                            projectId={projectId}
                            query={m.query}
                          />
                        </div>
                        {savingIndex === i && !m.saved ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2">
                            <input
                              autoFocus
                              value={intentDraft}
                              onChange={(e) => setIntentDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  onSave(i, intentDraft);
                                }
                              }}
                              placeholder="Why does this matter? (optional)"
                              className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm outline-none placeholder:text-muted-foreground"
                            />
                            <Button
                              type="button"
                              size="sm"
                              className="rounded-full"
                              disabled={saving}
                              onClick={() => onSave(i, intentDraft)}
                            >
                              {saving ? "Saving…" : "Save"}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="rounded-full"
                              disabled={saving}
                              onClick={() => onSave(i, "")}
                            >
                              Skip
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ),
              )}

              {pending ? (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
                  <span className="size-1.5 animate-bounce rounded-full bg-current" />
                </div>
              ) : null}
              {error ? (
                <p className="text-sm text-destructive">{error}</p>
              ) : null}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>

      {/* Composer — a single rounded field that grows with the text. */}
      <div className="pb-1 pt-2">
        <form
          ref={formRef}
          action={(fd) => runQuery(String(fd.get("query") ?? ""))}
          className="mx-auto w-full max-w-3xl"
        >
          <div className="rounded-[1.5rem] border bg-background shadow-sm transition-colors focus-within:border-ring">
            <textarea
              ref={taRef}
              name="query"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={onKeyDown}
              rows={1}
              placeholder="Ask anything about this project's memory…"
              className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
              <select
                name="model"
                value={model}
                onChange={(e) => setModel(e.target.value as ChatModelKey)}
                aria-label="AI model"
                className="rounded-lg bg-transparent px-1.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
              >
                {CHAT_MODELS.map((cm) => (
                  <option key={cm.key} value={cm.key}>
                    {cm.label}
                  </option>
                ))}
              </select>
              <Button
                type="submit"
                size="icon"
                className="size-8 rounded-full"
                disabled={pending || !value.trim()}
                aria-label="Ask"
              >
                <ArrowUp className="size-4" />
              </Button>
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            Answers cite their sources · your full vault is never sent
          </p>
        </form>
      </div>
    </section>
  );
}
