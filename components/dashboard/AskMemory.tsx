"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AskProject = { id: string; name: string };

/**
 * The home's primary action: ask your memory. Pick which project to ask
 * (defaults to the most recently active), and land in that project's chat with
 * the question already running (via ?q=). Suggested actions seed the box.
 */
export function AskMemory({ projects }: { projects: AskProject[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [value, setValue] = useState("");
  const taRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  function ask(query: string) {
    const q = query.trim();
    if (!q || !projectId) return;
    router.push(`/projects/${projectId}?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask(value);
    }
  }

  const firstName = projects[0]?.name ?? "this project";
  const suggestions = [
    `Summarize what I already know about ${firstName}`,
    "Build context for my next AI prompt",
    "What did I save most recently?",
  ];

  return (
    <div>
      <form
        action={() => ask(value)}
        className="rounded-2xl border bg-background transition-colors focus-within:border-ring"
      >
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Ask your memory anything…"
          aria-label="Ask your memory"
          className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-2 pt-4 text-base outline-none placeholder:text-muted-foreground"
        />
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Ask in</span>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Project to ask"
              className="max-w-[14rem] truncate rounded-lg bg-transparent px-1.5 py-1 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <Button
            type="submit"
            size="icon"
            className="size-9 rounded-full"
            disabled={!value.trim() || !projectId}
            aria-label="Ask"
          >
            <ArrowUp className="size-4" />
          </Button>
        </div>
      </form>

      {projects.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              className="rounded-full px-3 py-1 text-sm text-muted-foreground transition hover:bg-accent/60 hover:text-foreground"
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
