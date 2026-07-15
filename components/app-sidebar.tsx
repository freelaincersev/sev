import Link from "next/link";
import { FolderKanban } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";

export type SidebarProject = { id: string; title: string };

/** Desktop-only left rail; hidden below lg (the mobile drawer reuses the body). */
export function AppSidebar(props: { email: string; projects: SidebarProject[] }) {
  return (
    <aside className="hidden w-60 shrink-0 border-r bg-muted/30 lg:block">
      <AppSidebarBody {...props} />
    </aside>
  );
}

/** Sidebar contents, shared by the desktop rail and the mobile drawer. */
export function AppSidebarBody({
  email,
  projects,
}: {
  email: string;
  projects: SidebarProject[];
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Sev
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">AI memory layer</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2">
        <p className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">
          Projects
        </p>
        <nav className="space-y-0.5">
          {projects.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              No projects yet.
            </p>
          ) : (
            projects.map((p) => (
              <Link
                key={p.id}
                href={`/projects/${p.id}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
              >
                <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{p.title}</span>
              </Link>
            ))
          )}
        </nav>
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
