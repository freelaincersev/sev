import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/auth";

export default async function LandingPage() {
  const user = await getUser();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-20">
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          SEV · USER-OWNED AI MEMORY LAYER
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Stop re-explaining yourself to every AI.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Sev turns your files, notes, links, and documents into a portable AI
          memory layer — so ChatGPT, Claude, Gemini, and Cursor can work with the
          context you already own.
        </p>
        <p className="text-sm text-muted-foreground">
          LLMs change. Your context stays.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {user ? (
          <Button asChild size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        ) : (
          <>
            <Button asChild size="lg">
              <Link href="/login">Get started</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Sign in</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
