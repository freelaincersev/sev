"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Loader2, Quote, X } from "lucide-react";
import { toast } from "sonner";

import {
  addConversation,
  rejectDecision,
  verifyDecision,
} from "@/lib/actions/decisions";
import type {
  DecisionAlternative,
  DecisionEvidence,
  DecisionRow,
} from "@/lib/data/decisions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const ORIGINS = ["ChatGPT", "Claude", "Claude Code", "Cursor", "Other"];

/**
 * Decisions tab (MVP wedge): capture a conversation → review extracted
 * Decision Record drafts → approve into verified project knowledge.
 * Confirmation is the only human labor in the loop — keep it one glance,
 * two buttons.
 */
export function DecisionsPanel({
  projectId,
  decisions,
}: {
  projectId: string;
  decisions: DecisionRow[];
}) {
  const drafts = decisions.filter((d) => d.verification === "unverified");
  const verified = decisions.filter((d) => d.verification === "verified");

  return (
    <div className="flex flex-col gap-4 py-3">
      <ConversationCapture projectId={projectId} />

      {decisions.length === 0 ? (
        <p className="px-1 text-sm text-muted-foreground">
          Paste an AI conversation above — Sev finds the decisions in it: what
          you chose, why, and what you rejected, each backed by verbatim quotes.
        </p>
      ) : (
        <>
          {drafts.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                To review · {drafts.length}
              </h3>
              {drafts.map((d) => (
                <DecisionCard key={d.id} projectId={projectId} row={d} />
              ))}
            </section>
          )}
          {verified.length > 0 && (
            <section className="flex flex-col gap-2">
              <h3 className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Verified · {verified.length}
              </h3>
              {verified.map((d) => (
                <DecisionCard key={d.id} projectId={projectId} row={d} />
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ConversationCapture({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [origin, setOrigin] = useState<string>(ORIGINS[0]);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!content.trim() || busy) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("project_id", projectId);
      fd.set("content", content);
      fd.set("origin", origin);
      const res = await addConversation({}, fd);
      if (res.ok) {
        toast.success(
          res.count
            ? `Found ${res.count} decision${res.count === 1 ? "" : "s"} to review.`
            : "No clear decisions found in that conversation.",
        );
        setContent("");
        router.refresh();
      } else {
        toast.error(res.error ?? "Extraction failed.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border bg-background p-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Paste an AI conversation (ChatGPT, Claude, …) — Sev extracts the decisions."
        className="min-h-24 resize-y text-sm"
        disabled={busy}
      />
      <div className="mt-2 flex items-center gap-2">
        <select
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
          className="h-8 rounded-md border bg-background px-2 text-xs text-muted-foreground"
          aria-label="Where is this conversation from?"
          disabled={busy}
        >
          {ORIGINS.map((o) => (
            <option key={o} value={o}>
              from {o}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          className="ml-auto"
          onClick={submit}
          disabled={busy || !content.trim()}
        >
          {busy ? (
            <>
              <Loader2 className="mr-1 size-3.5 animate-spin" />
              Extracting…
            </>
          ) : (
            "Extract decisions"
          )}
        </Button>
      </div>
    </div>
  );
}

function DecisionCard({
  projectId,
  row,
}: {
  projectId: string;
  row: DecisionRow;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"verify" | "reject" | null>(null);
  const isDraft = row.verification === "unverified";
  const alternatives = (row.alternatives ?? []) as DecisionAlternative[];
  const evidence = (row.evidence ?? []) as DecisionEvidence[];

  async function act(kind: "verify" | "reject") {
    if (busy) return;
    setBusy(kind);
    try {
      const fd = new FormData();
      fd.set("decision_id", row.id);
      fd.set("project_id", projectId);
      const res =
        kind === "verify" ? await verifyDecision(fd) : await rejectDecision(fd);
      if (res.ok) {
        toast.success(kind === "verify" ? "Verified." : "Rejected.");
        router.refresh();
      } else {
        toast.error(res.error ?? "Something went wrong.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <article
      className={cn(
        "rounded-lg border bg-background p-3 text-sm",
        row.status === "superseded" && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2">
        <p className="min-w-0 flex-1 font-medium leading-snug">{row.decision}</p>
        {isDraft ? (
          <Badge variant="outline" className="shrink-0 text-[10px]">
            draft
          </Badge>
        ) : (
          <Badge className="shrink-0 bg-foreground text-[10px] text-background">
            verified
          </Badge>
        )}
      </div>

      {row.rationale && (
        <p className="mt-1.5 text-muted-foreground">{row.rationale}</p>
      )}

      {alternatives.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {alternatives.map((a, i) => (
            <li key={i}>
              <span className="line-through decoration-muted-foreground/50">
                {a.option}
              </span>
              {a.rejection_reason && <> — {a.rejection_reason}</>}
            </li>
          ))}
        </ul>
      )}

      {evidence.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground">
            <Quote className="mr-1 inline size-3" />
            Evidence · {evidence.length}
          </summary>
          <div className="mt-1.5 space-y-1.5">
            {evidence.map((e, i) => (
              <blockquote
                key={i}
                className="border-l-2 pl-2 text-xs text-muted-foreground"
              >
                {e.quote}
              </blockquote>
            ))}
          </div>
        </details>
      )}

      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
        {row.decided_at && <span>{row.decided_at}</span>}
        {row.status === "superseded" && <span>superseded</span>}
        {isDraft && (
          <span className="ml-auto flex gap-1.5">
            <Button
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={busy !== null}
              onClick={() => act("reject")}
            >
              {busy === "reject" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <X className="size-3" />
              )}
              Reject
            </Button>
            <Button
              size="sm"
              className="h-7 px-2 text-xs"
              disabled={busy !== null}
              onClick={() => act("verify")}
            >
              {busy === "verify" ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Check className="size-3" />
              )}
              Approve
            </Button>
          </span>
        )}
      </div>
    </article>
  );
}
