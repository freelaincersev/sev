import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

/** Returns the current user (or null) in a Server Component / action. */
export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Returns the current user, redirecting to /login when unauthenticated. */
export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
