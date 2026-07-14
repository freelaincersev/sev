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
  searchParams: Promise<{ folder?: string; tab?: string; q?: string }>;
}) {
  const { id } = await params;
  const { folder, tab, q } = await searchParams;
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
    <div className="flex min-h-dvh w-full min-w-0 flex-col lg:h-dvh lg:min-h-0 lg:flex-row">
      {/* Main: keep the workspace focused on asking. */}
      <main className="flex min-w-0 flex-1 flex-col lg:overflow-hidden">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 lg:px-6">
          <AskPanel
            projectId={id}
            folderId={folderId}
            folderName={folderName}
            initialQuery={q}
          />
        </div>
      </main>

      {/* Right rail: a tinted, full-height panel mirroring the left sidebar —
          sources and data/usage tucked into tabs. Packets are created via the
          Export action on each Ask answer, not a tab. */}
      <aside className="shrink-0 border-t bg-muted/30 lg:flex lg:w-[380px] lg:flex-col lg:overflow-hidden lg:border-l lg:border-t-0">
        <WorkspaceTabs
          focusKey="sources"
          focusToken={folderId}
          defaultKey={tab === "usage" ? "usage" : undefined}
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
  );
}
