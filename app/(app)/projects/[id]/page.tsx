import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getProject } from "@/lib/data/projects";

/** The three panels that make up the Sev project workspace (strategy §5.4). */
const PANELS = [
  {
    title: "Sources",
    description:
      "Add Markdown, TXT, PDF, URLs, or pasted text. Sev converts them into searchable memory.",
  },
  {
    title: "Ask",
    description:
      "Ask questions and get citation-first answers grounded in this project's memory.",
  },
  {
    title: "Context Packets",
    description:
      "Assemble AI-ready context and copy it into ChatGPT, Claude, or Cursor.",
  },
];

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        All projects
      </Link>

      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          {project.title}
        </h1>
        {project.description ? (
          <p className="mt-1 text-sm text-muted-foreground">
            {project.description}
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PANELS.map((panel) => (
          <Card key={panel.title}>
            <CardHeader>
              <CardTitle className="text-base">{panel.title}</CardTitle>
              <CardDescription>{panel.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <span className="text-xs font-medium text-muted-foreground">
                Coming next
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
