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

export function AddSourceDialog({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"paste" | "file">("paste");
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await addSource({}, formData);
      if (result.ok) {
        toast.success("Source added and indexed.");
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
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
            Upload .md / .txt
          </Button>
        </div>

        <form action={onSubmit} className="space-y-4">
          <input type="hidden" name="project_id" value={projectId} />

          <div className="space-y-2">
            <Label htmlFor="title">
              Title {mode === "file" ? "(optional)" : ""}
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
              />
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="file">File (.md or .txt)</Label>
              <Input
                id="file"
                name="file"
                type="file"
                accept=".md,.markdown,.txt,text/markdown,text/plain"
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
