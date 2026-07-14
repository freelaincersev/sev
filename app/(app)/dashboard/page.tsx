import { AskMemory } from "@/components/dashboard/AskMemory";
import { ContinueWorking } from "@/components/dashboard/ContinueWorking";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { MemoryInsights } from "@/components/dashboard/MemoryInsights";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { RecentPackets } from "@/components/dashboard/RecentPackets";
import { getDashboardHome } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const { summary, projects, packets, activity, insights } =
    await getDashboardHome();
  const pickerProjects = projects.map((p) => ({ id: p.id, name: p.name }));
  const hasProjects = projects.length > 0;

  return (
    <div className="mx-auto w-full max-w-[1200px] px-6 py-10">
      <DashboardHeader summary={summary} projects={pickerProjects} />

      {hasProjects ? (
        <>
          <div className="mt-8">
            <AskMemory projects={pickerProjects} />
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-3">
            <div className="space-y-10 lg:col-span-2">
              <ContinueWorking projects={projects} />
              <RecentPackets
                packets={packets}
                projects={pickerProjects}
                viewAllHref={`/projects/${projects[0].id}?tab=usage`}
              />
              <RecentActivity activity={activity} />
            </div>
            <aside className="lg:col-span-1">
              <MemoryInsights data={insights} />
            </aside>
          </div>
        </>
      ) : (
        <div className="mt-8">
          <DashboardEmptyState />
        </div>
      )}
    </div>
  );
}
