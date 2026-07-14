import { createClient } from "@/lib/supabase/server";

export type Source = {
  id: string;
  user_id: string;
  project_id: string;
  folder_id: string | null;
  type: string;
  title: string;
  status: string;
  storage_path: string | null;
  error_message: string | null;
  summary: string | null;
  summary_model: string | null;
  intent: string | null;
  created_at: string;
};

export type SourceWithCount = Source & { chunk_count: number };

/**
 * Lists a project's sources (newest first) with their chunk counts. When
 * `folderId` is given, only sources filed in that folder are returned.
 */
export async function listSources(
  projectId: string,
  folderId?: string,
): Promise<SourceWithCount[]> {
  const supabase = await createClient();
  let query = supabase
    .from("sources")
    .select("*, chunks(count)")
    .eq("project_id", projectId);
  if (folderId) query = query.eq("folder_id", folderId);
  const { data, error } = await query.order("created_at", {
    ascending: false,
  });
  if (error) throw error;

  return (data ?? []).map((s) => {
    const { chunks, ...rest } = s as Source & {
      chunks: { count: number }[] | null;
    };
    return { ...rest, chunk_count: chunks?.[0]?.count ?? 0 };
  });
}
