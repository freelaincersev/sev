"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";

export type AskProjectOption = { id: string; title: string };

/**
 * Ask-first home: type a question, pick which project's memory to ask, and land
 * in that project's chat with the question already running (via ?q=). The
 * project picker (defaulting to the most recent) replaces the old "jump blindly
 * to the latest project" buttons.
 */
export function DashboardAsk({ projects }: { projects: AskProjectOption[] }) {
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

  function submit() {
    const q = value.trim();
    if (!q || !projectId) return;
    router.push(`/projects/${projectId}?q=${encodeURIComponent(q)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <form
      action={submit}
      className="rounded-[1.5rem] border bg-background shadow-sm transition-colors focus-within:border-ring"
    >
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={1}
        placeholder="Ask your memory anything…"
        aria-label="Ask your memory"
        className="block max-h-[200px] w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2 px-2.5 pb-2.5 pt-1">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Ask in</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Project to ask"
            className="max-w-[12rem] truncate rounded-lg bg-transparent px-1.5 py-1 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:bg-muted"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="submit"
          size="icon"
          className="size-8 rounded-full"
          disabled={!value.trim() || !projectId}
          aria-label="Ask"
        >
          <ArrowUp className="size-4" />
        </Button>
      </div>
    </form>
  );
}
