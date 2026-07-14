import Link from "next/link";
import { ArrowRight } from "lucide-react";

import type { DashboardProject } from "@/lib/data/dashboard";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

function statusLine(p: DashboardProject): string {
  if (p.sourceCount === 0) return "Empty — add your first source";
  if (p.packetCount === 0) return "Ready to pull your first packet";
  return `${p.packetCount} packet${p.packetCount === 1 ? "" : "s"} pulled so far`;
}

export function ProjectCard({
  project,
  highlight,
}: {
  project: DashboardProject;
  highlight?: boolean;
}) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className={cn(
        "group flex flex-col gap-2 rounded-lg border p-4 transition hover:bg-accent/50",
        highlight ? "bg-muted/40" : "bg-card",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{project.name}</span>
        <ArrowRight className="mt-0.5 size-4 shrink-0 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
      </div>
      <p className="text-[13px] text-muted-foreground">
        {project.sourceCount} source{project.sourceCount === 1 ? "" : "s"} ·{" "}
        {project.packetCount} context packet
        {project.packetCount === 1 ? "" : "s"}
      </p>
      <p className="text-[13px] text-muted-foreground">{statusLine(project)}</p>
      {project.lastActivityAt ? (
        <p className="mt-auto pt-1 text-xs text-muted-foreground">
          Last used {relativeTime(project.lastActivityAt)}
        </p>
      ) : null}
    </Link>
  );
}
