import Link from "next/link";

import { JsonLd } from "@/components/seo/JsonLd";
import { Button } from "@/components/ui/button";
import { getUser } from "@/lib/supabase/auth";
import { siteUrl } from "@/lib/site-url";

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Sev",
  // Same sentence as the hero copy and the metadata description ("본문 일치").
  description:
    "Sev turns your files, notes, links, and documents into a portable AI memory layer for you and your team — so ChatGPT, Claude, Gemini, and Cursor can work with the context you already own.",
  url: siteUrl,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  // Landing is bilingual — declare both languages present on the page.
  inLanguage: ["en", "ko"],
  // aggregateRating: add only when real reviews exist.
  // offers: add only when pricing is publicly published.
};

export default async function LandingPage() {
  const user = await getUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-6 py-20">
      <JsonLd data={appJsonLd} />
      <div className="space-y-4">
        <p className="text-sm font-medium tracking-wide text-muted-foreground">
          SEV · USER-OWNED AI MEMORY LAYER
          <span lang="ko"> · 사용자 소유 AI 메모리 레이어</span>
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Stop re-explaining yourself to every AI.
        </h1>
        <h2 lang="ko" className="text-2xl font-semibold tracking-tight text-muted-foreground sm:text-3xl">
          AI에게 매번 다시 설명하지 마세요.
        </h2>
        <p className="text-lg text-muted-foreground">
          Sev turns your files, notes, links, and documents into a portable AI
          memory layer for you and your team — so ChatGPT, Claude, Gemini, and
          Cursor can work with the context you already own.
        </p>
        <p lang="ko" className="text-lg text-muted-foreground">
          세브는 여러분과 팀의 파일·메모·링크·문서를 이동 가능한 AI 메모리로
          만들어, ChatGPT·Claude·Gemini·Cursor 어디서든 이미 가진 맥락 위에서
          이어 일하게 합니다.
        </p>
        <p className="text-sm text-muted-foreground">
          LLMs change. Your context stays.
          <span lang="ko"> · LLM은 바뀌어도 맥락은 남습니다.</span>
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
