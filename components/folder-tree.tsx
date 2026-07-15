"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Layers, Pencil, Trash2 } from "lucide-react";

import { deleteFolder } from "@/lib/actions/folders";
import type { FolderWithCount } from "@/lib/data/folders";
import { FolderDialog } from "@/components/folder-dialog";
import { Mascot, resolveMascotPersona } from "@/components/mascot";
import { cn } from "@/lib/utils";

/** Sentinel id for the "All sources" root row's own collapse state. */
const ROOT = "__root__";

/** Chevron toggle for a tree row; a spacer keeps leaf rows aligned. */
function ExpandToggle({
  hasChildren,
  open,
  label,
  onToggle,
}: {
  hasChildren: boolean;
  open: boolean;
  label: string;
  onToggle: () => void;
}) {
  if (!hasChildren) return <span className="size-5 shrink-0" />;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={`${open ? "Collapse" : "Expand"} ${label}`}
      aria-expanded={open}
      className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition hover:text-foreground"
    >
      <ChevronRight
        className={cn("size-3.5 transition-transform", open && "rotate-90")}
      />
    </button>
  );
}

/**
 * Left-sidebar file structure: the project's folders as a collapsible tree.
 * "All sources" is the root (collapse to hide the whole tree); any folder with
 * sub-folders gets a chevron to expand/collapse it. Each folder is labelled by
 * its character avatar — hungry (sad) when empty, satisfied (happy) once it has
 * sources. Selection lives in the URL (`?folder=<id>`), no browser storage, so
 * the server page can filter the Sources tab.
 */
export function FolderTree({
  projectId,
  folders,
  totalSources,
}: {
  projectId: string;
  folders: FolderWithCount[];
  totalSources: number;
}) {
  const pathname = usePathname();
  const active = useSearchParams().get("folder");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childrenOf = (parentId: string | null) =>
    folders.filter((f) => f.parent_id === parentId);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function renderFolders(parentId: string | null, depth: number) {
    return childrenOf(parentId).map((f) => {
      const persona = resolveMascotPersona(f.avatar_preset, f.id);
      const mood = f.source_count > 0 ? "happy" : "hungry";
      const kids = childrenOf(f.id);
      const open = !collapsed.has(f.id);
      return (
        <div key={f.id}>
          <div
            className={cn(
              "group flex items-center gap-0.5 rounded-md pr-1 text-sm",
              active === f.id
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/60",
            )}
            style={{ paddingLeft: `${depth * 12}px` }}
          >
            <ExpandToggle
              hasChildren={kids.length > 0}
              open={open}
              label={f.name}
              onToggle={() => toggle(f.id)}
            />
            <Link
              href={`${pathname}?folder=${f.id}`}
              className="flex min-w-0 flex-1 items-center gap-2 py-1.5"
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
          {kids.length > 0 && open ? renderFolders(f.id, depth + 1) : null}
        </div>
      );
    });
  }

  const topLevel = childrenOf(null);
  const rootOpen = !collapsed.has(ROOT);

  return (
    <nav className="space-y-0.5">
      <div
        className={cn(
          "flex items-center gap-0.5 rounded-md text-sm",
          active
            ? "hover:bg-accent/60"
            : "bg-accent font-medium text-accent-foreground",
        )}
      >
        <ExpandToggle
          hasChildren={topLevel.length > 0}
          open={rootOpen}
          label="all sources"
          onToggle={() => toggle(ROOT)}
        />
        <Link
          href={pathname}
          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 pr-2"
        >
          <Layers className="size-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">All sources</span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {totalSources}
          </span>
        </Link>
      </div>
      {rootOpen ? renderFolders(null, 0) : null}
    </nav>
  );
}
