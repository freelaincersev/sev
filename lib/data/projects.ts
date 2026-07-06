import { createClient } from "@/lib/supabase/server";

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

/** Lists the current user's projects (RLS scopes this to auth.uid()). */
export async function listProjects(): Promise<Project[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

/** Fetches a single project by id, or null when not found / not owned. */
export async function getProject(id: string): Promise<Project | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Project | null) ?? null;
}
