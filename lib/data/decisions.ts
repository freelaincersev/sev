import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type DecisionRow = Database["public"]["Tables"]["decisions"]["Row"];

export type DecisionAlternative = {
  option: string;
  rejection_reason: string | null;
};

export type DecisionEvidence = { quote: string };

/** All decision records of a project, drafts first, newest first. RLS scopes to owner. */
export async function getProjectDecisions(
  projectId: string,
): Promise<DecisionRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("decisions")
    .select("*")
    .eq("project_id", projectId)
    .order("verification", { ascending: false }) // unverified first
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}
