import Link from "next/link";
import { LayoutDashboard } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";

export function AppSidebar({ email }: { email: string }) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r bg-muted/30">
      <div className="p-4">
        <Link href="/dashboard" className="text-lg font-semibold tracking-tight">
          Sev
        </Link>
        <p className="mt-0.5 text-xs text-muted-foreground">AI memory layer</p>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
        >
          <LayoutDashboard className="size-4" />
          Projects
        </Link>
      </nav>

      <div className="border-t p-2">
        <p className="truncate px-2 py-1 text-xs text-muted-foreground">
          {email}
        </p>
        <SignOutButton />
      </div>
    </aside>
  );
}
