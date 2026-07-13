"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export type WorkspaceTab = { key: string; label: string; content: ReactNode };

/**
 * Lightweight tab switcher for the project workspace's right rail. All panels
 * stay mounted (toggled with `hidden`) so their local state — a half-typed
 * packet goal, an open dialog — survives tab switches.
 *
 * When `focusToken` changes to a truthy value, the `focusKey` tab is brought
 * forward — used so picking a folder in the left rail reveals the Sources tab.
 */
export function WorkspaceTabs({
  tabs,
  focusKey,
  focusToken,
}: {
  tabs: WorkspaceTab[];
  focusKey?: string;
  focusToken?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  const prevToken = useRef(focusToken);
  useEffect(() => {
    if (focusToken && focusToken !== prevToken.current && focusKey) {
      setActive(focusKey);
    }
    prevToken.current = focusToken;
  }, [focusToken, focusKey]);

  return (
    <div>
      <div
        role="tablist"
        className="mb-3 flex gap-1 rounded-lg border bg-muted/40 p-1"
      >
        {tabs.map((t) => (
          <Button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={t.key === active}
            size="sm"
            variant={t.key === active ? "default" : "ghost"}
            className="flex-1"
            onClick={() => setActive(t.key)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tabs.map((t) => (
        <div key={t.key} className={cn(t.key !== active && "hidden")}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
