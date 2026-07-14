"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";

import { chunkMarkdown } from "@/lib/ingest/chunk";
import { embedTexts, EMBEDDING_MODEL, toVectorLiteral } from "@/lib/ingest/embed";
import { fetchUrlAsText } from "@/lib/ingest/fetch-url";
import { extractPdfText } from "@/lib/ingest/pdf";
import { generateSummary } from "@/lib/retrieval/summarize";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

const MAX_CHARS = 200_000;
const STORAGE_BUCKET = "sources";

export type AddSourceState = { error?: string; ok?: boolean; title?: string };

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

/** Keep only safe characters in the object name; never let it escape its dir. */
function sanitizeFilename(name: string): string {
  const base = name.split("/").pop()?.split("\\").pop() ?? "";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").replace(/_{2,}/g, "_");
  return cleaned.replace(/^_+/, "") || "file";
}

export async function addSource(
  _prev: AddSourceState,
  formData: FormData,
): Promise<AddSourceState> {
  const projectId = String(formData.get("project_id") ?? "");
  if (!projectId) return { error: "Missing project." };
  const folderId = String(formData.get("folder_id") ?? "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const capError = await checkLimit(supabase, user.id, "add_source");
  if (capError) return { error: capError };

  // Resolve the extractable text AND the original bytes we archive verbatim.
  // Content comes from a URL, an uploaded .md/.txt/.pdf file, or pasted text.
  let content = "";
  let type = "paste";
  let title = String(formData.get("title") ?? "").trim();
  let sourceUrl: string | null = null;
  // The verbatim original we archive to the private bucket (a Blob so binary
  // uploads like PDF keep their exact bytes).
  let originalBlob: Blob;
  let originalFilename: string;
  const TEXT_TYPE = "text/markdown; charset=utf-8";

  const url = String(formData.get("url") ?? "").trim();
  const file = formData.get("file");
  if (url) {
    try {
      const page = await fetchUrlAsText(url);
      content = page.markdown;
      type = "url";
      sourceUrl = url;
      if (!title) title = page.title;
    } catch (e) {
      return { error: e instanceof Error ? e.message : "Failed to fetch URL." };
    }
    originalBlob = new Blob([content], { type: TEXT_TYPE });
    originalFilename = "page.md";
  } else if (file instanceof File && file.size > 0) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    originalBlob = file;
    originalFilename = file.name;
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    if (isPdf) {
      try {
        content = await extractPdfText(bytes);
        type = "pdf";
      } catch (e) {
        return { error: e instanceof Error ? e.message : "Failed to read PDF." };
      }
      if (!title) title = file.name.replace(/\.pdf$/i, "");
    } else {
      content = new TextDecoder().decode(bytes);
      type = /\.md$/i.test(file.name) ? "markdown" : "txt";
      if (!title) title = file.name.replace(/\.(md|txt)$/i, "");
    }
  } else {
    content = String(formData.get("content") ?? "");
    type = "paste";
    originalBlob = new Blob([content], { type: TEXT_TYPE });
    originalFilename = "pasted.md";
  }

  content = content.replace(/\r\n?/g, "\n").trim();
  if (!content)
    return { error: "Nothing to add — paste text, choose a file, or enter a URL." };
  if (content.length > MAX_CHARS)
    return {
      error: `Source is too large (${content.length} chars, max ${MAX_CHARS}).`,
    };
  if (!title) title = "Untitled";

  // 1) Create the source row first (status = uploaded) so we have a source_id
  //    for the storage path and its progress is observable.
  const { data: source, error: srcErr } = await supabase
    .from("sources")
    .insert({
      user_id: user.id,
      project_id: projectId,
      folder_id: folderId,
      type,
      title,
      source_url: sourceUrl,
      status: "uploaded",
    })
    .select("id")
    .single();
  if (srcErr) return { error: srcErr.message };

  // 2) Archive the original in the private bucket at
  //    {user_id}/{project_id}/{source_id}/{filename}. The path's first segment
  //    is the uid, which the storage RLS policy enforces. Uploaded with the
  //    user's own session (no service_role) so RLS applies.
  const storagePath = `${user.id}/${projectId}/${source.id}/${sanitizeFilename(
    originalFilename,
  )}`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, originalBlob, {
      contentType: originalBlob.type || "application/octet-stream",
      upsert: true,
    });
  if (upErr) {
    await supabase
      .from("sources")
      .update({ status: "error", error_message: `Storage upload failed.`.slice(0, 500) })
      .eq("id", source.id);
    revalidatePath(`/projects/${projectId}`);
    return { error: "Could not store the file. Please try again." };
  }

  await supabase
    .from("sources")
    .update({ storage_path: storagePath, status: "processing" })
    .eq("id", source.id);

  // 3) Build memory: chunk → embed → ready.
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
  return { ok: true, title };
}

export type SummarizeState = { summary?: string; model?: string; error?: string };

/**
 * A-3: one-time summary of a source. Generated on first request (GPT-4o mini),
 * stored on the row, and returned from cache afterwards. RLS scopes the source
 * lookup to the owner.
 */
export async function summarizeSource(
  formData: FormData,
): Promise<SummarizeState> {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id || !projectId) return { error: "Missing source." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: source } = await supabase
    .from("sources")
    .select("id, title, status, summary, summary_model")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!source) return { error: "Source not found." };
  if (source.summary) {
    return { summary: source.summary, model: source.summary_model ?? undefined };
  }
  if (source.status !== "ready") {
    return { error: "Source is still processing — try again once it's ready." };
  }

  // Token cap applies before any LLM spend, same as Ask.
  const capError = await checkLimit(supabase, user.id, "ask");
  if (capError) return { error: capError };

  // The stored memory (chunks in order) IS the document text.
  const { data: chunks, error: chunkErr } = await supabase
    .from("chunks")
    .select("content, chunk_index")
    .eq("source_id", id)
    .order("chunk_index", { ascending: true });
  if (chunkErr) return { error: chunkErr.message };
  const content = (chunks ?? []).map((c) => c.content).join("\n\n");
  if (!content) return { error: "This source has no indexed content." };

  let summary: Awaited<ReturnType<typeof generateSummary>>;
  try {
    summary = await generateSummary(source.title, content);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Summarization failed." };
  }

  await supabase
    .from("sources")
    .update({
      summary: summary.text,
      summary_model: summary.model,
      summary_created_at: new Date().toISOString(),
    })
    .eq("id", id);

  await supabase.from("usage_events").insert({
    user_id: user.id,
    project_id: projectId,
    event_type: "generation",
    tokens: summary.tokens,
    metadata: { kind: "summary", source_id: id, model: summary.model },
  });

  revalidatePath(`/projects/${projectId}`);
  return { summary: summary.text, model: summary.model };
}

export async function deleteSource(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const projectId = String(formData.get("project_id") ?? "");
  if (!id) return;

  const supabase = await createClient();
  // Remove the archived original first (Storage isn't tied to the DB by a FK,
  // so it won't cascade). chunks + embeddings cascade via ON DELETE CASCADE.
  const { data: src } = await supabase
    .from("sources")
    .select("storage_path")
    .eq("id", id)
    .maybeSingle();
  if (src?.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([src.storage_path]);
  }

  const { error } = await supabase.from("sources").delete().eq("id", id);
  if (error) throw error;

  revalidatePath(`/projects/${projectId}`);
}
