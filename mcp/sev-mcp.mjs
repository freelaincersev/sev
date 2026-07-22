#!/usr/bin/env node
/**
 * Sev MCP server (v1, local stdio) — serve Decision Records into any MCP
 * client (Claude Code, Cursor, ChatGPT dev mode via proxy, …).
 *
 * Design (PRD v3 §5 / MVP cut #5):
 *  - stdio JSON-RPC, newline-delimited — no SDK, no new packages.
 *  - Auth: signs into Supabase AS THE USER (email/password from .env.local),
 *    so every query runs under the user's own RLS. No service role, ever.
 *  - Injection policy: this serves the OWNER's records, so unverified records
 *    are returned WITH their label (본인 기록은 라벨 주입) — the labels are in
 *    the payload and the client model is expected to disclose them.
 *  - Hosted HTTP MCP (per-user API keys) is deliberately later — this is the
 *    dogfood/design-partner surface.
 *
 * Setup:
 *   1. Add to .env.local:  SEV_EMAIL=you@example.com  SEV_PASSWORD=…
 *   2. Register (already in .mcp.json for this repo), or:
 *      claude mcp add sev -- node mcp/sev-mcp.mjs
 */

import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ---------- env (.env.local at repo root; script lives in mcp/) ----------
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(join(ROOT, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && env[m[1]] === undefined) env[m[1]] = m[2].trim();
  }
} catch {
  /* .env.local optional if real env vars are set */
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const OPENAI_KEY = env.OPENAI_API_KEY;
const EMAIL = env.SEV_EMAIL;
const PASSWORD = env.SEV_PASSWORD;

// ---------- Supabase session (user-scoped; lazy, refreshed on 401) ----------
let session = null; // { access_token, user_id }

async function signIn() {
  if (!SUPABASE_URL || !ANON_KEY)
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY in .env.local.");
  if (!EMAIL || !PASSWORD)
    throw new Error("Add SEV_EMAIL and SEV_PASSWORD to .env.local to use the Sev MCP server.");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sev sign-in failed (${res.status}).`);
  const data = await res.json();
  session = { access_token: data.access_token, user_id: data.user?.id };
}

async function sb(path, init = {}, retry = true) {
  if (!session) await signIn();
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    ...init,
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${session.access_token}`,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 401 && retry) {
    session = null;
    return sb(path, init, false); // one re-auth
  }
  if (!res.ok) throw new Error(`Supabase request failed (${res.status}): ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

async function embedQuery(text) {
  if (!OPENAI_KEY) throw new Error("Missing OPENAI_API_KEY in .env.local.");
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { authorization: `Bearer ${OPENAI_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: [text] }),
  });
  if (!res.ok) throw new Error(`Embedding failed (${res.status}).`);
  return (await res.json()).data[0].embedding;
}

// ---------- record formatting (labels are part of the injection policy) ----------
function formatDecision(d, i = null) {
  const flags = [
    d.verification === "verified" ? "verified" : "UNVERIFIED (draft — user has not confirmed)",
    d.status === "superseded" ? "SUPERSEDED (replaced later — historical only)" : null,
  ]
    .filter(Boolean)
    .join("; ");
  const lines = [
    `${i !== null ? `${i + 1}. ` : ""}${d.decision}`,
    `   id: ${d.id} · ${flags}${d.decided_at ? ` · decided ${d.decided_at}` : ""}`,
    d.rationale ? `   why: ${d.rationale}` : null,
    ...(d.alternatives ?? []).map(
      (a) => `   rejected: ${a.option}${a.rejection_reason ? ` — ${a.rejection_reason}` : ""}`,
    ),
    d.conditions ? `   conditions at the time: ${d.conditions}` : null,
    ...(d.evidence ?? []).map((e) => `   evidence: "${e.quote}"`),
  ];
  return lines.filter(Boolean).join("\n");
}

// ---------- tools ----------
const TOOLS = [
  {
    name: "search_decisions",
    description:
      "Semantic search over the user's recorded Decision Records (what was decided, why, which alternatives were rejected, with verbatim evidence). Use when the user asks why something was chosen, before re-deciding something that may already be settled, or to check whether a new answer CONTRADICTS a recorded decision. Records labelled UNVERIFIED are drafts — disclose that when relying on them.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What decision/topic to look for" },
        project_id: { type: "string", description: "Optional project UUID to scope the search" },
        k: { type: "number", description: "Max records to return (default 5)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_decision",
    description: "Fetch one Decision Record by id, with full rationale, alternatives and evidence quotes.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string" } },
      required: ["id"],
    },
  },
  {
    name: "list_projects",
    description: "List the user's Sev projects (id + title), for scoping decision searches.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function callTool(name, args) {
  if (name === "list_projects") {
    const rows = await sb("/rest/v1/projects?select=id,title&order=updated_at.desc");
    return rows.map((p) => `${p.title} — ${p.id}`).join("\n") || "No projects yet.";
  }

  if (name === "search_decisions") {
    const vector = await embedQuery(String(args.query ?? ""));
    const rows = await sb("/rest/v1/rpc/match_decisions", {
      method: "POST",
      body: JSON.stringify({
        query_embedding: JSON.stringify(vector),
        match_count: Math.min(Number(args.k) || 5, 20),
        p_project_id: args.project_id ?? null,
      }),
    });
    const hits = (rows ?? []).filter((r) => r.similarity >= 0.3);
    if (hits.length === 0) return "No matching decision records.";
    // North Star instrumentation: records served into an AI context via MCP.
    sb("/rest/v1/usage_events", {
      method: "POST",
      headers: { prefer: "return=minimal" },
      body: JSON.stringify({
        user_id: session.user_id,
        project_id: hits[0].project_id,
        event_type: "decision.injected",
        metadata: { via: "mcp", decision_ids: hits.map((h) => h.id) },
      }),
    }).catch(() => {});
    return hits.map((d, i) => formatDecision(d, i)).join("\n\n");
  }

  if (name === "get_decision") {
    const rows = await sb(
      `/rest/v1/decisions?id=eq.${encodeURIComponent(String(args.id ?? ""))}&select=*`,
    );
    if (!rows?.length) return "Decision not found.";
    return formatDecision(rows[0]);
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ---------- stdio JSON-RPC loop ----------
function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const rl = createInterface({ input: process.stdin });
rl.on("line", async (line) => {
  if (!line.trim()) return;
  let req;
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = req;
  const isNotification = id === undefined || id === null;

  try {
    if (method === "initialize") {
      send({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion ?? "2025-03-26",
          capabilities: { tools: {} },
          serverInfo: { name: "sev", version: "0.1.0" },
        },
      });
    } else if (method === "tools/list") {
      send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
    } else if (method === "tools/call") {
      try {
        const text = await callTool(params?.name, params?.arguments ?? {});
        send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text }] } });
      } catch (e) {
        send({
          jsonrpc: "2.0",
          id,
          result: { content: [{ type: "text", text: String(e.message ?? e) }], isError: true },
        });
      }
    } else if (method === "ping") {
      send({ jsonrpc: "2.0", id, result: {} });
    } else if (!isNotification) {
      send({ jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${method}` } });
    }
    // notifications (initialized, cancelled, …) are ignored by design
  } catch (e) {
    if (!isNotification)
      send({ jsonrpc: "2.0", id, error: { code: -32603, message: String(e.message ?? e) } });
  }
});
