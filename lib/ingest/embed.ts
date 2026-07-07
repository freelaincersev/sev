import "server-only";

import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIM = 1536;

let _client: OpenAI | null = null;
function client() {
  if (!_client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey });
  }
  return _client;
}

/**
 * Embed texts with OpenAI, batched. Returns vectors in the same order as input.
 * Server-only — never import this from a Client Component.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const out: number[][] = [];
  const BATCH = 96;
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    const res = await client().embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
    });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const d of sorted) out.push(d.embedding as number[]);
  }
  return out;
}

/** pgvector accepts a bracketed string literal: "[0.1,0.2,...]". */
export function toVectorLiteral(vec: number[]): string {
  return JSON.stringify(vec);
}
