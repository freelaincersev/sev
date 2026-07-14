"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addSource } from "@/lib/actions/sources";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export type DialogProject = { id: string; name: string };

type Mode = "paste" | "url" | "file";

/**
 * Add to memory from the dashboard: the in-project Add source flow plus a
 * project picker, so you can save a pasted AI answer, a link, or a file
 * without opening a project first. Reuses the addSource server action verbatim.
 */
export function AddToMemoryDialog({ projects }: { projects: DialogProject[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("paste");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("project_id", projectId);
    startTransition(async () => {
      const res = await addSource({}, formData);
      if (res.ok) {
        const name = projects.find((p) => p.id === projectId)?.name ?? "memory";
        toast.success(`Saved to ${name}.`);
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error ?? "Couldn't save to memory.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="rounded-full">
          <Plus className="size-4" />
          Add to memory
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to memory</DialogTitle>
          <DialogDescription>
            Save a pasted AI answer, a link, or a file. Sev converts it to
            Markdown memory, chunks it, and embeds it for retrieval.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant={mode === "paste" ? "default" : "outline"}
              onClick={() => setMode("paste")}
            >
              Paste text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "url" ? "default" : "outline"}
              onClick={() => setMode("url")}
            >
              Link
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "file" ? "default" : "outline"}
              onClick={() => setMode("file")}
            >
              File
            </Button>
          </div>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
            Save to
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Project to save into"
              className="max-w-[10rem] truncate rounded-md border bg-background px-2 py-1 text-xs text-foreground outline-none focus-visible:border-ring"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <form action={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="atm-title">
              Title {mode === "paste" ? "(optional)" : "(optional)"}
            </Label>
            <Input
              id="atm-title"
              name="title"
              placeholder="e.g. Claude answer on positioning"
            />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <Label htmlFor="atm-content">Text</Label>
              <Textarea
                id="atm-content"
                name="content"
                rows={8}
                placeholder="Paste an AI answer, notes, or Markdown…"
                required
                className="max-h-[40vh] resize-none overflow-y-auto"
              />
            </div>
          ) : mode === "url" ? (
            <div className="space-y-2">
              <Label htmlFor="atm-url">Page URL</Label>
              <Input
                id="atm-url"
                name="url"
                type="url"
                placeholder="https://example.com/article"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="atm-file">File (.md, .txt, or .pdf)</Label>
              <Input
                id="atm-file"
                name="file"
                type="file"
                accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="atm-intent">
              Why does this matter?{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id="atm-intent"
              name="intent"
              placeholder="e.g. Core market for the Samsung cooling pitch"
            />
            <p className="text-xs text-muted-foreground">
              One line of intent — it sticks to this memory and sharpens future
              retrieval.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="atm-origin">
              Where from?{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <select
              id="atm-origin"
              name="origin"
              defaultValue=""
              className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring"
            >
              <option value="">Not specified</option>
              <option value="Perplexity">Perplexity</option>
              <option value="ChatGPT">ChatGPT</option>
              <option value="Claude">Claude</option>
              <option value="Gemini">Gemini</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || !projectId}>
              {pending ? "Saving…" : "Save to memory"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
