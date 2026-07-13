"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Layers, Pencil, Trash2 } from "lucide-react";

import { deleteFolder } from "@/lib/actions/folders";
import type { FolderWithCount } from "@/lib/data/folders";
import { FolderDialog } from "@/components/folder-dialog";
import { Mascot, resolveMascotPersona } from "@/components/mascot";
import { cn } from "@/lib/utils";

/**
 * Left-sidebar file structure: the project's folders as a (nestable) tree.
 * Each folder is labelled by its character avatar — hungry (sad) when it has no
 * sources, satisfied (happy) once it has at least one — so the face honestly
 * reflects the real count. Selection lives in the URL (`?folder=<id>`), no
 * browser storage, so the server page can filter the Sources tab.
 */
export function FolderTree({
  projectId,
  folders,
}: {
  projectId: string;
  folders: FolderWithCount[];
}) {
  const pathname = usePathname();
  const active = useSearchParams().get("folder");

  const childrenOf = (parentId: string | null) =>
    folders.filter((f) => f.parent_id === parentId);

  function renderFolders(parentId: string | null, depth: number) {
    return childrenOf(parentId).map((f) => {
      const persona = resolveMascotPersona(f.avatar_preset, f.id);
      const mood = f.source_count > 0 ? "happy" : "hungry";
      return (
        <div key={f.id}>
          <div
            className={cn(
              "group flex items-center gap-1 rounded-md pr-1 text-sm",
              active === f.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/60",
            )}
          >
            <Link
              href={`${pathname}?folder=${f.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pl-2"
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span
                className="inline-flex shrink-0 rounded-full"
                style={
                  f.color ? { boxShadow: `0 0 0 1.5px ${f.color}` } : undefined
                }
              >
                <Mascot persona={persona} mood={mood} size={22} />
              </span>
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {f.source_count}
              </span>
            </Link>
            <FolderDialog
              projectId={projectId}
              folder={f}
              trigger={
                <button
                  type="button"
                  aria-label={`Edit folder ${f.name}`}
                  className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
                >
                  <Pencil className="size-3.5" />
                </button>
              }
            />
            <form action={deleteFolder}>
              <input type="hidden" name="id" value={f.id} />
              <input type="hidden" name="project_id" value={projectId} />
              <button
                type="submit"
                aria-label={`Delete folder ${f.name}`}
                className="rounded p-1 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" />
              </button>
            </form>
          </div>
          {renderFolders(f.id, depth + 1)}
        </div>
      );
    });
  }

  return (
    <nav className="space-y-0.5">
      <Link
        href={pathname}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
          active
            ? "hover:bg-accent/60"
            : "bg-accent font-medium text-accent-foreground",
        )}
      >
        <Layers className="size-4 shrink-0" />
        <span className="flex-1 truncate">All sources</span>
      </Link>
      {renderFolders(null, 0)}
    </nav>
  );
}
