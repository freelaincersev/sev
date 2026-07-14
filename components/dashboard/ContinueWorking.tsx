import { CreateProjectDialog } from "@/components/create-project-dialog";
import { ProjectCard } from "@/components/dashboard/ProjectCard";
import type { DashboardProject } from "@/lib/data/dashboard";

/** Jump back into recent projects (most-recently-active first, max 3). */
export function ContinueWorking({
  projects,
}: {
  projects: DashboardProject[];
}) {
  if (projects.length === 0) {
    return (
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">
          Continue working
        </h2>
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Start by creating a project and adding your first source.
          </p>
          <div className="mt-4 flex justify-center">
            <CreateProjectDialog />
          </div>
        </div>
      </section>
    );
  }

  const top = projects.slice(0, 3);
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Continue working
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {top.map((p, i) => (
          <ProjectCard key={p.id} project={p} highlight={i === 0} />
        ))}
      </div>
    </section>
  );
}
