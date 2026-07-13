import Link from "next/link";

import { AuthDialog } from "@/components/auth-dialog";
import { Button } from "@/components/ui/button";

/**
 * Landing top bar: the Sev wordmark + a faint tagline on the left; sign in /
 * sign up (opening the auth modal) on the right — or a dashboard link when the
 * visitor is already signed in.
 */
export function LandingNav({ isAuthed }: { isAuthed: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            Sev
          </Link>
          <span className="hidden truncate text-xs text-muted-foreground/70 sm:inline">
            LLMs change. Your context stays.
          </span>
        </div>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          ) : (
            <>
              <AuthDialog defaultMode="signin">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </AuthDialog>
              <AuthDialog defaultMode="signup">
                <Button size="sm" className="rounded-full">
                  Sign up
                </Button>
              </AuthDialog>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
