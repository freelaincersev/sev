import { CreateProjectDialog } from "@/components/create-project-dialog";
import {
  AddToMemoryDialog,
  type DialogProject,
} from "@/components/dashboard/AddToMemoryDialog";
import type { DashboardSummary } from "@/lib/data/dashboard";

/**
 * Page header: title, one-line memory summary, and the two entry points —
 * Add to memory (secondary) and New project (primary). Save moved here off the
 * home body.
 */
export function DashboardHeader({
  summary,
  projects,
}: {
  summary: DashboardSummary;
  projects: DialogProject[];
}) {
  const parts = [
    `${summary.sourceCount} source${summary.sourceCount === 1 ? "" : "s"}`,
    `${summary.packetCount} context packet${summary.packetCount === 1 ? "" : "s"}`,
    `${summary.reusesThisWeek} reuse${summary.reusesThisWeek === 1 ? "" : "s"} this week`,
  ];

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your memory
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          Your projects, context, and reusable knowledge in one place.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          {parts.join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {projects.length > 0 ? <AddToMemoryDialog projects={projects} /> : null}
        <CreateProjectDialog />
      </div>
    </header>
  );
}
