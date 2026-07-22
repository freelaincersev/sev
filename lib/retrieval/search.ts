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
  opts: {
    projectId: string;
    query: string;
    k?: number;
    folderId?: string;
    /** Precomputed embedding of `query` — pass when the caller also searches decisions. */
    queryVector?: number[];
  },
): Promise<SearchResult> {
  const { projectId, query, k = TOP_K, folderId } = opts;

  const queryVector = opts.queryVector ?? (await embedTexts([query]))[0];

  const { data: matches, error: matchErr } = await supabase.rpc("match_chunks", {
    query_embedding: toVectorLiteral(queryVector),
    match_count: k,
    p_project_id: projectId,
    // When a folder is selected, answer using ONLY that folder's sources.
    p_folder_id: folderId ?? undefined,
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

/** How many decision records to retrieve per query, and the relevance floor —
 * decisions are few and high-signal, so a floor keeps unrelated questions from
 * dragging them in just because top-k always returns something. */
export const DECISIONS_K = 4;
const DECISION_SIM_FLOOR = 0.3;

export type RetrievedDecision = {
  id: string;
  decision: string;
  rationale: string | null;
  alternatives: { option: string; rejection_reason: string | null }[];
  evidence: { quote: string }[];
  conditions: string | null;
  decidedAt: string | null;
  status: string;
  verification: string;
  similarity: number;
};

/**
 * Retrieve the project's most relevant Decision Records for a query.
 * Same isolation invariant as searchChunks (security invoker RPC + auth.uid()).
 * Own records may be served unverified — the caller labels them (주입 정책).
 */
export async function searchDecisions(
  supabase: ServerClient,
  opts: { projectId: string; queryVector: number[]; k?: number },
): Promise<RetrievedDecision[]> {
  const { data, error } = await supabase.rpc("match_decisions", {
    query_embedding: toVectorLiteral(opts.queryVector),
    match_count: opts.k ?? DECISIONS_K,
    p_project_id: opts.projectId,
  });
  if (error) throw error;

  return (data ?? [])
    .filter((r) => r.similarity >= DECISION_SIM_FLOOR)
    .map((r) => ({
      id: r.id,
      decision: r.decision,
      rationale: r.rationale,
      alternatives: (r.alternatives ?? []) as RetrievedDecision["alternatives"],
      evidence: (r.evidence ?? []) as RetrievedDecision["evidence"],
      conditions: r.conditions,
      decidedAt: r.decided_at,
      status: r.status,
      verification: r.verification,
      similarity: r.similarity,
    }));
}
