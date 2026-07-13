import { createClient } from "@/lib/supabase/server";

export type ProjectSummary = {
  sources: number;
  chunks: number;
  packets: number;
  monthTokens: number;
  monthEvents: {
    embedding: number;
    retrieval: number;
    generation: number;
    packetsCreated: number;
    packetsCopied: number;
  };
};

/** UTC start of the current calendar month, ISO string. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

/**
 * Stored-data counts + this month's usage for a project's Data & Usage panel
 * (strategy §12.9). Scoped to the authenticated user via RLS.
 */
export async function getProjectSummary(
  projectId: string,
): Promise<ProjectSummary> {
  const supabase = await createClient();
  const since = monthStartISO();

  const [sources, chunks, packets, events] = await Promise.all([
    supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("chunks")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("context_packets")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
    supabase
      .from("usage_events")
      .select("event_type, tokens")
      .eq("project_id", projectId)
      .gte("created_at", since),
  ]);

  const monthEvents = {
    embedding: 0,
    retrieval: 0,
    generation: 0,
    packetsCreated: 0,
    packetsCopied: 0,
  };
  let monthTokens = 0;
  for (const e of events.data ?? []) {
    monthTokens += e.tokens ?? 0;
    if (e.event_type === "embedding") monthEvents.embedding += 1;
    else if (e.event_type === "retrieval") monthEvents.retrieval += 1;
    else if (e.event_type === "generation") monthEvents.generation += 1;
    else if (e.event_type === "context_packet.created") monthEvents.packetsCreated += 1;
    else if (e.event_type === "context_packet.copied") monthEvents.packetsCopied += 1;
  }

  return {
    sources: sources.count ?? 0,
    chunks: chunks.count ?? 0,
    packets: packets.count ?? 0,
    monthTokens,
    monthEvents,
  };
}
