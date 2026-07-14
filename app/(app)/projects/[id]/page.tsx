import { AskPanel } from "@/components/ask-panel";
import { DataUsagePanel } from "@/components/data-usage-panel";
import { SourcesPanel } from "@/components/sources-panel";
import { WorkspaceTabs } from "@/components/workspace-tabs";
import { listFolders } from "@/lib/data/folders";
import { listPackets } from "@/lib/data/packets";
import { listSources } from "@/lib/data/sources";
import { getProjectSummary } from "@/lib/data/usage";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ folder?: string }>;
}) {
  const { id } = await params;
  const { folder } = await searchParams;
  const folderId = folder || undefined;

  const [sources, packets, summary, folders] = await Promise.all([
    listSources(id, folderId),
    listPackets(id),
    getProjectSummary(id),
    listFolders(id),
  ]);
  const activeFolder = folderId
    ? folders.find((f) => f.id === folderId)
    : undefined;
  const folderName = activeFolder?.name;

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Main: keep the workspace focused on asking. */}
        <main className="min-w-0">
          <AskPanel projectId={id} />
        </main>

        {/* Right rail: sources and data/usage tucked into tabs. Packets are
            created via the Export action on each Ask answer, not a tab. */}
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <WorkspaceTabs
            focusKey="sources"
            focusToken={folderId}
            tabs={[
              {
                key: "sources",
                label: "Sources",
                content: (
                  <SourcesPanel
                    projectId={id}
                    sources={sources}
                    folderId={folderId}
                    folderName={folderName}
                    folderAvatarPreset={activeFolder?.avatar_preset}
                  />
                ),
              },
              {
                key: "usage",
                label: "Data & Usage",
                content: (
                  <DataUsagePanel
                    projectId={id}
                    summary={summary}
                    packets={packets}
                  />
                ),
              },
            ]}
          />
        </aside>
      </div>
    </div>
  );
}
