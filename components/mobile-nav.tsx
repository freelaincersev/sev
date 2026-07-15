"use client";

import { useState } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Menu, X } from "lucide-react";

/**
 * Mobile-only top bar + slide-in navigation drawer. The desktop sidebars are
 * hidden below `lg`; this gives the same content a reachable home on phones.
 * `children` is the sidebar body (server-rendered); the drawer closes when a
 * link inside it is tapped so navigation feels native.
 */
export function MobileNav({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4 lg:hidden">
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Trigger
          aria-label="Open navigation"
          className="inline-flex size-9 items-center justify-center rounded-md border text-foreground transition hover:bg-accent"
        >
          <Menu className="size-5" />
        </DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-background shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left"
            onClick={(e) => {
              // Close after tapping a link so it behaves like a nav menu.
              if ((e.target as HTMLElement).closest("a")) setOpen(false);
            }}
          >
            <DialogPrimitive.Title className="sr-only">
              Navigation
            </DialogPrimitive.Title>
            <DialogPrimitive.Close
              aria-label="Close navigation"
              className="absolute right-2 top-2 z-10 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent"
            >
              <X className="size-4" />
            </DialogPrimitive.Close>
            {children}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
        {title}
      </span>
    </div>
  );
}
