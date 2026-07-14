import { ActivityItem } from "@/components/dashboard/ActivityItem";
import type { DashboardActivity } from "@/lib/data/dashboard";

/** The recent flow of saving and using, newest first (max 5). */
export function RecentActivity({
  activity,
}: {
  activity: DashboardActivity[];
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold tracking-tight">
        Recent activity
      </h2>
      {activity.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing yet — add a source or ask a question to get started.
          </p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border px-4">
          {activity.map((a) => (
            <ActivityItem key={a.id} item={a} />
          ))}
        </div>
      )}
    </section>
  );
}
