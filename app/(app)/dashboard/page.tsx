import Link from "next/link";
import { Trash2 } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Mascot, resolveMascotPersona } from "@/components/mascot";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/actions/projects";
import { getDashboardOverview } from "@/lib/data/dashboard";
import { listProjects } from "@/lib/data/projects";

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const [overview, projects] = await Promise.all([
    getDashboardOverview(),
    listProjects(),
  ]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your memory at a glance.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Stat tiles */}
      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Tokens this month" value={overview.monthTokens.toLocaleString()} />
        <StatTile
          label="Knowledge stored"
          value={`${overview.sources.toLocaleString()} source${overview.sources === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Context Packets"
          value={overview.packets.toLocaleString()}
        />
        <StatTile label="Projects" value={overview.projects.toLocaleString()} />
      </div>

      {/* Your crew — the character for each memory folder, across all projects. */}
      <section className="mb-10">
        <div className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight">Your crew</h2>
          <p className="text-sm text-muted-foreground">
            A character for each memory folder — open one to jump into its
            context. Hungry when empty, satisfied once it holds sources.
          </p>
        </div>

        {overview.crew.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No crew yet. Open a project and add a folder to give a memory its own
            character.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {overview.crew.map((f) => (
              <Link
                key={f.id}
                href={`/projects/${f.projectId}?folder=${f.id}`}
                className="flex items-center gap-3 rounded-xl border bg-card p-3 transition hover:bg-accent/50"
              >
                <span
                  className="inline-flex shrink-0 rounded-full"
                  style={f.color ? { boxShadow: `0 0 0 1.5px ${f.color}` } : undefined}
                >
                  <Mascot
                    persona={resolveMascotPersona(f.avatarPreset, f.id)}
                    mood={f.sourceCount > 0 ? "happy" : "hungry"}
                    size={40}
                  />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{f.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {f.projectTitle} · {f.sourceCount} source
                    {f.sourceCount === 1 ? "" : "s"}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Projects */}
      <section>
        <h2 className="mb-3 text-lg font-semibold tracking-tight">Projects</h2>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Create your first project to start building AI-ready memory.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => (
              <div
                key={project.id}
                className="group relative rounded-xl border bg-card p-4"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="block pr-8 font-medium hover:underline"
                >
                  {project.title}
                </Link>
                {project.description ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
                <form
                  action={deleteProject}
                  className="absolute right-3 top-3 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <input type="hidden" name="id" value={project.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete project"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
