# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Domain context

Sev is a **user-owned AI memory layer**: it turns a user's files, notes, and
documents into Markdown-based memory, retrieves only the relevant context, and
assembles **Context Packets** to use with any LLM. It is not a chat app.

Core entities (Postgres tables): `profiles` → `projects` (memory container) →
`sources` (uploaded file / URL / pasted text) → `chunks` (retrieval unit) →
`embeddings` (pgvector); plus `context_packets` (the core output),
`packet_sources`, `chat_sessions`/`chat_messages`, `usage_events`.

**Data isolation is the product's core promise:** every user-owned row carries
`user_id`; project-scoped rows also carry `project_id`. All access is scoped to
the authenticated user via RLS — never mix users or projects.

## Commands

```bash
pnpm dev          # dev server (http://localhost:3000)
pnpm build        # production build (also typechecks)
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit — fast, run before committing
pnpm db:new <name># new supabase/migrations file
pnpm db:push      # apply pending migrations to the LINKED cloud DB
pnpm db:diff      # diff the linked cloud DB against migrations
pnpm db:types     # regenerate lib/database.types.ts from the schema
```

- **Dev runs directly against the Supabase cloud project — there is no local
  Docker.** Env comes from `.env.local` (git-ignored).
- **Never run `supabase db reset`** — it wipes the linked cloud database.
- Schema change flow: `pnpm db:new` → edit SQL → `pnpm db:push` → `pnpm db:types`.

## Architecture

Next.js 16 (App Router, React Server Components) + Supabase (Auth, Postgres,
pgvector, Storage). TypeScript strict, Tailwind v4, shadcn/ui (Radix).

- **Auth & routing:** `proxy.ts` (Next 16's middleware convention — the file is
  `proxy.ts`, the export is `proxy`) refreshes the Supabase session on every
  request and guards routes: unauthenticated hits to `/dashboard` or
  `/projects/*` redirect to `/login`. Route protection lives here, not in pages.
- **Route groups:** `app/(app)/` is the authenticated shell (shared sidebar
  layout that calls `requireUser()`), containing `dashboard/` and
  `projects/[id]/`. `app/login/` and `app/page.tsx` (landing) are public.
- **Supabase clients** (`lib/supabase/`): `client.ts` (browser),
  `server.ts` (RSC / actions, reads cookies), `middleware.ts` (session refresh
  helper used by `proxy.ts`), `auth.ts` (`getUser` / `requireUser`). All use the
  **publishable** key as `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **Data layer:** reads in `lib/data/*` (server-side queries), mutations as
  Server Actions in `lib/actions/*` and `app/auth/actions.ts`. Pages are Server
  Components that call these directly.
- **DB security:** RLS is enabled on all tables with `auth.uid() = user_id`.
  Vector search goes through the `match_chunks` RPC, which is `security invoker`
  AND filters by `auth.uid()` (+ optional project) — cross-user/project
  retrieval is impossible. Original files live in a private `sources` bucket.
  Schema + policies are in `supabase/migrations/`; generated types in
  `lib/database.types.ts`.

### Folder map

```
app/            # App Router routes
  (app)/        # authenticated group (sidebar layout)
    dashboard/  # project list + create/delete
    projects/[id]/
  auth/actions.ts  # signIn / signUp / signOut (Server Actions)
  login/  page.tsx (landing)
components/     # components/ui/ = shadcn; feature components alongside
lib/
  supabase/     # client / server / middleware / auth
  data/         # typed read queries
  actions/      # Server Action mutations
  database.types.ts  # generated — do not hand-edit
proxy.ts        # session refresh + route guard
supabase/migrations/
```

Note: this project uses `app/` at the root (no `src/` dir) and has no `types/`
dir — DB types live in `lib/database.types.ts`.

## Conventions

- **Server Components by default.** Add `'use client'` only when a component
  needs interaction/state (e.g. `auth-form.tsx`, `create-project-dialog.tsx`).
- **DB access is server-side only** — via a Server Action or the `server.ts`
  client. Never query the DB with elevated privileges from the browser.
- shadcn/ui is the **Radix** variant: compose with `asChild` (not Base UI's
  `render` prop).
- Keep the RLS invariant: any new table gets `user_id`, RLS enabled, and an
  owner policy; any retrieval stays scoped to `user_id` (+ `project_id`).

## Public pages (SEO/GEO)

Rules carried over from `sev/01_Planning/GEO_전략.md` §7 — apply to any public
page, metadata, `sitemap.ts`, `robots.ts`, or JSON-LD.

- **Copy match ("본문 일치"):** the visible page copy, `metadata.description`, and
  the JSON-LD `description` must be the **same sentence**.
- **No unfounded numbers:** never put ratings, review/customer counts, revenue,
  or ROI estimates in public structured data / OG / body. PRD loss & ROI figures
  are internal-only.
- **Public vs private split:** `/dashboard`, `/projects`, `/auth` are never in
  the sitemap; robots `disallow` them + they are actually protected by Auth/RLS
  (robots is not a security control).
- **Sitemap is incremental:** only add a URL to `app/sitemap.ts` once that public
  page actually ships.
- **No unshipped features in structured data:** team/pricing etc. go into JSON-LD
  or keywords only after they appear in the page body.
- **Cite sources with dates:** interview/market numbers keep source + check-date;
  only verified figures reach public output.
- **Site origin is env-driven:** metadataBase/canonical/OG/sitemap/robots read
  `lib/site-url.ts` (`NEXT_PUBLIC_SITE_URL` ?? Vercel prod URL ?? localhost).
  Never hardcode a domain. True hreflang waits for real `/en`·`/ko` routes.

## Never do

- Use the `any` type (TS strict is on) or leave `console.log` in committed code.
- Hardcode secrets/credentials anywhere.
- Put `SUPABASE_SERVICE_ROLE_KEY` (or any secret) in client code or behind a
  `NEXT_PUBLIC_` prefix — service-role is server-only and bypasses RLS.
- Run `supabase db reset` (wipes the linked cloud DB).

## When you finish a change

- Report the changed files and a one-line reason for each.
- Run and report the results of `pnpm build` / `pnpm lint` / `pnpm typecheck`.
- Ask before installing a new package.

---

# CLAUDE.md (한국어)

이 파일은 이 저장소에서 작업하는 Claude Code(claude.ai/code)에게 지침을 제공합니다.
(위 영어 원문과 동일한 내용이며, 한국어 참고용입니다.)

## 도메인 컨텍스트

Sev는 **사용자가 소유하는 AI 기억 레이어(user-owned AI memory layer)** 다. 사용자의
파일·메모·문서를 Markdown 기반 기억으로 만들고, 필요한 맥락만 검색해서 **Context Packet**
으로 조립해 어떤 LLM에든 넘긴다. 채팅 앱이 아니다.

핵심 엔티티(Postgres 테이블): `profiles` → `projects`(기억 컨테이너) →
`sources`(업로드 파일 / URL / 붙여넣은 텍스트) → `chunks`(검색 단위) →
`embeddings`(pgvector). 여기에 `context_packets`(핵심 산출물), `packet_sources`,
`chat_sessions`/`chat_messages`, `usage_events`.

**데이터 격리가 제품의 핵심 약속이다:** 모든 사용자 소유 행은 `user_id`를 갖고,
프로젝트 범위 테이블은 `project_id`도 갖는다. 모든 접근은 RLS로 인증된 사용자에게만
스코프된다 — 사용자·프로젝트를 절대 섞지 않는다.

## 명령어

```bash
pnpm dev          # 개발 서버 (http://localhost:3000)
pnpm build        # 프로덕션 빌드 (타입체크 포함)
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit — 빠름, 커밋 전에 실행
pnpm db:new <name># supabase/migrations 파일 새로 생성
pnpm db:push      # 대기 중 마이그레이션을 링크된 클라우드 DB에 반영
pnpm db:diff      # 링크된 클라우드 DB와 마이그레이션 비교
pnpm db:types     # 스키마에서 lib/database.types.ts 재생성
```

- **개발은 Supabase 클라우드 프로젝트에 직접 연결해서 동작한다 — 로컬 Docker 없음.**
  환경변수는 `.env.local`(git 제외)에서 온다.
- **`supabase db reset`은 절대 실행 금지** — 링크된 클라우드 DB를 통째로 지운다.
- 스키마 변경 순서: `pnpm db:new` → SQL 작성 → `pnpm db:push` → `pnpm db:types`.

## 아키텍처

Next.js 16 (App Router, React Server Components) + Supabase (Auth, Postgres,
pgvector, Storage). TypeScript strict, Tailwind v4, shadcn/ui (Radix).

- **인증 & 라우팅:** `proxy.ts`(Next 16의 미들웨어 컨벤션 — 파일명은 `proxy.ts`,
  export는 `proxy`)가 매 요청마다 Supabase 세션을 갱신하고 라우트를 보호한다.
  미인증 상태로 `/dashboard`·`/projects/*`에 접근하면 `/login`으로 리다이렉트.
  라우트 보호는 페이지가 아니라 여기서 처리한다.
- **라우트 그룹:** `app/(app)/`가 인증 영역 셸(공유 사이드바 레이아웃, `requireUser()`
  호출)이며 `dashboard/`·`projects/[id]/`를 포함한다. `app/login/`과
  `app/page.tsx`(랜딩)는 공개.
- **Supabase 클라이언트**(`lib/supabase/`): `client.ts`(브라우저),
  `server.ts`(RSC/액션, 쿠키 읽음), `middleware.ts`(`proxy.ts`가 쓰는 세션 갱신 헬퍼),
  `auth.ts`(`getUser`/`requireUser`). 모두 **publishable** 키를
  `NEXT_PUBLIC_SUPABASE_ANON_KEY`로 사용.
- **데이터 계층:** 읽기는 `lib/data/*`(서버 쿼리), 변경은 `lib/actions/*`와
  `app/auth/actions.ts`의 Server Action. 페이지는 이들을 직접 호출하는 Server Component.
- **DB 보안:** 모든 테이블에 RLS 활성화(`auth.uid() = user_id`). 벡터 검색은
  `match_chunks` RPC를 통하며, 이 함수는 `security invoker` + `auth.uid()`(+ 선택적
  프로젝트)로 필터링 — 교차 사용자/프로젝트 검색은 불가능. 원본 파일은 private
  `sources` 버킷에 저장. 스키마·정책은 `supabase/migrations/`, 생성 타입은
  `lib/database.types.ts`.

### 폴더 맵

```
app/            # App Router 라우트
  (app)/        # 인증 그룹 (사이드바 레이아웃)
    dashboard/  # 프로젝트 목록 + 생성/삭제
    projects/[id]/
  auth/actions.ts  # signIn / signUp / signOut (Server Actions)
  login/  page.tsx (랜딩)
components/     # components/ui/ = shadcn; 기능 컴포넌트는 그 옆에
lib/
  supabase/     # client / server / middleware / auth
  data/         # 타입 있는 읽기 쿼리
  actions/      # Server Action 변경 로직
  database.types.ts  # 생성 파일 — 직접 수정 금지
proxy.ts        # 세션 갱신 + 라우트 가드
supabase/migrations/
```

참고: 이 프로젝트는 루트에 `app/`를 두고(`src/` 디렉터리 없음) `types/` 디렉터리도 없다 —
DB 타입은 `lib/database.types.ts`에 있다.

## 코딩 규칙

- **기본은 Server Component.** 인터랙션/상태가 필요할 때만 `'use client'`를 붙인다
  (예: `auth-form.tsx`, `create-project-dialog.tsx`).
- **DB 접근은 서버에서만** — Server Action 또는 `server.ts` 클라이언트를 통해. 브라우저에서
  상승된 권한으로 DB를 질의하지 않는다.
- shadcn/ui는 **Radix** 변형이다: `asChild`로 합성한다(Base UI의 `render` prop 아님).
- RLS 불변식 유지: 새 테이블은 `user_id`를 갖고 RLS를 켜고 소유자 정책을 둔다;
  모든 검색은 `user_id`(+ `project_id`) 범위 안에서만 동작한다.

## 공개 페이지 (SEO·GEO)

`sev/01_Planning/GEO_전략.md` §7에서 넘어온 규칙 — 공개 페이지·metadata·`sitemap.ts`·
`robots.ts`·JSON-LD에 모두 적용한다.

- **본문 일치:** 화면에 보이는 카피 = `metadata.description` = JSON-LD `description`
  은 **같은 문장**이어야 한다.
- **근거 없는 수치 금지:** 평점·리뷰/고객 수·매출·ROI 추정치를 공개 구조화 데이터/
  OG/본문에 넣지 않는다. PRD의 손실·ROI 추정치는 **내부 문서 전용**.
- **공개/비공개 분리:** `/dashboard`·`/projects`·`/auth`는 sitemap에 절대 넣지 않고
  robots `disallow` + 실제 보호는 Auth/RLS로 한다(robots는 보안 장치 아님).
- **sitemap 증분:** 공개 페이지가 실제로 배포될 때만 `app/sitemap.ts`에 한 줄 추가.
- **미출시 기능 금지:** 팀·가격 등은 본문에 실린 뒤에만 JSON-LD·키워드에 넣는다.
- **수치엔 출처·확인일:** 인터뷰·시장 수치는 출처+확인일을 병기하고, 검증된 값만
  공개물에 옮긴다.
- **도메인은 env 기반:** metadataBase/canonical/OG/sitemap/robots는 `lib/site-url.ts`
  (`NEXT_PUBLIC_SITE_URL` ?? Vercel prod URL ?? localhost)를 읽는다. 도메인 하드코딩
  금지. 진짜 hreflang은 `/en`·`/ko` 실제 라우트가 생긴 뒤에.

## 금지 사항

- `any` 타입 사용(TS strict 켜짐) 또는 커밋 코드에 `console.log` 잔존.
- 비밀값/자격증명 하드코딩.
- `SUPABASE_SERVICE_ROLE_KEY`(또는 어떤 비밀값이든)를 클라이언트 코드나 `NEXT_PUBLIC_`
  접두사 뒤에 두는 것 — service-role은 서버 전용이며 RLS를 우회한다.
- `supabase db reset` 실행(링크된 클라우드 DB를 지움).

## 작업을 마치면

- 변경한 파일과 각각의 한 줄 이유를 보고한다.
- `pnpm build` / `pnpm lint` / `pnpm typecheck` 실행 결과를 보고한다.
- 새 패키지 설치 전에 먼저 묻는다.
