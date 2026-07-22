"use server";

import { generateAnswer, type ChatTurn } from "@/lib/retrieval/answer";
import {
  searchChunks,
  searchDecisions,
  type RetrievedChunk,
  type RetrievedDecision,
} from "@/lib/retrieval/search";
import { embedTexts, EMBEDDING_MODEL } from "@/lib/ingest/embed";
import { checkLimit } from "@/lib/usage/limits";
import { createClient } from "@/lib/supabase/server";

/** Keep recent turns bounded: last 2 turns, each capped, for context. */
const MAX_HISTORY_TURNS = 4; // up to 2 user + 2 assistant messages
const MAX_TURN_CHARS = 4000;
/** How much of the previous answer to fold into the retrieval query. */
const RETRIEVAL_CONTEXT_CHARS = 1200;

/**
 * Parse and sanitize prior turns from the client: keep only well-formed
 * user/assistant messages, drop any leading assistant turn so the sequence
 * starts with a user turn (required by Anthropic/Gemini), and cap size.
 */
function parseHistory(raw: string): ChatTurn[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const turns: ChatTurn[] = [];
  for (const t of parsed) {
    if (
      t &&
      typeof t === "object" &&
      (t as { role?: unknown }).role !== undefined &&
      typeof (t as { content?: unknown }).content === "string"
    ) {
      const role = (t as { role: unknown }).role;
      const content = ((t as { content: string }).content).trim();
      if ((role === "user" || role === "assistant") && content) {
        turns.push({ role, content: content.slice(0, MAX_TURN_CHARS) });
      }
    }
  }
  const recent = turns.slice(-MAX_HISTORY_TURNS);
  while (recent.length && recent[0].role === "assistant") recent.shift();
  return recent;
}

/**
 * Fold the previous assistant answer into the search query so conversational
 * follow-ups ("summarize the differentiators I just listed") retrieve against
 * that content instead of the bare instruction, which embeds poorly.
 */
function buildRetrievalQuery(query: string, history: ChatTurn[]): string {
  const lastAnswer = [...history].reverse().find((t) => t.role === "assistant");
  if (!lastAnswer) return query;
  return `${lastAnswer.content.slice(0, RETRIEVAL_CONTEXT_CHARS)}\n\n${query}`;
}

export type AskState = {
  ok?: boolean;
  error?: string;
  query?: string;
  answer?: string;
  model?: string;
  results?: RetrievedChunk[];
  /** Decision records retrieved for this answer — cited inline as [Dn]. */
  decisions?: RetrievedDecision[];
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
  const folderId = String(formData.get("folder_id") ?? "") || undefined;
  const history = parseHistory(String(formData.get("history") ?? ""));
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
    // Retrieve against the follow-up folded with the prior answer so
    // back-references resolve; the user still sees just their question.
    // One embedding serves both chunk and decision retrieval.
    const retrievalQuery = buildRetrievalQuery(query, history);
    const [queryVector] = await embedTexts([retrievalQuery]);

    const [{ chunks, queryTokens }, decisions] = await Promise.all([
      searchChunks(supabase, {
        projectId,
        folderId,
        query: retrievalQuery,
        queryVector,
      }),
      searchDecisions(supabase, { projectId, queryVector }),
    ]);

    if (chunks.length === 0 && decisions.length === 0) {
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

    const answer = await generateAnswer(query, chunks, modelKey, history, decisions);

    // North Star instrumentation: which decision records were injected into
    // the context, and which the answer actually cited ([Dn]) — "적중-사용".
    const citedIdx = new Set(
      [...answer.text.matchAll(/\[D(\d+)\]/g)].map((m) => Number(m[1]) - 1),
    );
    const adoptedIds = decisions
      .filter((_, i) => citedIdx.has(i))
      .map((d) => d.id);

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
        metadata: {
          model: answer.apiModel,
          snippets: chunks.length,
          decisions: decisions.length,
        },
      },
      ...(decisions.length > 0
        ? [
            {
              user_id: user.id,
              project_id: projectId,
              event_type: "decision.injected",
              metadata: { decision_ids: decisions.map((d) => d.id) },
            },
          ]
        : []),
      ...(adoptedIds.length > 0
        ? [
            {
              user_id: user.id,
              project_id: projectId,
              event_type: "decision.adopted",
              metadata: { decision_ids: adoptedIds },
            },
          ]
        : []),
    ]);

    return {
      ok: true,
      query,
      answer: answer.text,
      model: answer.model,
      results: chunks,
      decisions,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ask failed.";
    return { error: msg, query };
  }
}
