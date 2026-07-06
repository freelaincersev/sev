# Sev

**User-owned AI memory layer.** Sev turns your files, notes, links, and
documents into a portable Markdown memory, retrieves only the relevant context,
and lets you assemble **Context Packets** to use with any LLM (ChatGPT, Claude,
Gemini, Cursor…).

> LLMs change. Your context stays.

This repo is the **v0.1 foundation**. See `sev/ideation/` for the full strategy
documents (sections 1–12).

## Stack

- **Next.js 16** (App Router, TypeScript) + **Tailwind v4** + **shadcn/ui** (Radix)
- **Supabase** — Auth, Postgres, **pgvector**, Storage (local via CLI)
- **pnpm**, deploy target **Vercel**
- LLM/embeddings (later): OpenAI embeddings + OpenAI/Anthropic router

## Prerequisites

- Node.js **22+** recommended (`@supabase/supabase-js` warns on Node 20)
- pnpm, Supabase CLI
- A Supabase cloud project (dev runs directly against it — no local Docker)

## Getting started

```bash
# 1. Install deps
pnpm install

# 2. Configure env — point at the Supabase cloud project
cp .env.example .env.local
#   NEXT_PUBLIC_SUPABASE_URL       = https://<ref>.supabase.co
#   NEXT_PUBLIC_SUPABASE_ANON_KEY  = the sb_publishable_ key (public)
#   SUPABASE_SERVICE_ROLE_KEY      = sb_secret_ key (server-only; only when needed)

# 3. Run the app
pnpm dev               # http://localhost:3000
```

The CLI must be logged into the account that owns the project and linked once:

```bash
supabase login
supabase link --project-ref <ref>
```

## Scripts

| Command         | Description                                       |
| --------------- | ------------------------------------------------- |
| `pnpm dev`      | Next.js dev server                                |
| `pnpm build`    | Production build (also typechecks)                |
| `pnpm db:new`   | New migration file (`pnpm db:new <name>`)         |
| `pnpm db:push`  | Push pending migrations to the linked cloud DB    |
| `pnpm db:diff`  | Diff the linked cloud DB against migrations       |
| `pnpm db:types` | Regenerate `lib/database.types.ts` from the schema |

> ⚠️ Dev runs against the **cloud** project, so a bad migration hits it directly.
> Once there are real users, add a separate `sev-dev` project (or local Docker)
> for isolation. `supabase db reset` would wipe the linked cloud DB — don't run it.

Schema change workflow: `pnpm db:new <name>` → edit the SQL → `pnpm db:push` →
`pnpm db:types`.

## Project structure

```
app/
  (app)/                 # authenticated area (shared sidebar layout)
    dashboard/           # project list + create/delete
    projects/[id]/       # project workspace (Sources / Ask / Packets)
  auth/actions.ts        # signIn / signUp / signOut server actions
  login/                 # auth screen
  page.tsx               # landing
components/
  ui/                    # shadcn/ui components
  app-sidebar.tsx, auth-form.tsx, create-project-dialog.tsx, sign-out-button.tsx
lib/
  supabase/              # client.ts (browser), server.ts, middleware.ts, auth.ts
  data/projects.ts       # typed read queries
  actions/projects.ts    # project mutations (server actions)
  database.types.ts      # generated from the Supabase schema
proxy.ts                 # Next 16 middleware: session refresh + route guard
supabase/
  config.toml
  migrations/            # 20260705083033_init_schema.sql (schema + RLS + RPC)
```

## Security model (strategy §7)

- **RLS is enabled on every table**; base policy is `auth.uid() = user_id`.
- Retrieval goes through `match_chunks()` which **always** filters by the
  authenticated user (and optionally a project) — no cross-user/project leakage.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and never prefixed `NEXT_PUBLIC`.
- Original files live in a **private** Storage bucket (`sources`).

## Roadmap (strategy §12 milestones)

- [x] **M1 Foundation** — Auth, schema, RLS, project dashboard
- [ ] **M2 Ingestion v1** — paste / Markdown / TXT → chunks → embeddings
- [ ] **M3 Retrieval** — project-scoped vector search
- [ ] **M4 Ask + Citations**
- [ ] **M5 Context Packet** builder + copy for ChatGPT/Claude/Cursor
- [ ] **M6 Control** — usage caps, delete, export
- [ ] **M7 PDF / URL** ingestion
