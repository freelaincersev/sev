import { createClient } from "@/lib/supabase/server";

export type ProjectCard = {
  id: string;
  title: string;
  description: string | null;
  sourceCount: number;
  folderCount: number;
};

export type DashboardOverview = {
  projects: number;
  sources: number;
  chunks: number;
  packets: number;
  monthTokens: number;
  monthPacketsCreated: number;
  projectCards: ProjectCard[];
};

/** UTC start of the current calendar month, ISO string. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

export type WeeklyActivity = {
  sourcesAdded: number;
  packetsCreated: number;
  packetsReused: number;
  answers: number;
};

/**
 * Last-7-days momentum for the dashboard's "This week" panel — the deltas that
 * make the memory feel alive (fed, pulled, reused, answered), as opposed to the
 * lifetime totals in the stat tiles. RLS scopes this to the authenticated user.
 */
export async function getWeeklyActivity(): Promise<WeeklyActivity> {
  const supabase = await createClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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
      // generation covers both answers and source summaries; count answers only.
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

/** A project row with its embedded source + folder counts. */
type ProjectRow = {
  id: string;
  title: string;
  description: string | null;
  sources: { count: number }[] | null;
  folders: { count: number }[] | null;
};

/**
 * Account-wide overview for the dashboard: stored knowledge, this month's
 * usage, and the user's projects with their size (sources + folders). Folders
 * ("crew") are project-scoped, so they surface inside a project, not here. RLS
 * scopes all of this to the authenticated user.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const supabase = await createClient();
  const since = monthStartISO();

  const [projects, sources, chunks, packets, events, projectRows] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("sources").select("id", { count: "exact", head: true }),
      supabase.from("chunks").select("id", { count: "exact", head: true }),
      supabase
        .from("context_packets")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("usage_events")
        .select("event_type, tokens")
        .gte("created_at", since),
      supabase
        .from("projects")
        .select("id, title, description, sources(count), folders(count)")
        .order("created_at", { ascending: false }),
    ]);

  let monthTokens = 0;
  let monthPacketsCreated = 0;
  for (const e of events.data ?? []) {
    monthTokens += e.tokens ?? 0;
    if (e.event_type === "context_packet.created") monthPacketsCreated += 1;
  }

  const projectCards: ProjectCard[] = (
    (projectRows.data ?? []) as unknown as ProjectRow[]
  ).map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    sourceCount: p.sources?.[0]?.count ?? 0,
    folderCount: p.folders?.[0]?.count ?? 0,
  }));

  return {
    projects: projects.count ?? 0,
    sources: sources.count ?? 0,
    chunks: chunks.count ?? 0,
    packets: packets.count ?? 0,
    monthTokens,
    monthPacketsCreated,
    projectCards,
  };
}
