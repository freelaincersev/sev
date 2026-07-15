import { AppSidebar, AppSidebarBody } from "@/components/app-sidebar";
import { MobileNav } from "@/components/mobile-nav";
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
      <div className="flex min-w-0 flex-1 flex-col overflow-auto">
        <MobileNav title="Sev">
          <AppSidebarBody
            email={user.email ?? ""}
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
        </MobileNav>
        {children}
      </div>
    </>
  );
}
