import Link from "next/link";
import { ChevronDown } from "lucide-react";

import { AuthDialog } from "@/components/auth-dialog";
import { LandingNav } from "@/components/landing-nav";
import { JsonLd } from "@/components/seo/JsonLd";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/auth";

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sev",
  // Same sentence as the on-page copy and the metadata description ("본문 일치").
  description:
    "Save your files, notes, and docs to Sev once — then no matter which AI you use, you never repeat yourself again.",
  url: "https://sev.app",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  inLanguage: ["en", "ko"],
};

const VALUES = [
  { en: "Continuity", desc: "Your work continues across every AI tool." },
  { en: "Portability", desc: "Switch models — your context comes with you." },
  { en: "Trust", desc: "Answers are grounded in your sources, with citations." },
  { en: "Control", desc: "Your memory is yours — export or delete it anytime." },
  { en: "Leverage", desc: "The more you add, the sharper your memory gets." },
];

export default async function LandingPage() {
  const user = await getUser();

  return (
    <>
      <LandingNav isAuthed={!!user} />
      <main className="flex w-full flex-col">
        <JsonLd data={appJsonLd} />

        {/* Hero: the promise, centered; everything else scrolls below. */}
        <section className="flex min-h-[calc(100svh-3.5rem)] flex-col items-center justify-center gap-6 px-6 text-center">
          {/* Fluid size (clamp) + nowrap so it always stays on one line,
              shrinking on narrow screens instead of wrapping. */}
          <h1 className="whitespace-nowrap text-[clamp(1.3rem,5.6vw,4.5rem)] font-semibold tracking-[-0.03em]">
            Your AI memory, owned by you.
          </h1>
          <p lang="ko" className="text-base text-muted-foreground">
            당신이 소유하는 AI 기억.
          </p>
          <div className="pointer-events-none mt-10 text-muted-foreground">
            <ChevronDown className="size-6 animate-bounce" aria-hidden />
          </div>
        </section>

      {/* What Sev is — carries the exact metadata/JSON-LD description sentence. */}
      <section className="mx-auto w-full max-w-2xl px-6 py-32">
        <Reveal className="space-y-5">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Stop re-explaining yourself to every AI.
          </h2>
          <p className="text-lg text-muted-foreground">
            Save your files, notes, and docs to Sev once — then no matter which
            AI you use, you never repeat yourself again.
          </p>
          <p lang="ko" className="text-lg font-medium text-foreground">
            아직도 AI에게 매번 설명하세요?
          </p>
          <p lang="ko" className="text-lg text-muted-foreground">
            자료를 Sev에 한 번만 담아두세요. 어떤 AI를 쓰든, 더 이상 같은 말을
            반복할 필요가 없어집니다.
          </p>
        </Reveal>
      </section>

      {/* Five core values (strategy §4.2). */}
      <section className="mx-auto w-full max-w-4xl px-6 py-32">
        <Reveal>
          <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((v) => (
              <div key={v.en} className="space-y-1.5">
                <h3 className="text-lg font-semibold">{v.en}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Before / After (strategy §4.3). */}
      <section className="mx-auto w-full max-w-3xl px-6 py-32">
        <Reveal className="grid gap-8 sm:grid-cols-2">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
              Before
            </p>
            <p className="text-lg">
              Re-uploading the same docs, re-explaining the same project to every
              new chat, losing the thread when you switch models.
            </p>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wide text-primary">
              With Sev
            </p>
            <p className="text-lg">
              Your memory lives in one place, retrieves just the relevant
              context, and drops into any LLM as a ready-to-paste packet.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA. */}
      <section className="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 px-6 py-32 text-center">
        <Reveal className="flex flex-col items-center gap-6">
          <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Ready when you are.
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {user ? (
              <Button asChild size="lg" className="h-11 rounded-full px-8 text-base">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : (
              <>
                <AuthDialog defaultMode="signup">
                  <Button size="lg" className="h-11 rounded-full px-8 text-base">
                    Get started
                  </Button>
                </AuthDialog>
                <AuthDialog defaultMode="signin">
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-11 rounded-full px-8 text-base"
                  >
                    Sign in
                  </Button>
                </AuthDialog>
              </>
            )}
          </div>
        </Reveal>
      </section>
      </main>
    </>
  );
}
