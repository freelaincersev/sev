"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { addSource } from "@/lib/actions/sources";

const MAX_FILES = 5;
const ACCEPT = /\.(md|markdown|txt|pdf)$/i;

type Pending = { id: string; name: string };

/**
 * Wraps the Sources list as a drop zone: drop up to 5 files (or they can come
 * from anywhere), each uploads in parallel and shows an optimistic "Uploading…"
 * row immediately — no waiting for one to finish before the next, and no
 * jumping straight to "ready". Each row is replaced by the real source (via
 * refresh) once its ingest completes.
 */
export function SourceUploader({
  projectId,
  folderId,
  children,
}: {
  projectId: string;
  folderId?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const seq = useRef(0);

  function uploadFiles(fileList: FileList) {
    const all = Array.from(fileList);
    const capped = all.slice(0, MAX_FILES);
    if (all.length > MAX_FILES) {
      toast.error(`Up to ${MAX_FILES} files at once — taking the first ${MAX_FILES}.`);
    }
    const accepted = capped.filter((f) => ACCEPT.test(f.name));
    if (accepted.length < capped.length) {
      toast.error("Only .md, .txt, or .pdf files can be uploaded.");
    }
    for (const file of accepted) {
      const id = `up-${seq.current++}`;
      setPending((p) => [...p, { id, name: file.name }]);
      void (async () => {
        const fd = new FormData();
        fd.set("project_id", projectId);
        if (folderId) fd.set("folder_id", folderId);
        fd.set("file", file);
        const res = await addSource({}, fd);
        setPending((p) => p.filter((x) => x.id !== id));
        if (res.ok) router.refresh();
        else toast.error(res.error ?? `Couldn't add ${file.name}.`);
      })();
    }
  }

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes("Files");
  }

  return (
    <div
      className="relative"
      onDragEnter={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (hasFiles(e)) e.preventDefault();
      }}
      onDragLeave={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) {
          dragDepth.current = 0;
          setDragging(false);
        }
      }}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
      }}
    >
      {pending.length > 0 ? (
        <ul className="divide-y border-b">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground"
            >
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span className="min-w-0 flex-1 truncate text-foreground">
                {p.name}
              </span>
              <span className="shrink-0 text-xs">Uploading…</span>
            </li>
          ))}
        </ul>
      ) : null}

      {children}

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-foreground/40 bg-background/80">
          <div className="flex items-center gap-2 text-sm font-medium">
            <UploadCloud className="size-5" />
            Drop up to {MAX_FILES} files
          </div>
        </div>
      ) : null}
    </div>
  );
}
