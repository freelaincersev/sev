import Link from "next/link";
import { ArrowRight, FolderClosed, Sparkles, Trash2, Upload } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Button } from "@/components/ui/button";
import { deleteProject } from "@/lib/actions/projects";
import { getDashboardOverview } from "@/lib/data/dashboard";

function StatTile({
  label,
  value,
  hint,
  emphasis,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  href?: string;
}) {
  const base = emphasis
    ? "rounded-xl border border-foreground/15 bg-foreground p-4 text-background"
    : "rounded-xl border bg-card p-4";
  const interactive = href
    ? emphasis
      ? " group block transition hover:opacity-90"
      : " group block transition hover:bg-accent/50"
    : "";
  const body = (
    <>
      <p
        className={
          emphasis
            ? "text-xs text-background/70"
            : "text-xs text-muted-foreground"
        }
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? (
        <p
          className={
            emphasis
              ? "mt-0.5 flex items-center gap-1 text-xs text-background/60"
              : "mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
          }
        >
          {hint}
          {href ? (
            <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          ) : null}
        </p>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={base + interactive}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export default async function DashboardPage() {
  const overview = await getDashboardOverview();
  const projects = overview.projectCards;
  const recent = projects[0];

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your memory</h1>
          <p className="text-sm text-muted-foreground">
            Everything you&apos;ve taught Sev — retrieved on demand, ready for
            any AI.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Payoff first: lead with the North Star (packets pulled into other AIs),
          then what's feeding the memory. Storing is the cost; using is the win. */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Context Packets"
          value={overview.packets.toLocaleString()}
          hint="pulled for your AIs"
          emphasis
          href={recent ? `/projects/${recent.id}?tab=usage` : undefined}
        />
        <StatTile
          label="Sources"
          value={overview.sources.toLocaleString()}
          hint="feeding your memory"
          href={recent ? `/projects/${recent.id}` : undefined}
        />
        <StatTile
          label="Pulled this month"
          value={overview.monthPacketsCreated.toLocaleString()}
          hint="keep the loop going"
        />
        <StatTile
          label="Projects"
          value={overview.projects.toLocaleString()}
          hint={projects.length > 0 ? "jump to list" : undefined}
          href={projects.length > 0 ? "#projects" : undefined}
        />
      </div>

      {/* The loop, made actionable: feed it, then pull from it. */}
      {recent ? (
        <section className="mb-10 rounded-2xl border bg-card p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-md">
              <h2 className="text-base font-semibold tracking-tight">
                The more you feed it, the more it gives back
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a file, note, or a good answer from any AI — then ask, and
                pull a Context Packet you can paste into ChatGPT, Claude, or
                Cursor.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button asChild variant="outline" className="rounded-full">
                <Link href={`/projects/${recent.id}`}>
                  <Upload className="size-4" />
                  Add to memory
                </Link>
              </Button>
              <Button asChild className="rounded-full">
                <Link href={`/projects/${recent.id}`}>
                  <Sparkles className="size-4" />
                  Ask your memory
                </Link>
              </Button>
            </div>
          </div>
        </section>
      ) : (
        <section className="mb-10 rounded-2xl border border-dashed bg-card p-8 text-center">
          <h2 className="text-base font-semibold tracking-tight">
            Start your memory
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create a project, drop in your files and notes, and Sev turns them
            into memory you can use with any AI.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateProjectDialog />
          </div>
        </section>
      )}

      {/* Projects — the top-level containers. A project's folders ("crew") live
          inside it, not flattened here, so this scales as projects grow. */}
      <section id="projects" className="scroll-mt-6">
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
                className="group relative rounded-xl border bg-card p-4 transition hover:bg-accent/50"
              >
                <Link
                  href={`/projects/${project.id}`}
                  className="block pr-8 font-medium"
                >
                  <span className="hover:underline">{project.title}</span>
                  <ArrowRight className="ml-1 inline size-3.5 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                </Link>
                {project.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                ) : null}
                <p className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    {project.sourceCount} source
                    {project.sourceCount === 1 ? "" : "s"}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <FolderClosed className="size-3.5" />
                    {project.folderCount} folder
                    {project.folderCount === 1 ? "" : "s"}
                  </span>
                </p>
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
