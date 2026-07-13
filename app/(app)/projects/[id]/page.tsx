import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { AskPanel } from "@/components/ask-panel";
import { DataUsagePanel } from "@/components/data-usage-panel";
import { PacketPanel } from "@/components/packet-panel";
import { SourcesPanel } from "@/components/sources-panel";
import { WorkspaceTabs } from "@/components/workspace-tabs";
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
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
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

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Main: keep the workspace focused on asking. */}
        <main className="min-w-0">
          <AskPanel projectId={id} />
        </main>

        {/* Right rail: sources, packets, and data/usage tucked into tabs. */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <WorkspaceTabs
            tabs={[
              {
                key: "sources",
                label: "Sources",
                content: <SourcesPanel projectId={id} sources={sources} />,
              },
              {
                key: "packets",
                label: "Packets",
                content: <PacketPanel projectId={id} packets={packets} />,
              },
              {
                key: "usage",
                label: "Data & Usage",
                content: <DataUsagePanel projectId={id} summary={summary} />,
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
