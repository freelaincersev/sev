import { AppSidebar } from "@/components/app-sidebar";
import { listProjects } from "@/lib/data/projects";
import { requireUser } from "@/lib/supabase/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, projects] = await Promise.all([requireUser(), listProjects()]);
  return (
    <>
      <AppSidebar
        email={user.email ?? ""}
        projects={projects.map((p) => ({ id: p.id, title: p.title }))}
      />
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
    </>
  );
}
