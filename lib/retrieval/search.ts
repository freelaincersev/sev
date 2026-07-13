import "server-only";

import { embedTexts, toVectorLiteral } from "@/lib/ingest/embed";
import { estimateTokens } from "@/lib/ingest/chunk";
import type { createClient } from "@/lib/supabase/server";

/** How many chunks to retrieve per query (matches the RPC default). */
export const TOP_K = 8;

type ServerClient = Awaited<ReturnType<typeof createClient>>;

export type RetrievedChunk = {
  chunkId: string;
  sourceId: string;
  sourceTitle: string;
  content: string;
  headingPath: string | null;
  page: number | null;
  similarity: number;
};

export type SearchResult = {
  chunks: RetrievedChunk[];
  queryTokens: number;
};

/**
 * Retrieve the most relevant chunks for a query, scoped to one project.
 * Embeds the query, then goes through the match_chunks RPC (security invoker +
 * auth.uid() filter) so cross-user/project retrieval is impossible. Resolves
 * source titles for citation. The caller supplies an authed server client.
 */
export async function searchChunks(
  supabase: ServerClient,
  opts: { projectId: string; query: string; k?: number },
): Promise<SearchResult> {
  const { projectId, query, k = TOP_K } = opts;

  const [queryVector] = await embedTexts([query]);

  const { data: matches, error: matchErr } = await supabase.rpc("match_chunks", {
    query_embedding: toVectorLiteral(queryVector),
    match_count: k,
    p_project_id: projectId,
  });
  if (matchErr) throw matchErr;

  const rows = matches ?? [];

  // Resolve source titles for citation in one scoped query.
  const sourceIds = [...new Set(rows.map((r) => r.source_id))];
  const titleById = new Map<string, string>();
  if (sourceIds.length > 0) {
    const { data: sources, error: srcErr } = await supabase
      .from("sources")
      .select("id, title")
      .in("id", sourceIds);
    if (srcErr) throw srcErr;
    for (const s of sources ?? []) titleById.set(s.id, s.title);
  }

  const chunks: RetrievedChunk[] = rows.map((r) => ({
    chunkId: r.chunk_id,
    sourceId: r.source_id,
    sourceTitle: titleById.get(r.source_id) ?? "Untitled source",
    content: r.content,
    headingPath: r.heading_path,
    page: r.page,
    similarity: r.similarity,
  }));

  return { chunks, queryTokens: estimateTokens(query) };
}
