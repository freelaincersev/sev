import "server-only";

import { lookup } from "node:dns/promises";

const MAX_BYTES = 2_000_000; // ~2 MB cap on fetched pages
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

export type FetchedPage = { title: string; markdown: string };

/** Block loopback / private / link-local / reserved ranges (SSRF, §7.5). */
function isPrivateAddress(ip: string): boolean {
  const addr = ip.startsWith("::ffff:") ? ip.slice(7) : ip; // IPv4-mapped IPv6
  // IPv6 loopback / unique-local / link-local
  if (addr === "::1" || /^f[cd][0-9a-f]{2}:/i.test(addr) || /^fe80:/i.test(addr)) {
    return true;
  }
  const m = addr.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false; // non-IPv4 literal handled above / hostname resolved separately
  const [a, b] = [Number(m[1]), Number(m[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true; // link-local incl. cloud metadata 169.254.169.254
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** Validate scheme + host, and reject hosts that resolve to private IPs. */
async function assertPublicUrl(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http(s) URLs are allowed.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new Error("This host is not allowed.");
  }
  const resolved = await lookup(host, { all: true });
  for (const r of resolved) {
    if (isPrivateAddress(r.address)) {
      throw new Error("This URL resolves to a private address and was blocked.");
    }
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"');
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : "";
  const text = decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { title, text };
}

/**
 * Fetch a public web page and return readable text as Markdown-ish content.
 * SSRF-guarded: only http(s), no private/loopback/link-local hosts, redirects
 * re-validated each hop (strategy §7.5 / §6.9). Server-only.
 */
export async function fetchUrlAsText(input: string): Promise<FetchedPage> {
  let current: URL;
  try {
    current = new URL(input);
  } catch {
    throw new Error("Enter a valid URL (including http:// or https://).");
  }

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicUrl(current);

    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": "SevBot/0.1 (+memory ingestion)" },
    });

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error("Redirect without a location.");
      current = new URL(loc, current); // re-validated at loop top
      continue;
    }
    if (!res.ok) throw new Error(`Fetch failed (HTTP ${res.status}).`);

    const contentType = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain|text\/markdown|application\/xhtml/i.test(contentType)) {
      throw new Error(`Unsupported content type: ${contentType || "unknown"}.`);
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) throw new Error("Page is too large to ingest.");

    const raw = (await res.text()).slice(0, MAX_BYTES);
    const isHtml = /text\/html|application\/xhtml/i.test(contentType);
    const { title, text } = isHtml
      ? htmlToText(raw)
      : { title: "", text: raw.trim() };

    if (!text) throw new Error("No readable text found at this URL.");
    return { title: title || current.hostname, markdown: text };
  }

  throw new Error("Too many redirects.");
}
