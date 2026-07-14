import "server-only";

import { createClient } from "@/lib/supabase/server";

export type RelatedSource = {
  sourceId: string;
  sourceTitle: string;
  projectId: string;
  projectTitle: string;
  intent: string | null;
  origin: string | null;
  similarity: number;
};

export type RelatedProject = {
  projectId: string;
  projectTitle: string;
  /** Highest source similarity — used to rank and to pick the qualitative label. */
  topSimilarity: number;
  sources: RelatedSource[];
};

/**
 * Below this cosine similarity (source centroid vs the current project's
 * centroid) a past source isn't "related" enough to suggest. Tuned against real
 * data (test account, 2026-07-15): genuinely reusable domain sources clustered
 * at 0.55–0.90, while unrelated/junk sources sat ≤0.48, leaving a clean gap
 * around 0.5. Conservative on purpose — better to stay quiet than cry wolf. The
 * UI shows a qualitative label ("related"), never this raw number (GEO trust).
 */
export const REUSE_MIN_SIMILARITY = 0.5;

/**
 * At/above this we say "closely related" instead of just "related". Set from the
 * same data: 0.7+ means heavy overlap (e.g. two Sev projects at ~0.8), whereas
 * a smaller/looser project relates in the 0.5–0.7 band.
 */
export const REUSE_STRONG_SIMILARITY = 0.7;

/** Cap how many past projects / sources we surface so the card stays scannable. */
const MAX_PROJECTS = 4;
const MAX_SOURCES_PER_PROJECT = 6;

/**
 * Cross-project reuse (#3): find past projects whose sources are similar to the
 * current project's memory, grouped into a per-project suggestion. Backed by the
 * `related_sources` RPC (security invoker + auth.uid filter, current project
 * excluded) — personal-only, so this can only ever surface the user's own work.
 */
export async function getRelatedProjects(
  projectId: string,
): Promise<RelatedProject[]> {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("related_sources", {
    p_project_id: projectId,
    match_count: 30,
  });
  if (error) throw error;

  const byProject = new Map<string, RelatedProject>();
  for (const r of data ?? []) {
    if (r.similarity < REUSE_MIN_SIMILARITY) continue;
    const src: RelatedSource = {
      sourceId: r.source_id,
      sourceTitle: r.source_title,
      projectId: r.source_project_id,
      projectTitle: r.project_title,
      intent: r.intent,
      origin: r.origin,
      similarity: r.similarity,
    };
    const existing = byProject.get(src.projectId);
    if (existing) {
      existing.sources.push(src);
      existing.topSimilarity = Math.max(existing.topSimilarity, src.similarity);
    } else {
      byProject.set(src.projectId, {
        projectId: src.projectId,
        projectTitle: src.projectTitle,
        topSimilarity: src.similarity,
        sources: [src],
      });
    }
  }

  return [...byProject.values()]
    .sort((a, b) => b.topSimilarity - a.topSimilarity)
    .slice(0, MAX_PROJECTS)
    .map((p) => ({
      ...p,
      sources: p.sources
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, MAX_SOURCES_PER_PROJECT),
    }));
}
