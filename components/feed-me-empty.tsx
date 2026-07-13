import { AddSourceDialog } from "@/components/add-source-dialog";
import { Mascot, resolveMascotPersona } from "@/components/mascot";

/**
 * Empty-state call to action: turns an empty project (or empty folder) into an
 * invitation to add the first source. Only rendered when the current view has
 * zero sources, so the "hungry" framing always reflects the real count. The
 * character is picked deterministically from the folder/project id, so each
 * folder keeps its own C-suite mascot.
 */
export function FeedMeEmpty({
  projectId,
  folderId,
  folderName,
  avatarPreset,
}: {
  projectId: string;
  folderId?: string;
  folderName?: string;
  avatarPreset?: string | null;
}) {
  const persona = resolveMascotPersona(avatarPreset, folderId ?? projectId);
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-12 text-center">
      <Mascot persona={persona} mood="hungry" />
      <div className="space-y-1">
        <p className="text-sm font-medium">
          {folderName ? `‘${folderName}’ 폴더가 배고파요.` : "아직 배고파요."}
        </p>
        <p className="text-sm text-muted-foreground">
          {folderName ? "여기에 첫 자료를 주세요!" : "첫 자료를 주세요!"}
        </p>
      </div>
      <AddSourceDialog projectId={projectId} folderId={folderId} />
    </div>
  );
}
