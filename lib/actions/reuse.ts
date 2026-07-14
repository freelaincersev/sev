"use server";

import { revalidatePath } from "next/cache";

import { buildPacket, type TargetLLM } from "@/lib/packets/assemble";
import type { RetrievedChunk } from "@/lib/retrieval/search";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

export type ReusePacketState = {
  ok?: boolean;
  error?: string;
  packet?: { id: string; title: string; llmReadyPrompt: string };
  sourceCount?: number;
  snippetCount?: number;
};

/** Keep a reuse packet scannable: bound chunks per source and overall. */
const MAX_CHUNKS_PER_SOURCE = 6;
const MAX_TOTAL_CHUNKS = 24;

/**
 * Cross-project reuse (#3): assemble a Context Packet from sources the user
 * picked out of ANOTHER project (surfaced by related_sources). Unlike
 * createPacket, retrieval isn't project-scoped — we pull the chosen sources'
 * chunks directly (owner RLS still applies) and assemble with the same pure-text
 * buildPacket. The packet is saved to the CURRENT project; packet_sources keep
 * pointing at the original source/chunk ids, so provenance is preserved.
 */
export async function createReusePacket(
  _prev: ReusePacketState,
  formData: FormData,
): Promise<ReusePacketState> {
  const projectId = String(formData.get("project_id") ?? "");
  const goalInput = String(formData.get("goal") ?? "").trim();
  const targetLLM = (String(formData.get("target_llm") ?? "generic") ||
    "generic") as TargetLLM;
  const rawIds = String(formData.get("source_ids") ?? "").trim();
  const selectedIds = rawIds
    ? [...new Set(rawIds.split(",").map((s) => s.trim()).filter(Boolean))]
    : [];

  if (!projectId) return { error: "Missing project." };
  if (selectedIds.length === 0)
    return { error: "Select at least one source to reuse." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const capError = await checkLimit(supabase, user.id, "create_packet");
  if (capError) return { error: capError };

  try {
    // Titles for the selected (cross-project) sources — owner RLS scopes this.
    const { data: sourceRows, error: srcErr } = await supabase
      .from("sources")
      .select("id, title")
      .in("id", selectedIds);
    if (srcErr) throw srcErr;
    const titleById = new Map((sourceRows ?? []).map((s) => [s.id, s.title]));

    // Pull the chosen sources' chunks directly (not project-scoped). Ordered so
    // the per-source cap keeps each source's opening chunks.
    const { data: chunkRows, error: chunkErr } = await supabase
      .from("chunks")
      .select("id, source_id, content, heading_path, page, chunk_index")
      .in("source_id", selectedIds)
      .order("source_id", { ascending: true })
      .order("chunk_index", { ascending: true });
    if (chunkErr) throw chunkErr;

    const perSource = new Map<string, number>();
    const chunks: RetrievedChunk[] = [];
    for (const row of chunkRows ?? []) {
      if (chunks.length >= MAX_TOTAL_CHUNKS) break;
      const used = perSource.get(row.source_id) ?? 0;
      if (used >= MAX_CHUNKS_PER_SOURCE) continue;
      perSource.set(row.source_id, used + 1);
      chunks.push({
        chunkId: row.id,
        sourceId: row.source_id,
        sourceTitle: titleById.get(row.source_id) ?? "Untitled source",
        content: row.content,
        headingPath: row.heading_path,
        page: row.page,
        similarity: 1,
      });
    }

    if (chunks.length === 0)
      return { error: "The selected sources have no reusable content yet." };

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .single();
    if (projErr) throw projErr;

    const goal =
      goalInput ||
      `Reuse context from my earlier work in the "${project.title}" project.`;

    const built = buildPacket({
      goal,
      projectTitle: project.title,
      chunks,
      targetLLM,
    });

    const { data: packet, error: packetErr } = await supabase
      .from("context_packets")
      .insert({
        user_id: user.id,
        project_id: projectId,
        title: built.title,
        goal: built.goal,
        target_llm: built.targetLLM,
        key_context: built.keyContext,
        llm_ready_prompt: built.llmReadyPrompt,
        content: built.content,
      })
      .select("id")
      .single();
    if (packetErr) throw packetErr;

    const { error: sourcesErr } = await supabase.from("packet_sources").insert(
      chunks.map((c) => ({
        packet_id: packet.id,
        chunk_id: c.chunkId,
        source_id: c.sourceId,
        user_id: user.id,
      })),
    );
    if (sourcesErr) throw sourcesErr;

    await supabase.from("usage_events").insert({
      user_id: user.id,
      project_id: projectId,
      event_type: "context_packet.created",
      tokens: 0,
      metadata: {
        packet_id: packet.id,
        sources: chunks.length,
        reuse: true,
        reused_source_ids: selectedIds,
      },
    });

    revalidatePath(`/projects/${projectId}`);
    return {
      ok: true,
      packet: {
        id: packet.id,
        title: built.title,
        llmReadyPrompt: built.llmReadyPrompt,
      },
      sourceCount: perSource.size,
      snippetCount: chunks.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build the packet.";
    return { error: msg };
  }
}
