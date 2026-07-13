import { createClient } from "@/lib/supabase/server";

export type Folder = {
  id: string;
  user_id: string;
  project_id: string;
  name: string;
  parent_id: string | null;
  avatar_preset: string | null;
  color: string | null;
  created_at: string;
};

/** A folder plus its direct (non-recursive) source count. */
export type FolderWithCount = Folder & { source_count: number };

/**
 * Lists a project's folders (oldest first) with the number of sources filed
 * directly in each. RLS scopes this to the authenticated user.
 */
export async function listFolders(
  projectId: string,
): Promise<FolderWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("folders")
    .select("*, sources(count)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((f) => {
    const { sources, ...rest } = f as Folder & {
      sources: { count: number }[] | null;
    };
    return { ...rest, source_count: sources?.[0]?.count ?? 0 };
  });
}
