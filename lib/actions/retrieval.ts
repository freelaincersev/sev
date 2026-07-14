"use server";

import { generateAnswer } from "@/lib/retrieval/answer";
import { searchChunks, type RetrievedChunk } from "@/lib/retrieval/search";
import { EMBEDDING_MODEL } from "@/lib/ingest/embed";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

export type AskState = {
  ok?: boolean;
  error?: string;
  query?: string;
  answer?: string;
  model?: string;
  results?: RetrievedChunk[];
};

/**
 * Ask a question against a project's memory: retrieve the top-k relevant chunks
 * (M3), then generate a citation-first answer grounded in them (M4). Snippets
 * are numbered in retrieval order so inline [n] markers map to results[n-1].
 * Logs retrieval + generation usage events.
 */
export async function askQuestion(
  _prev: AskState,
  formData: FormData,
): Promise<AskState> {
  const projectId = String(formData.get("project_id") ?? "");
  const query = String(formData.get("query") ?? "").trim();
  const modelKey = String(formData.get("model") ?? "");
  if (!projectId) return { error: "Missing project." };
  if (!query) return { error: "Type a question to ask this project's memory." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in.", query };

  const capError = await checkLimit(supabase, user.id, "ask");
  if (capError) return { error: capError, query };

  try {
    const { chunks, queryTokens } = await searchChunks(supabase, {
      projectId,
      query,
    });

    if (chunks.length === 0) {
      await supabase.from("usage_events").insert({
        user_id: user.id,
        project_id: projectId,
        event_type: "retrieval",
        tokens: queryTokens,
        metadata: { model: EMBEDDING_MODEL, returned: 0 },
      });
      return {
        ok: true,
        query,
        answer:
          "This project has no matching memory yet. Add sources, then ask again.",
        results: [],
      };
    }

    const answer = await generateAnswer(query, chunks, modelKey);

    await supabase.from("usage_events").insert([
      {
        user_id: user.id,
        project_id: projectId,
        event_type: "retrieval",
        tokens: queryTokens,
        metadata: { model: EMBEDDING_MODEL, returned: chunks.length },
      },
      {
        user_id: user.id,
        project_id: projectId,
        event_type: "generation",
        tokens: answer.tokens,
        metadata: { model: answer.apiModel, snippets: chunks.length },
      },
    ]);

    return { ok: true, query, answer: answer.text, model: answer.model, results: chunks };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ask failed.";
    return { error: msg, query };
  }
}
