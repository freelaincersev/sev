import { notFound } from "next/navigation";

import { MobileNav } from "@/components/mobile-nav";
import { ProjectSidebar, ProjectSidebarBody } from "@/components/project-sidebar";
import { listFolders } from "@/lib/data/folders";
import { getProject } from "@/lib/data/projects";
import { countSources } from "@/lib/data/sources";
import { requireUser } from "@/lib/supabase/auth";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();
  const [project, folders, totalSources] = await Promise.all([
    getProject(id),
    listFolders(id),
    countSources(id),
  ]);
  if (!project) notFound();

  return (
    <>
      <ProjectSidebar
        project={project}
        folders={folders}
        totalSources={totalSources}
        email={user.email ?? ""}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav title={project.title}>
          <ProjectSidebarBody
            project={project}
            folders={folders}
            totalSources={totalSources}
            email={user.email ?? ""}
          />
        </MobileNav>
        <div className="flex min-w-0 flex-1">{children}</div>
      </div>
    </>
  );
}
