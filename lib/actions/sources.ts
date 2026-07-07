"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { chunkMarkdown } from "@/lib/ingest/chunk";
import { embedTexts, EMBEDDING_MODEL, toVectorLiteral } from "@/lib/ingest/embed";
import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 200_000;

export type AddSourceState = { error?: string; ok?: boolean };

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export async function addSource(
  _prev: AddSourceState,
  formData: FormData,
): Promise<AddSourceState> {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };

  // Content comes either from an uploaded .md/.txt file or pasted text.
  let content = "";
  let type = "paste";
  let title = String(formData.get("title") ?? "").trim();

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    content = await file.text();
    type = /\.md$/i.test(file.name) ? "markdown" : "txt";
    if (!title) title = file.name.replace(/\.(md|txt)$/i, "");
  } else {
    content = String(formData.get("content") ?? "");
    type = "paste";
  }

  content = content.replace(/\r\n?/g, "\n").trim();
  if (!content) return { error: "Nothing to add — paste text or choose a file." };
  if (content.length > MAX_CHARS)
    return {
      error: `Source is too large (${content.length} chars, max ${MAX_CHARS}).`,
    };
  if (!title) title = "Untitled";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Create the source row up front so its status is observable.
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      project_id: projectId,
      type,
      title,
      status: "processing",
    })
    .select("id")
    .single();
  if (srcErr) return { error: srcErr.message };

  try {
    const chunks = chunkMarkdown(content);
    if (chunks.length === 0) throw new Error("No indexable content found.");

    const vectors = await embedTexts(chunks.map((c) => c.content));

    const { data: insertedChunks, error: chunkErr } = await supabase
      .from("chunks")
      .insert(
        chunks.map((c) => ({
          user_id: user.id,
          project_id: projectId,
          source_id: source.id,
          content: c.content,
          heading_path: c.headingPath,
          chunk_index: c.chunkIndex,
          token_count: c.tokenCount,
          content_hash: sha256(c.content),
        })),
      )
      .select("id, chunk_index");
    if (chunkErr) throw chunkErr;

    const idByIndex = new Map(
      insertedChunks.map((r) => [r.chunk_index, r.id]),
    );
    const { error: embErr } = await supabase.from("embeddings").insert(
      chunks.map((c, i) => ({
        user_id: user.id,
        project_id: projectId,
        chunk_id: idByIndex.get(c.chunkIndex)!,
        embedding: toVectorLiteral(vectors[i]),
        model: EMBEDDING_MODEL,
      })),
    );
    if (embErr) throw embErr;

    const totalTokens = chunks.reduce((a, c) => a + c.tokenCount, 0);
    await supabase.from("usage_events").insert({
      user_id: user.id,
      project_id: projectId,
      event_type: "embedding",
      tokens: totalTokens,
      metadata: { source_id: source.id, model: EMBEDDING_MODEL, chunks: chunks.length },
    });

    await supabase
      .from("sources")
      .update({ status: "ready", content_hash: sha256(content) })
      .eq("id", source.id);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ingestion failed.";
    await supabase
      .from("sources")
      .update({ status: "error", error_message: msg.slice(0, 500) })
      .eq("id", source.id);
    revalidatePath(`/projects/${projectId}`);
    return { error: msg };
  }

  revalidatePath(`/projects/${projectId}`);
  return { ok: true };
}

export async function deleteSource(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // chunks + embeddings cascade via ON DELETE CASCADE.
  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/projects/${projectId}`);
}
