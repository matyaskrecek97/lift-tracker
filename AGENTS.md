# Lift Tracker - AI Coding Instructions

## Architecture

Next.js App Router application with PostgreSQL and Prisma. All data is **user-scoped** via `userId` foreign keys.

**Data flow (reads)**: Server Components → `lib/data.ts` → Prisma, then pass data as props to Client Components

**Data flow (mutations)**: Client Components → SWR mutation helpers (`lib/hooks.ts`) → API routes (`app/api/`) → Prisma

## Key Directories

- `app/api/` — REST API endpoints. **Do not remove** — they serve client-side mutations (SWR) and will be used by a mobile app in the future
- `app/generated/prisma/` — Generated Prisma client (run `npm run db:generate` after schema changes)
- `lib/data.ts` — Server-side data access layer with `cache()`-wrapped Prisma queries, used by Server Components
- `lib/hooks.ts` — SWR data-fetching hooks + mutation helpers that call `mutate()` to invalidate cache
- `lib/validations.ts` — Zod request-validation schemas, used in API routes with `safeParse()`
- `lib/auth-client.ts` — Client-side auth (`useSession`, `signIn`, `signOut`)
- `components/shell.tsx` — Page layout wrapper used by all pages

## Patterns

### Server Components (Pages)

Pages are async Server Components that authenticate, fetch data via `lib/data.ts`, and pass it as props to Client Components.

### Client Components

Interactive UI is extracted into `"use client"` components that receive server-fetched data as props. For pages needing client-side revalidation, use SWR with `fallbackData`.

### API Routes

Every route must authenticate and scope queries to the current user. API routes handle all mutations and serve as the REST API for external clients.

### Data Mutations

Mutation helpers live in `lib/hooks.ts`. Each calls a fetch to the API, then invalidates the SWR cache with `mutate()`.

### Data Fetching

- List pages (home, workouts, templates) — server props only, no SWR
- Detail editors (workout, template) — SWR with `fallbackData` for live mutation updates
- Dialogs and search (exercises, templates, equipment) — client-only SWR, data depends on user interaction

### Post-Mutation Navigation

After mutations that navigate away (delete, duplicate, save-as-template), use **hard navigation** to avoid a flash of stale content:

- **Navigate to a new entity**: `window.location.href = url`
- **Navigate away after delete** (detail pages): `window.location.replace(url)`
- **Stay on same page after delete** (cards/lists): `router.refresh()` — confirm dialog covers content during refresh

Do **not** use `router.push()` / `router.replace()` for post-mutation redirects — Next.js soft navigation keeps the old page visible during the transition.

## Database Model

See `prisma/schema.prisma` for the database model.

## UI

- **Chakra UI v3** — import components from `@chakra-ui/react`
- Custom dialog: import from `@/components/ui/dialog`
- Color mode: import from `@/components/ui/color-mode`
- Mobile-first responsive design

## MCP Server

An embedded MCP server at `app/api/mcp/route.ts` exposes workout tools for AI clients. Tool registration lives in `lib/mcp-tools.ts`. Two tools (`create_workout`, `get_workout`) are app tools with an interactive UI built as a standalone Vite/React app in `mcp-ui/`. Run `npm run build:mcp-ui` after UI changes. Auth uses OAuth 2.1 via Better Auth's `mcp` plugin — MCP clients authenticate with bearer tokens validated by `auth.api.getMcpSession()`. Each tool callback extracts `userId` from `extra.authInfo`.

**Zod versions**: The MCP SDK requires Zod v3, while the app uses Zod v4. Use `import { z } from "zod3"` in MCP tool code (`lib/mcp-tools.ts`) and `import { z } from "zod"` everywhere else.

## Auth

Uses **better-auth** with Google OAuth:

- Server: `getAuthenticatedUser()` in `lib/api-utils.ts` (wraps `auth.api.getSession()`)
- Client: `useSession()`, `signIn()`, `signOut()` from `lib/auth-client.ts`
