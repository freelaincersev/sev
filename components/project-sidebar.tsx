import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { FolderDialog } from "@/components/folder-dialog";
import { FolderTree } from "@/components/folder-tree";
import { SignOutButton } from "@/components/sign-out-button";
import type { FolderWithCount } from "@/lib/data/folders";
import type { Project } from "@/lib/data/projects";

/**
 * The project workspace's left rail: navigation + structure (strategy §5.4).
 * The right-hand Sources tab stays "the material behind this answer" — this
 * side is where you browse the project and its folder tree.
 */
export function ProjectSidebar(props: {
  project: Project;
  folders: FolderWithCount[];
  totalSources: number;
  email: string;
}) {
  return (
    <aside className="hidden w-64 shrink-0 border-r bg-muted/30 lg:block">
      <ProjectSidebarBody {...props} />
    </aside>
  );
}

/** Sidebar contents, shared by the desktop rail and the mobile drawer. */
export function ProjectSidebarBody({
  project,
  folders,
  totalSources,
  email,
}: {
  project: Project;
  folders: FolderWithCount[];
  totalSources: number;
  email: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-4">
        <Link
          href="/dashboard"
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="size-3.5" />
          All projects
        </Link>
        <h1 className="truncate text-sm font-semibold tracking-tight">
          {project.title}
        </h1>
        {project.description ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <FolderTree
          projectId={project.id}
          folders={folders}
          totalSources={totalSources}
        />
        <div className="mt-1">
          <FolderDialog projectId={project.id} />
        </div>
      </div>

      <div className="border-t p-2">
        <p className="truncate px-2 py-1 text-xs text-muted-foreground">
          {email}
        </p>
        <SignOutButton />
      </div>
    </div>
  );
}
