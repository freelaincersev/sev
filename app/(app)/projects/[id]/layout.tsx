import { notFound } from "next/navigation";

import { ProjectSidebar } from "@/components/project-sidebar";
import { listFolders } from "@/lib/data/folders";
import { getProject } from "@/lib/data/projects";
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
  const [project, folders] = await Promise.all([
    getProject(id),
    listFolders(id),
  ]);
  if (!project) notFound();

  return (
    <>
      <ProjectSidebar
        project={project}
        folders={folders}
        email={user.email ?? ""}
      />
      <div className="flex flex-1 flex-col overflow-auto">{children}</div>
    </>
  );
}
