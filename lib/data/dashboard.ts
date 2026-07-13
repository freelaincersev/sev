import { createClient } from "@/lib/supabase/server";

export type CrewFolder = {
  id: string;
  name: string;
  projectId: string;
  projectTitle: string;
  avatarPreset: string | null;
  color: string | null;
  sourceCount: number;
};

export type DashboardOverview = {
  projects: number;
  sources: number;
  chunks: number;
  packets: number;
  monthTokens: number;
  monthPacketsCreated: number;
  crew: CrewFolder[];
};

/** UTC start of the current calendar month, ISO string. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

/** Shape of a folder row with its embedded source count + project title. */
type FolderRow = {
  id: string;
  name: string;
  project_id: string;
  avatar_preset: string | null;
  color: string | null;
  sources: { count: number }[] | null;
  projects: { title: string } | { title: string }[] | null;
};

/**
 * Account-wide overview for the dashboard: stored knowledge, this month's
 * usage, and the user's folders ("crew") across every project. RLS scopes all
 * of this to the authenticated user.
 */
export async function getDashboardOverview(): Promise<DashboardOverview> {
  const supabase = await createClient();
  const since = monthStartISO();

  const [projects, sources, chunks, packets, events, folders] =
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
        .from("folders")
        .select(
          "id, name, project_id, avatar_preset, color, sources(count), projects(title)",
        )
        .order("created_at", { ascending: true }),
    ]);

  let monthTokens = 0;
  let monthPacketsCreated = 0;
  for (const e of events.data ?? []) {
    monthTokens += e.tokens ?? 0;
    if (e.event_type === "context_packet.created") monthPacketsCreated += 1;
  }

  const crew: CrewFolder[] = ((folders.data ?? []) as unknown as FolderRow[]).map(
    (f) => {
      const project = Array.isArray(f.projects) ? f.projects[0] : f.projects;
      return {
        id: f.id,
        name: f.name,
        projectId: f.project_id,
        projectTitle: project?.title ?? "Untitled",
        avatarPreset: f.avatar_preset,
        color: f.color,
        sourceCount: f.sources?.[0]?.count ?? 0,
      };
    },
  );

  return {
    projects: projects.count ?? 0,
    sources: sources.count ?? 0,
    chunks: chunks.count ?? 0,
    packets: packets.count ?? 0,
    monthTokens,
    monthPacketsCreated,
    crew,
  };
}
