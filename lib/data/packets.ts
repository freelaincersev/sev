import { createClient } from "@/lib/supabase/server";

export type PacketListItem = {
  id: string;
  title: string;
  target_llm: string | null;
  created_at: string;
};

/** Lists a project's saved Context Packets (newest first). */
export async function listPackets(projectId: string): Promise<PacketListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("context_packets")
    .select("id, title, target_llm, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export type RecentPacket = {
  id: string;
  title: string;
  projectId: string;
  /** The copy-paste body, so the dashboard can re-copy without a round trip. */
  llmReadyPrompt: string;
  createdAt: string;
};

/**
 * Account-wide recent Context Packets (newest first), for the dashboard's
 * "reuse a packet" strip. RLS scopes this to the authenticated user.
 */
export async function listRecentPackets(limit = 6): Promise<RecentPacket[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("context_packets")
    .select("id, title, project_id, llm_ready_prompt, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    projectId: p.project_id,
    llmReadyPrompt: p.llm_ready_prompt ?? "",
    createdAt: p.created_at,
  }));
}
