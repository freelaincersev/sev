import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AskPanel } from "@/components/ask-panel";
import { DataUsagePanel } from "@/components/data-usage-panel";
import { PacketPanel } from "@/components/packet-panel";
import { SourcesPanel } from "@/components/sources-panel";
import { getProject } from "@/lib/data/projects";
import { listPackets } from "@/lib/data/packets";
import { listSources } from "@/lib/data/sources";
import { getProjectSummary } from "@/lib/data/usage";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [sources, packets, summary] = await Promise.all([
    listSources(id),
    listPackets(id),
    getProjectSummary(id),
  ]);

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

      <SourcesPanel projectId={id} sources={sources} />

      <div className="mt-4">
        <AskPanel projectId={id} />
      </div>

      <div className="mt-4">
        <PacketPanel projectId={id} packets={packets} />
      </div>

      <div className="mt-4">
        <DataUsagePanel projectId={id} summary={summary} />
      </div>
    </div>
  );
}
