import { createClient } from "@/lib/supabase/server";

// ── Types (shared with the dashboard UI; kept here so a future API can return
//    the same shapes and the components don't change) ─────────────────────────

export type DashboardSummary = {
  sourceCount: number;
  packetCount: number;
  reusesThisWeek: number;
};

export type DashboardProject = {
  id: string;
  name: string;
  sourceCount: number;
  packetCount: number;
  lastActivityAt?: string;
};

export type DashboardPacket = {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  sourceCount: number;
  reuseCount: number;
  createdAt: string;
  /** Copy-paste body, so re-copy needs no round trip. */
  llmReadyPrompt: string;
};

export type DashboardActivityType =
  | "source_added"
  | "answer_saved"
  | "packet_created"
  | "packet_reused"
  | "project_created";

export type DashboardActivity = {
  id: string;
  type: DashboardActivityType;
  title: string;
  projectName?: string;
  createdAt: string;
};

export type WeeklyActivity = {
  sourcesAdded: number;
  packetsCreated: number;
  packetsReused: number;
  answers: number;
};

export type MemoryInsights = {
  week: WeeklyActivity;
  reuse: { reusedPackets: number; totalPackets: number; rate: number };
  attention?: {
    projectId: string;
    name: string;
    sourceCount: number;
    packetCount: number;
  };
};

export type DashboardHome = {
  summary: DashboardSummary;
  projects: DashboardProject[];
  packets: DashboardPacket[];
  activity: DashboardActivity[];
  insights: MemoryInsights;
};

// ── Helpers ───────────────────────────────────────────────────────────────

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Embedded to-one relations come back as an object or a 1-element array. */
function relTitle(
  rel: { title: string } | { title: string }[] | null,
): string | undefined {
  return Array.isArray(rel) ? rel[0]?.title : rel?.title;
}

function packetIdOf(metadata: unknown): string | undefined {
  const pid = (metadata as { packet_id?: unknown } | null)?.packet_id;
  return typeof pid === "string" ? pid : undefined;
}

/**
 * Last-7-days momentum — the deltas behind the "This week" insight (fed,
 * pulled, reused, answered). RLS scopes this to the authenticated user.
 */
export async function getWeeklyActivity(): Promise<WeeklyActivity> {
  const supabase = await createClient();
  const since = new Date(Date.now() - WEEK_MS).toISOString();

  const [sources, events] = await Promise.all([
    supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since),
    supabase
      .from("usage_events")
      .select("event_type, metadata")
      .gte("created_at", since),
  ]);

  let packetsCreated = 0;
  let packetsReused = 0;
  let answers = 0;
  for (const e of events.data ?? []) {
    if (e.event_type === "context_packet.created") packetsCreated += 1;
    else if (e.event_type === "context_packet.copied") packetsReused += 1;
    else if (e.event_type === "generation") {
      const kind = (e.metadata as { kind?: string } | null)?.kind;
      if (kind !== "summary") answers += 1;
    }
  }

  return {
    sourcesAdded: sources.count ?? 0,
    packetsCreated,
    packetsReused,
    answers,
  };
}

// Row shapes for the embedded selects below (cast, so we don't fight the
// generated relation types).
type ProjectRow = {
  id: string;
  title: string;
  created_at: string;
  sources: { count: number }[] | null;
  context_packets: { count: number }[] | null;
};
type PacketRow = {
  id: string;
  title: string;
  project_id: string;
  created_at: string;
  llm_ready_prompt: string | null;
  projects: { title: string } | { title: string }[] | null;
  packet_sources: { count: number }[] | null;
};
type SourceRow = {
  id: string;
  title: string;
  type: string;
  project_id: string;
  created_at: string;
  projects: { title: string } | { title: string }[] | null;
};
type EventRow = {
  event_type: string;
  metadata: unknown;
  project_id: string | null;
  created_at: string;
};

/**
 * Everything the dashboard home needs, computed from the DB in one pass:
 * projects (with last-activity + counts), recent packets (with reuse counts),
 * a synthesized activity feed, and memory insights. RLS scopes all reads to the
 * authenticated user. UI components receive plain typed shapes (above) so they
 * can later be fed by an API without changes.
 */
export async function getDashboardHome(): Promise<DashboardHome> {
  const supabase = await createClient();

  const [projectsRes, packetsRes, sourcesRes, eventsRes, week] =
    await Promise.all([
      supabase
        .from("projects")
        .select("id, title, created_at, sources(count), context_packets(count)")
        .order("created_at", { ascending: false }),
      supabase
        .from("context_packets")
        .select(
          "id, title, project_id, created_at, llm_ready_prompt, projects(title), packet_sources(count)",
        )
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("sources")
        .select("id, title, type, project_id, created_at, projects(title)")
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("usage_events")
        .select("event_type, metadata, project_id, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      getWeeklyActivity(),
    ]);

  const projRows = (projectsRes.data ?? []) as unknown as ProjectRow[];
  const pktRows = (packetsRes.data ?? []) as unknown as PacketRow[];
  const srcRows = (sourcesRes.data ?? []) as unknown as SourceRow[];
  const evtRows = (eventsRes.data ?? []) as unknown as EventRow[];

  // Last activity per project = latest timestamp across events/sources/packets.
  const lastActivity = new Map<string, string>();
  const bump = (pid: string | null | undefined, at: string) => {
    if (!pid) return;
    const cur = lastActivity.get(pid);
    if (!cur || at > cur) lastActivity.set(pid, at);
  };
  for (const e of evtRows) bump(e.project_id, e.created_at);
  for (const s of srcRows) bump(s.project_id, s.created_at);
  for (const p of pktRows) bump(p.project_id, p.created_at);

  const projects: DashboardProject[] = projRows
    .map((p) => ({
      id: p.id,
      name: p.title,
      sourceCount: p.sources?.[0]?.count ?? 0,
      packetCount: p.context_packets?.[0]?.count ?? 0,
      lastActivityAt: lastActivity.get(p.id) ?? p.created_at,
    }))
    .sort((a, b) => (b.lastActivityAt ?? "").localeCompare(a.lastActivityAt ?? ""));

  // Reuse counts per packet, from the recent-events window.
  const reuseByPacket = new Map<string, number>();
  for (const e of evtRows) {
    if (e.event_type !== "context_packet.copied") continue;
    const pid = packetIdOf(e.metadata);
    if (pid) reuseByPacket.set(pid, (reuseByPacket.get(pid) ?? 0) + 1);
  }

  const packets: DashboardPacket[] = pktRows.map((p) => ({
    id: p.id,
    title: p.title,
    projectId: p.project_id,
    projectName: relTitle(p.projects) ?? "Untitled",
    sourceCount: p.packet_sources?.[0]?.count ?? 0,
    reuseCount: reuseByPacket.get(p.id) ?? 0,
    createdAt: p.created_at,
    llmReadyPrompt: p.llm_ready_prompt ?? "",
  }));

  // Activity feed: synthesize from sources, packets, copies, and projects.
  const packetTitle = new Map<string, string>();
  for (const p of pktRows) packetTitle.set(p.id, p.title);

  const activity: DashboardActivity[] = [];
  for (const s of srcRows) {
    activity.push({
      id: `src-${s.id}`,
      type: s.type === "saved_answer" ? "answer_saved" : "source_added",
      title: s.title,
      projectName: relTitle(s.projects),
      createdAt: s.created_at,
    });
  }
  for (const p of pktRows) {
    activity.push({
      id: `pkt-${p.id}`,
      type: "packet_created",
      title: p.title,
      projectName: relTitle(p.projects),
      createdAt: p.created_at,
    });
  }
  for (const p of projRows) {
    activity.push({
      id: `proj-${p.id}`,
      type: "project_created",
      title: p.title,
      projectName: p.title,
      createdAt: p.created_at,
    });
  }
  let reuseSeq = 0;
  for (const e of evtRows) {
    if (e.event_type !== "context_packet.copied") continue;
    const pid = packetIdOf(e.metadata);
    activity.push({
      id: `reuse-${reuseSeq++}`,
      type: "packet_reused",
      title: (pid && packetTitle.get(pid)) || "a context packet",
      createdAt: e.created_at,
    });
  }
  activity.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const sourceTotal = projects.reduce((n, p) => n + p.sourceCount, 0);
  const packetTotal = projects.reduce((n, p) => n + p.packetCount, 0);

  const reusedPackets = reuseByPacket.size;
  const reuse = {
    reusedPackets,
    totalPackets: packetTotal,
    rate: packetTotal > 0 ? Math.round((reusedPackets / packetTotal) * 100) : 0,
  };

  // Attention heuristic: a project that stores a lot but has barely pulled.
  const attentionProject = projects
    .filter((p) => p.sourceCount >= 3 && p.packetCount <= 1)
    .sort((a, b) => b.sourceCount - a.sourceCount)[0];
  const attention = attentionProject
    ? {
        projectId: attentionProject.id,
        name: attentionProject.name,
        sourceCount: attentionProject.sourceCount,
        packetCount: attentionProject.packetCount,
      }
    : undefined;

  return {
    summary: {
      sourceCount: sourceTotal,
      packetCount: packetTotal,
      reusesThisWeek: week.packetsReused,
    },
    projects,
    packets,
    activity: activity.slice(0, 5),
    insights: { week, reuse, attention },
  };
}
