"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addSource } from "@/lib/actions/sources";
import type { AskProjectOption } from "@/components/dashboard-ask";
import { Button } from "@/components/ui/button";

/** A single-line http(s) URL — captured as a URL source, else pasted as text. */
const URL_RE = /^https?:\/\/\S+$/i;

/**
 * Quick Capture: the push half of the loop. Paste a good answer from any AI, a
 * note, or a link, pick a project, and it lands in memory via the same ingest
 * pipeline as Add source — no need to open the project first. Closes the
 * cross-LLM loop (save what ChatGPT/Claude gave you, reuse it anywhere).
 */
export function DashboardCapture({ projects }: { projects: AskProjectOption[] }) {
  const router = useRouter();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const taRef = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [value]);

  function submit() {
    const text = value.trim();
    if (!text || !projectId || pending) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("project_id", projectId);
      if (URL_RE.test(text)) {
        fd.set("url", text);
      } else {
        fd.set("content", text);
        fd.set("title", text.split("\n")[0].slice(0, 60));
      }
      const res = await addSource({}, fd);
      if (res.ok) {
        const project = projects.find((p) => p.id === projectId)?.title ?? "memory";
        toast.success(`Saved to ${project}.`);
        setValue("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save to memory.");
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Multi-line paste is expected, so require a modifier to submit.
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-3">
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        placeholder="Save to memory — paste a good AI answer, a note, or a link…"
        aria-label="Save to memory"
        className="block max-h-[160px] w-full resize-none bg-transparent px-1 pb-2 pt-1 text-sm outline-none placeholder:text-muted-foreground"
      />
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="hidden sm:inline">Save to</span>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            aria-label="Project to save into"
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
          type="button"
          size="sm"
          variant="outline"
          className="rounded-full"
          disabled={!value.trim() || !projectId || pending}
          onClick={submit}
        >
          <Plus className="size-4" />
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
