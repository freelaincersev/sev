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
