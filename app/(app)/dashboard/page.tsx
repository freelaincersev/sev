import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { DashboardAsk } from "@/components/dashboard-ask";
import { DashboardCapture } from "@/components/dashboard-capture";
import { RecentPackets } from "@/components/recent-packets";
import { getDashboardOverview } from "@/lib/data/dashboard";
import { listRecentPackets } from "@/lib/data/packets";

function StatTile({
  label,
  value,
  hint,
  emphasis,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
  href?: string;
}) {
  const base = emphasis
    ? "rounded-xl border border-foreground/15 bg-foreground p-4 text-background"
    : "rounded-xl border bg-card p-4";
  const interactive = href
    ? emphasis
      ? " group block transition hover:opacity-90"
      : " group block transition hover:bg-accent/50"
    : "";
  const body = (
    <>
      <p
        className={
          emphasis
            ? "text-xs text-background/70"
            : "text-xs text-muted-foreground"
        }
      >
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? (
        <p
          className={
            emphasis
              ? "mt-0.5 flex items-center gap-1 text-xs text-background/60"
              : "mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"
          }
        >
          {hint}
          {href ? (
            <ArrowRight className="size-3 -translate-x-1 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
          ) : null}
        </p>
      ) : null}
    </>
  );
  return href ? (
    <Link href={href} className={base + interactive}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
}

export default async function DashboardPage() {
  const [overview, recentPackets] = await Promise.all([
    getDashboardOverview(),
    listRecentPackets(),
  ]);
  const projects = overview.projectCards;
  const recent = projects[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Your memory</h1>
          <p className="text-sm text-muted-foreground">
            Ask it, pull from it — ready for any AI.
          </p>
        </div>
        <CreateProjectDialog />
      </div>

      {/* Ask-first: land on the dashboard and immediately use your memory. */}
      {recent ? (
        <section className="mb-8 space-y-3">
          <DashboardAsk
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
          <DashboardCapture
            projects={projects.map((p) => ({ id: p.id, title: p.title }))}
          />
        </section>
      ) : (
        <section className="mb-8 rounded-2xl border border-dashed bg-card p-8 text-center">
          <h2 className="text-base font-semibold tracking-tight">
            Start your memory
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
            Create a project, drop in your files and notes, and Sev turns them
            into memory you can ask and reuse with any AI.
          </p>
          <div className="mt-5 flex justify-center">
            <CreateProjectDialog />
          </div>
        </section>
      )}

      {/* Reuse what you've pulled — the North Star made actionable. */}
      {recentPackets.length > 0 ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">
            Reuse a packet
          </h2>
          <RecentPackets packets={recentPackets} />
        </section>
      ) : null}

      {/* Payoff scoreboard: what your memory has done, not just what's stored. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Context Packets"
          value={overview.packets.toLocaleString()}
          hint="pulled for your AIs"
          emphasis
          href={recent ? `/projects/${recent.id}?tab=usage` : undefined}
        />
        <StatTile
          label="Sources"
          value={overview.sources.toLocaleString()}
          hint="feeding your memory"
          href={recent ? `/projects/${recent.id}` : undefined}
        />
        <StatTile
          label="Pulled this month"
          value={overview.monthPacketsCreated.toLocaleString()}
          hint="keep the loop going"
        />
        <StatTile label="Projects" value={overview.projects.toLocaleString()} />
      </div>
    </div>
  );
}
