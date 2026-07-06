import Link from "next/link";
import { Trash2 } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { deleteProject } from "@/lib/actions/projects";
import { listProjects } from "@/lib/data/projects";

export default async function DashboardPage() {
  const projects = await listProjects();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Each project is a separate, isolated memory.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {projects.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No projects yet</CardTitle>
            <CardDescription>
              Create your first project to start building AI-ready memory.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {projects.map((project) => (
            <Card key={project.id} className="group relative">
              <CardHeader>
                <CardTitle className="pr-8">
                  <Link
                    href={`/projects/${project.id}`}
                    className="hover:underline"
                  >
                    {project.title}
                  </Link>
                </CardTitle>
                {project.description ? (
                  <CardDescription>{project.description}</CardDescription>
                ) : null}
              </CardHeader>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
