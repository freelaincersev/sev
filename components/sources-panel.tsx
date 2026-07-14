import { Download, Trash2 } from "lucide-react";

import { AddSourceDialog } from "@/components/add-source-dialog";
import { FeedMeEmpty } from "@/components/feed-me-empty";
import { SourceSummaryDialog } from "@/components/source-summary-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { deleteSource } from "@/lib/actions/sources";
import type { SourceWithCount } from "@/lib/data/sources";

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "ready"
      ? "default"
      : status === "error"
        ? "destructive"
        : "secondary";
  return <Badge variant={variant}>{status}</Badge>;
}

export function SourcesPanel({
  projectId,
  sources,
  folderId,
  folderName,
  folderAvatarPreset,
}: {
  projectId: string;
  sources: SourceWithCount[];
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
            <li key={s.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <SourceSummaryDialog source={s} projectId={projectId} />
                  <StatusBadge status={s.status} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.type.replace("_", " ")} · {s.chunk_count} chunk
                  {s.chunk_count === 1 ? "" : "s"}
                  {s.status === "error" && s.error_message
                    ? ` · ${s.error_message}`
                    : ""}
                </p>
              </div>
              {s.storage_path ? (
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  aria-label={`Download original of ${s.title}`}
                >
                  <a
                    href={`/projects/${projectId}/sources/${s.id}/original`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Download className="size-4" />
                  </a>
                </Button>
              ) : null}
              <form action={deleteSource}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="project_id" value={projectId} />
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon"
                  aria-label="Delete source"
                >
                  <Trash2 className="size-4" />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
