import { createClient } from "@/lib/supabase/server";

/**
 * Export a project's memory as a single Markdown file (strategy §7.1/§12.9 —
 * "user-owned, exportable"). Chunks are the stored text of record; we join them
 * per source in chunk order. RLS scopes every query to the authenticated owner.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const { data: project } = await supabase
    .from("projects")
    .select("title, description")
    .eq("id", id)
    .single();
  if (!project) return new Response("Not found", { status: 404 });

  const [{ data: sources }, { data: chunks }] = await Promise.all([
    supabase
      .from("sources")
      .select("id, title")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("chunks")
      .select("source_id, content, chunk_index")
      .eq("project_id", id)
      .order("chunk_index", { ascending: true }),
  ]);

  const bySource = new Map<string, string[]>();
  for (const c of chunks ?? []) {
    const list = bySource.get(c.source_id) ?? [];
    list.push(c.content);
    bySource.set(c.source_id, list);
  }

  const parts = [`# ${project.title}`];
  if (project.description) parts.push(project.description);
  for (const s of sources ?? []) {
    parts.push(`\n## ${s.title}`);
    parts.push((bySource.get(s.id) ?? ["_(no indexed content)_"]).join("\n\n"));
  }
  const markdown = parts.join("\n\n") + "\n";

  const slug =
    project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    "project";

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.md"`,
    },
  });
}
