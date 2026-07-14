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
