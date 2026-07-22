"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { embedTexts, EMBEDDING_MODEL, toVectorLiteral } from "@/lib/ingest/embed";
import { extractDecisions } from "@/lib/extract/decisions";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 400_000; // transcripts run long; extraction segments internally
const STORAGE_BUCKET = "sources";

export type AddConversationState = {
  ok?: boolean;
  error?: string;
  /** How many decision drafts were created — shown in the success toast. */
  count?: number;
  title?: string;
};

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/**
 * MVP capture path: paste (or upload) an AI conversation transcript. The
 * original is archived as a `conversation` source, decisions are extracted and
 * stored as unverified drafts.
 *
 * Deliberately NOT run through the chunk/embed pipeline: raw chat transcripts
 * are mostly noise and would pollute Ask retrieval (the curation-signal
 * principle). What gets embedded is each extracted decision itself.
 */
export async function addConversation(
  _prev: AddConversationState,
  formData: FormData,
): Promise<AddConversationState> {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };
  const origin = String(formData.get("origin") ?? "").trim() || null;

  let content = "";
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    content = new TextDecoder().decode(new Uint8Array(await file.arrayBuffer()));
  } else {
    content = String(formData.get("content") ?? "");
  }
  content = content.replace(/\r\n?/g, "\n").trim();
  if (!content) return { error: "Paste a conversation or choose a file." };
  if (content.length > MAX_CHARS)
    return { error: `Conversation is too large (${content.length} chars, max ${MAX_CHARS}).` };

  let title = String(formData.get("title") ?? "").trim();
  if (!title) {
    const firstLine = content.split("\n").map((l) => l.trim()).find(Boolean) ?? "Conversation";
    title = firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Extraction is generation-heavy AND adds a source — gate on both caps.
  const capError =
    (await checkLimit(supabase, user.id, "add_source")) ??
    (await checkLimit(supabase, user.id, "ask"));
  if (capError) return { error: capError };

  // 1) Source row first (observable progress + id for the storage path).
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      project_id: projectId,
      type: "conversation",
      title,
      origin,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (srcErr) return { error: srcErr.message };

  // 2) Archive the verbatim transcript (same path scheme as every source).
  const storagePath = `${user.id}/${projectId}/${source.id}/conversation.md`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, new Blob([content], { type: "text/markdown; charset=utf-8" }), {
      contentType: "text/markdown; charset=utf-8",
      upsert: true,
    });
  if (upErr) {
    await supabase
      .from("sources")
      .update({ status: "error", error_message: "Storage upload failed." })
      .eq("id", source.id);
    revalidatePath(`/projects/${projectId}`);
    return { error: "Could not store the conversation. Please try again." };
  }
  await supabase
    .from("sources")
    .update({ storage_path: storagePath, status: "processing" })
    .eq("id", source.id);

  // 3) Extract → embed each decision → insert drafts.
  try {
    const result = await extractDecisions(content);

    if (result.decisions.length > 0) {
      const vectors = await embedTexts(
        result.decisions.map((d) =>
          d.rationale ? `${d.decision}\n${d.rationale}` : d.decision,
        ),
      );

      const { error: insErr } = await supabase.from("decisions").insert(
        result.decisions.map((d, i) => ({
          user_id: user.id,
          project_id: projectId,
          source_id: source.id,
          decision: d.decision,
          rationale: d.rationale,
          alternatives: d.alternatives,
          evidence: d.evidence,
          conditions: d.conditions,
          decided_at: d.decidedAt,
          importance: d.importance,
          embedding: toVectorLiteral(vectors[i]),
        })),
      );
      if (insErr) throw insErr;
    }

    // North-Star instrumentation: extraction volume + guard drops.
    await supabase.from("usage_events").insert({
      user_id: user.id,
      project_id: projectId,
      event_type: "decision.extracted",
      tokens: result.tokensIn + result.tokensOut,
      metadata: {
        source_id: source.id,
        model: result.model,
        embedding_model: EMBEDDING_MODEL,
        count: result.decisions.length,
        dropped_no_evidence: result.droppedNoEvidence,
      },
    });

    await supabase
      .from("sources")
      .update({ status: "ready", content_hash: sha256(content) })
      .eq("id", source.id);

    revalidatePath(`/projects/${projectId}`);
    return { ok: true, count: result.decisions.length, title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed.";
    await supabase
      .from("sources")
      .update({ status: "error", error_message: msg.slice(0, 500) })
      .eq("id", source.id);
    revalidatePath(`/projects/${projectId}`);
    return { error: msg };
  }
}

export type DecisionActionState = { ok?: boolean; error?: string };

/** Approve a draft: it becomes part of the project's verified knowledge. */
export async function verifyDecision(
  formData: FormData,
): Promise<DecisionActionState> {
  const id = String(formData.get("decision_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return { error: "Missing decision." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("decisions")
    .update({ verification: "verified", verified_at: new Date().toISOString() })
    .eq("id", id); // RLS scopes to owner
  if (error) return { error: error.message };

  await supabase.from("usage_events").insert({
    user_id: user.id,
    project_id: projectId,
    event_type: "decision.verified",
    metadata: { decision_id: id },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/** Reject a draft (false positive): drafts are disposable, so hard-delete. */
export async function rejectDecision(
  formData: FormData,
): Promise<DecisionActionState> {
  const id = String(formData.get("decision_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return { error: "Missing decision." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.from("decisions").delete().eq("id", id);
  if (error) return { error: error.message };

  await supabase.from("usage_events").insert({
    user_id: user.id,
    project_id: projectId,
    event_type: "decision.rejected",
    metadata: { decision_id: id },
  });

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

/**
 * Mark `supersededId` as replaced by `decisionId` (decision evolution).
 * No automatic merging — this is always a human call.
 */
export async function supersedeDecision(
  formData: FormData,
): Promise<DecisionActionState> {
  const decisionId = String(formData.get("decision_id") ?? "");
  const supersededId = String(formData.get("superseded_id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!decisionId || !supersededId || decisionId === supersededId)
    return { error: "Pick two different decisions." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error: e1 } = await supabase
    .from("decisions")
    .update({ supersedes: supersededId })
    .eq("id", decisionId);
  if (e1) return { error: e1.message };

  const { error: e2 } = await supabase
    .from("decisions")
    .update({ status: "superseded" })
    .eq("id", supersededId);
  if (e2) return { error: e2.message };

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}
