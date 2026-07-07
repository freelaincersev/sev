// Structure-aware chunker (strategy §6.5 / §8.3):
// prefer semantic boundaries (headings, paragraphs), use a token cap as backup.

export type Chunk = {
  content: string;
  headingPath: string | null;
  chunkIndex: number;
  tokenCount: number;
};

const TARGET_TOKENS = 800;

/** Rough token estimate (~4 chars/token) — good enough to bound chunk size. */
export function estimateTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "para"; text: string };

function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  for (const para of text.split(/\n{2,}/)) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    let acc: string[] = [];
    const flushAcc = () => {
      const t = acc.join("\n").trim();
      if (t) blocks.push({ type: "para", text: t });
      acc = [];
    };

    for (const line of trimmed.split("\n")) {
      const h = /^(#{1,6})\s+(.*\S)\s*$/.exec(line.trim());
      if (h) {
        flushAcc();
        blocks.push({ type: "heading", level: h[1].length, text: h[2].trim() });
      } else {
        acc.push(line);
      }
    }
    flushAcc();
  }
  return blocks;
}

/** Hard-split an over-long paragraph by sentences, then words, to the cap. */
function splitLong(text: string, target: number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  let curTok = 0;
  const flush = () => {
    const s = cur.join(" ").trim();
    if (s) out.push(s);
    cur = [];
    curTok = 0;
  };

  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const t = estimateTokens(sentence);
    if (t > target) {
      flush();
      let wbuf: string[] = [];
      let wtok = 0;
      for (const w of sentence.split(/\s+/)) {
        const wt = estimateTokens(w + " ");
        if (wtok + wt > target && wbuf.length) {
          out.push(wbuf.join(" "));
          wbuf = [];
          wtok = 0;
        }
        wbuf.push(w);
        wtok += wt;
      }
      if (wbuf.length) out.push(wbuf.join(" "));
      continue;
    }
    if (curTok + t > target && cur.length) flush();
    cur.push(sentence);
    curTok += t;
  }
  flush();
  return out;
}

/**
 * Split Markdown/plain text into structure-aware chunks. Chunks never span a
 * heading boundary, and carry the heading path (H1 > H2 > H3) for citations.
 */
export function chunkMarkdown(raw: string): Chunk[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  if (!text) return [];

  const blocks = parseBlocks(text);
  const stack: (string | undefined)[] = [];
  const chunks: Omit<Chunk, "chunkIndex">[] = [];

  let buf: string[] = [];
  let bufTokens = 0;
  let bufHeading: string | null = null;

  const path = () => {
    const p = stack.filter(Boolean).join(" > ");
    return p || null;
  };
  const push = (content: string, headingPath: string | null) => {
    const c = content.trim();
    if (c) chunks.push({ content: c, headingPath, tokenCount: estimateTokens(c) });
  };
  const flush = () => {
    push(buf.join("\n\n"), bufHeading);
    buf = [];
    bufTokens = 0;
  };

  for (const b of blocks) {
    if (b.type === "heading") {
      flush();
      stack[b.level - 1] = b.text;
      stack.length = b.level; // drop deeper levels
      bufHeading = path();
      continue;
    }

    const t = estimateTokens(b.text);
    if (t > TARGET_TOKENS) {
      flush();
      for (const piece of splitLong(b.text, TARGET_TOKENS)) push(piece, path());
      bufHeading = path();
      continue;
    }

    if (bufTokens + t > TARGET_TOKENS && buf.length) flush();
    if (!buf.length) bufHeading = path();
    buf.push(b.text);
    bufTokens += t;
  }
  flush();

  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}
