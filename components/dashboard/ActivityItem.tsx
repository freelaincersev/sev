import {
  Copy,
  FilePlus2,
  FolderPlus,
  MessageSquareText,
  Package,
  type LucideIcon,
} from "lucide-react";

import type {
  DashboardActivity,
  DashboardActivityType,
} from "@/lib/data/dashboard";
import { relativeTime } from "@/lib/relative-time";

const META: Record<DashboardActivityType, { icon: LucideIcon; label: string }> =
  {
    source_added: { icon: FilePlus2, label: "Source added" },
    answer_saved: { icon: MessageSquareText, label: "AI answer saved" },
    packet_created: { icon: Package, label: "Context packet created" },
    packet_reused: { icon: Copy, label: "Context packet reused" },
    project_created: { icon: FolderPlus, label: "Project created" },
  };

export function ActivityItem({ item }: { item: DashboardActivity }) {
  const { icon: Icon, label } = META[item.type];
  const meta = [item.projectName, relativeTime(item.createdAt)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-muted-foreground">{label}</p>
        <p className="truncate text-sm font-medium">{item.title}</p>
        {meta ? (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
    </div>
  );
}
