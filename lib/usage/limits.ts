import "server-only";

import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type Plan = "free" | "pro" | "pro_plus" | "lifetime";

type PlanLimits = {
  sources: number;
  packetsPerMonth: number;
  tokensPerMonth: number;
};

/**
 * Per-plan caps (strategy §9.3). Numbers are v0.1 assumptions — the strategy
 * itself marks them as hypotheses to tune against real cost. Token caps bound
 * embedding + generation spend (strategy §6.10 / §9.2).
 */
const LIMITS: Record<Plan, PlanLimits> = {
  free: { sources: 50, packetsPerMonth: 20, tokensPerMonth: 1_000_000 },
  pro: { sources: 1_000, packetsPerMonth: 500, tokensPerMonth: 20_000_000 },
  pro_plus: { sources: 5_000, packetsPerMonth: 2_000, tokensPerMonth: 100_000_000 },
  lifetime: { sources: 1_000, packetsPerMonth: 500, tokensPerMonth: 20_000_000 },
};

export type LimitedAction = "add_source" | "ask" | "create_packet";

/** UTC start of the current calendar month, ISO string. */
function monthStartISO(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
}

async function planFor(supabase: ServerClient, userId: string): Promise<Plan> {
  const { data } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();
  const plan = data?.plan as Plan | undefined;
  return plan && plan in LIMITS ? plan : "free";
}

/**
 * Returns a user-facing message if the action would exceed the user's plan
 * caps, or null if it is within limits. Enforced BEFORE any embedding / LLM
 * call so we never spend on a request we then reject.
 */
export async function checkLimit(
  supabase: ServerClient,
  userId: string,
  action: LimitedAction,
): Promise<string | null> {
  const limits = LIMITS[await planFor(supabase, userId)];
  const since = monthStartISO();

  if (action === "add_source") {
    const { count } = await supabase
      .from("sources")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    if ((count ?? 0) >= limits.sources) {
      return `Source limit reached (${limits.sources} on your plan). Delete sources or upgrade.`;
    }
  }

  if (action === "create_packet") {
    const { count } = await supabase
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("event_type", "context_packet.created")
      .gte("created_at", since);
    if ((count ?? 0) >= limits.packetsPerMonth) {
      return `Monthly Context Packet limit reached (${limits.packetsPerMonth} on your plan).`;
    }
  }

  // Monthly token cap applies to every metered action (embedding + generation).
  const { data: rows } = await supabase
    .from("usage_events")
    .select("tokens")
    .eq("user_id", userId)
    .gte("created_at", since);
  const usedTokens = (rows ?? []).reduce((sum, r) => sum + (r.tokens ?? 0), 0);
  if (usedTokens >= limits.tokensPerMonth) {
    return "Monthly usage limit reached. Upgrade your plan or wait until next month.";
  }

  return null;
}
