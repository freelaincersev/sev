import { createClient } from "@/lib/supabase/server";

export type Source = {
  id: string;
  user_id: string;
  project_id: string;
  type: string;
  title: string;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type SourceWithCount = Source & { chunk_count: number };

/** Lists a project's sources (newest first) with their chunk counts. */
export async function listSources(
  projectId: string,
): Promise<SourceWithCount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sources")
    .select("*, chunks(count)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((s) => {
    const { chunks, ...rest } = s as Source & {
      chunks: { count: number }[] | null;
    };
    return { ...rest, chunk_count: chunks?.[0]?.count ?? 0 };
  });
}
