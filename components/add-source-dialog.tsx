"use client";

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

/** Korean object particle 을/를; defaults to 을 for non-Hangul endings. */
function objectParticle(word: string): string {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0 ? "을" : "를";
  }
  return /[aeiou]$/i.test(ch) ? "를" : "을";
}

export function AddSourceDialog({
  projectId,
  folderId,
}: {
  projectId: string;
  folderId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "file" | "url">("paste");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addSource({}, formData);
      if (result.ok) {
        const t = result.title?.trim() || "자료";
        toast.success(`‘${t}’${objectParticle(t)} 먹었어요!`);
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="rounded-full">
          <Plus className="size-4" />
          Add source
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a source</DialogTitle>
          <DialogDescription>
            Sev converts it to Markdown memory, chunks it, and embeds it for
            retrieval.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-1 flex gap-1">
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
            variant={mode === "file" ? "default" : "outline"}
            onClick={() => setMode("file")}
          >
            Upload .md / .txt / .pdf
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "url" ? "default" : "outline"}
            onClick={() => setMode("url")}
          >
            URL
          </Button>
        </div>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />
          {folderId ? (
            <input type="hidden" name="folder_id" value={folderId} />
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="title">
              Title {mode === "paste" ? "" : "(optional)"}
            </Label>
            <Input id="title" name="title" placeholder="e.g. Competitor research" />
          </div>

          {mode === "paste" ? (
            <div className="space-y-2">
              <Label htmlFor="content">Text</Label>
              <Textarea
                id="content"
                name="content"
                rows={8}
                placeholder="Paste notes, docs, or Markdown here…"
                required
                // Cap growth (base Textarea uses field-sizing-content) so long
                // pastes scroll inside the box instead of stretching the dialog.
                className="max-h-[40vh] resize-none overflow-y-auto"
              />
            </div>
          ) : mode === "file" ? (
            <div className="space-y-2">
              <Label htmlFor="file">File (.md, .txt, or .pdf)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".md,.markdown,.txt,.pdf,text/markdown,text/plain,application/pdf"
                required
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="url">Page URL</Label>
              <Input
                id="url"
                name="url"
                type="url"
                placeholder="https://example.com/article"
                required
              />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Indexing…" : "Add & index"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
