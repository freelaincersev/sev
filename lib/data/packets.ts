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
