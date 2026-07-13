import { requireUser } from "@/lib/supabase/auth";

/**
 * Authenticated shell. Each section supplies its own left rail — the generic
 * nav on the dashboard, the project-scoped folder tree inside a project — so
 * the sidebar can be contextual.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireUser();
  return <div className="flex flex-1">{children}</div>;
}
