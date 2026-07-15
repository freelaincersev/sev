import { AddSourceDialog } from "@/components/add-source-dialog";
import { FeedMeEmpty } from "@/components/feed-me-empty";
import { SourceItem } from "@/components/source-item";
import { SourceUploader } from "@/components/source-uploader";
import type { SourceWithCount } from "@/lib/data/sources";

export function SourcesPanel({
  projectId,
  sources,
  folders,
  folderId,
  folderName,
  folderAvatarPreset,
}: {
  projectId: string;
  sources: SourceWithCount[];
  folders: { id: string; name: string }[];
  folderId?: string;
  folderName?: string;
  folderAvatarPreset?: string | null;
}) {
  const count =
    sources.length === 1 ? "1 source" : `${sources.length} sources`;
  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Sources</h2>
          <p className="text-xs text-muted-foreground">
            {folderName ? `${count} in “${folderName}”` : `${count} in memory`}
          </p>
        </div>
        <AddSourceDialog projectId={projectId} folderId={folderId} />
      </header>

      <SourceUploader projectId={projectId} folderId={folderId}>
        {sources.length === 0 ? (
          <FeedMeEmpty
            projectId={projectId}
            folderId={folderId}
            folderName={folderName}
            avatarPreset={folderAvatarPreset}
          />
        ) : (
          <ul className="divide-y">
            {sources.map((s) => (
              <SourceItem
                key={s.id}
                source={s}
                projectId={projectId}
                folders={folders}
              />
            ))}
          </ul>
        )}
      </SourceUploader>
    </section>
  );
}
