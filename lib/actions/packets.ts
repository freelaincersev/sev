"use server";

import { revalidatePath } from "next/cache";

import { buildPacket, type TargetLLM } from "@/lib/packets/assemble";
import { searchChunks } from "@/lib/retrieval/search";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

export type CreatePacketState = {
  ok?: boolean;
  error?: string;
  goal?: string;
  packet?: { id: string; title: string; llmReadyPrompt: string };
  sourceCount?: number;
};

/**
 * Build and save a Context Packet: retrieve the top-k relevant chunks for the
 * goal (M3), assemble a copy-paste-ready prompt (pure text, no LLM), persist to
 * context_packets + packet_sources, and log the North Star event
 * context_packet.created.
 */
export async function createPacket(
  _prev: CreatePacketState,
  formData: FormData,
): Promise<CreatePacketState> {
  const projectId = String(formData.get("project_id") ?? "");
  const goal = String(formData.get("goal") ?? "").trim();
  const targetLLM = (String(formData.get("target_llm") ?? "generic") ||
    "generic") as TargetLLM;
  // Optional: only include these sources (from the suggestion checklist). Empty
  // = include everything relevant (backward compatible).
  const rawIds = String(formData.get("source_ids") ?? "").trim();
  const selectedIds = rawIds
    ? new Set(rawIds.split(",").map((s) => s.trim()).filter(Boolean))
    : null;
  if (!projectId) return { error: "Missing project." };
  if (!goal) return { error: "Describe what you want the packet to help with." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", goal };

  const capError = await checkLimit(supabase, user.id, "create_packet");
  if (capError) return { error: capError, goal };

  try {
    const { chunks: allChunks, queryTokens } = await searchChunks(supabase, {
      projectId,
      query: goal,
    });
    const chunks = selectedIds
      ? allChunks.filter((c) => selectedIds.has(c.sourceId))
      : allChunks;
    if (chunks.length === 0) {
      return {
        error: selectedIds
          ? "Select at least one source to include."
          : "No matching memory found. Add sources or refine the goal.",
        goal,
      };
    }

    const { data: project, error: projErr } = await supabase
      .from("projects")
      .select("title")
      .eq("id", projectId)
      .single();
    if (projErr) throw projErr;

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
      tokens: queryTokens,
      metadata: { packet_id: packet.id, sources: chunks.length },
    });

    revalidatePath(`/projects/${projectId}`);
    return {
      ok: true,
      goal,
      packet: {
        id: packet.id,
        title: built.title,
        llmReadyPrompt: built.llmReadyPrompt,
      },
      sourceCount: chunks.length,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build packet.";
    return { error: msg, goal };
  }
}

export type SuggestedSource = {
  sourceId: string;
  sourceTitle: string;
  snippetCount: number;
};

export type SuggestState = {
  ok?: boolean;
  error?: string;
  goal?: string;
  suggestions?: SuggestedSource[];
};

/**
 * "Sev speaks first": for a goal, retrieve the relevant memory and return the
 * sources it would pull, grouped, so the user can confirm/adjust which context
 * to include before a packet is built. No packet is created or logged here.
 */
export async function suggestPacketContext(
  _prev: SuggestState,
  formData: FormData,
): Promise<SuggestState> {
  const projectId = String(formData.get("project_id") ?? "");
  const goal = String(formData.get("goal") ?? "").trim();
  if (!projectId) return { error: "Missing project." };
  if (!goal) return { error: "Describe what you're building context for." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", goal };

  try {
    const { chunks } = await searchChunks(supabase, { projectId, query: goal });
    const bySource = new Map<string, SuggestedSource>();
    for (const c of chunks) {
      const cur = bySource.get(c.sourceId);
      if (cur) cur.snippetCount += 1;
      else
        bySource.set(c.sourceId, {
          sourceId: c.sourceId,
          sourceTitle: c.sourceTitle,
          snippetCount: 1,
        });
    }
    return { ok: true, goal, suggestions: [...bySource.values()] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to find context.";
    return { error: msg, goal };
  }
}

/** Log a copy-to-external-LLM event (supporting metric context_packet.copied). */
export async function logPacketCopied(formData: FormData): Promise<void> {
  const packetId = String(formData.get("packet_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  const provider = String(formData.get("provider") ?? "generic");
  if (!packetId) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from("usage_events").insert({
    user_id: user.id,
    project_id: projectId || null,
    event_type: "context_packet.copied",
    metadata: { packet_id: packetId, provider },
  });
}
