import "server-only";

import type { RetrievedChunk } from "@/lib/retrieval/search";

/** Which external LLM a packet is aimed at (affects the copy label, not the body). */
export type TargetLLM = "generic" | "chatgpt" | "claude" | "cursor";

export type BuiltPacket = {
  title: string;
  goal: string;
  targetLLM: TargetLLM;
  keyContext: string;
  llmReadyPrompt: string;
  content: {
    goal: string;
    targetLLM: TargetLLM;
    sources: {
      n: number;
      chunkId: string;
      sourceId: string;
      sourceTitle: string;
      headingPath: string | null;
    }[];
  };
};

function packetTitle(goal: string): string {
  const firstLine = goal.split("\n")[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}…` : firstLine || "Untitled packet";
}

/** One numbered, cited snippet block: "[1] Source — Heading\n<content>". */
function snippetBlock(chunk: RetrievedChunk, n: number): string {
  const where = chunk.headingPath ? ` — ${chunk.headingPath}` : "";
  return `[${n}] ${chunk.sourceTitle}${where}\n${chunk.content}`;
}

/**
 * Assemble a copy-paste-ready Context Packet from retrieved chunks — pure text,
 * no LLM call. The packet IS the context you paste into any external LLM.
 * Server-only.
 */
export function buildPacket(opts: {
  goal: string;
  projectTitle: string;
  chunks: RetrievedChunk[];
  targetLLM?: TargetLLM;
}): BuiltPacket {
  const { goal, projectTitle, chunks, targetLLM = "generic" } = opts;

  const keyContext = chunks.map((c, i) => snippetBlock(c, i + 1)).join("\n\n");

  const llmReadyPrompt = [
    `You are helping with a task for the project "${projectTitle}".`,
    "",
    "## Goal",
    goal,
    "",
    "## Relevant context from my project memory",
    keyContext,
    "",
    "## Instructions",
    "Use only the context above to help with the goal. Cite sources by their number, e.g. [1], when you rely on them. If the context is insufficient, say so plainly instead of guessing.",
  ].join("\n");

  return {
    title: packetTitle(goal),
    goal,
    targetLLM,
    keyContext,
    llmReadyPrompt,
    content: {
      goal,
      targetLLM,
      sources: chunks.map((c, i) => ({
        n: i + 1,
        chunkId: c.chunkId,
        sourceId: c.sourceId,
        sourceTitle: c.sourceTitle,
        headingPath: c.headingPath,
      })),
    },
  };
}
