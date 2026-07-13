"use client";

import { useState, useTransition, type ReactNode } from "react";
import { FolderPlus } from "lucide-react";
import { toast } from "sonner";

import { createFolder, updateFolder } from "@/lib/actions/folders";
import type { FolderWithCount } from "@/lib/data/folders";
import { MASCOT_PERSONAS, Mascot } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** A small, fixed palette — presets only, no custom color picker. */
const COLORS = [
  "#6366f1", // indigo
  "#0ea5e9", // sky
  "#10b981", // emerald
  "#f59e0b", // amber
  "#f43f5e", // rose
  "#a855f7", // violet
];

/**
 * Create or edit a folder: name + a preset character avatar + a preset color.
 * Presets only — deliberately no custom pixel editor. The avatar is a static
 * label for the folder (a retrieval scope), never an agent.
 */
export function FolderDialog({
  projectId,
  folder,
  trigger,
}: {
  projectId: string;
  folder?: FolderWithCount;
  trigger?: ReactNode;
}) {
  const isEdit = !!folder;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(folder?.name ?? "");
  const [persona, setPersona] = useState<string>(
    folder?.avatar_preset ?? MASCOT_PERSONAS[1], // default "ceo"
  );
  const [color, setColor] = useState<string>(folder?.color ?? COLORS[0]);

  function onSubmit(formData: FormData) {
    formData.set("avatar_preset", persona);
    formData.set("color", color);
    startTransition(async () => {
      const res = isEdit
        ? await updateFolder({}, formData)
        : await createFolder({}, formData);
      if (res.ok) {
        toast.success(isEdit ? "Folder updated." : "Folder created.");
        setOpen(false);
      } else if (res.error) {
        toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground"
          >
            <FolderPlus className="size-4" />
            New folder
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit folder" : "New folder"}</DialogTitle>
        </DialogHeader>
        <form action={onSubmit} className="space-y-5">
          <input type="hidden" name="project_id" value={projectId} />
          {isEdit ? <input type="hidden" name="id" value={folder.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="folder-name">Name</Label>
            <Input
              id="folder-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer interviews"
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Character</Label>
            <div className="flex flex-wrap gap-2">
              {MASCOT_PERSONAS.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-label={p}
                  aria-pressed={persona === p}
                  onClick={() => setPersona(p)}
                  className={cn(
                    "rounded-xl border-2 p-1 transition",
                    persona === p
                      ? "border-primary"
                      : "border-transparent hover:border-border",
                  )}
                >
                  <Mascot persona={p} mood="happy" size={44} />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  style={{ backgroundColor: c }}
                  className={cn(
                    "size-7 rounded-full ring-offset-2 ring-offset-background transition",
                    color === c ? "ring-2 ring-foreground" : "",
                  )}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending
                ? isEdit
                  ? "Saving…"
                  : "Creating…"
                : isEdit
                  ? "Save"
                  : "Create folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
