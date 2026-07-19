# Rodak

Next.js (App Router) + TypeScript storefront skeleton.

## Prerequisites

- Node.js **24.x LTS** (pinned in `.nvmrc`). With `nvm`:

  ```bash
  nvm install
  nvm use
  ```

- npm (bundled with Node).

## Install

```bash
npm install
```

Run this once per dependency change. Do not run concurrent `npm install`
processes.

## Develop

```bash
npm run dev
```

Serves the app at `http://localhost:3000`. The listing page needs a running,
migrated, seeded database — see "Local database" below before your first
run.

## Quality checks

```bash
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit, strict mode
npm run test       # Vitest
npm run build      # Next.js production build
```

All four MUST exit `0` before opening a PR.

## Environment variables

Copy `.env.example` to `.env` and fill in real values locally. Never commit
`.env` or any file with real secrets — only variable *names* belong in
`.env.example`.

| Variable       | Purpose                                                                    |
| -------------- | --------------------------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string (local dev / staging). See "Local database" below — pass inline, do not put it in a file. |
| `STAGING_HOST` | Staging hostname; drives `robots.ts` noindex logic and, absent `SITE_URL`, derives `metadataBase`. |
| `SITE_URL`     | Canonical site URL for `metadataBase` (e.g. `https://rodak.com.ar`). Takes precedence over a `STAGING_HOST`-derived URL; set at the real production cutover. See `src/lib/site-url.ts`. |
| `NODE_ENV`     | Standard Node environment flag.                                            |

Staging values (including the real `STAGING_HOST` and, at cutover,
`SITE_URL`) are configured in Coolify, never in this repository.

`.env.example` (names only, no values) documents this same table for local
`.env` setup. If it is missing from your checkout, recreate it manually —
this sandbox's permission system denies any tool from writing to `.env*`
paths, so it could not be committed automatically; ask whoever has an editor
open outside this tool to create it with the four variable names above.

## Local database

The listing page reads from Postgres via Prisma (`src/lib/data/products.ts`),
so `npm run dev` needs a reachable `DATABASE_URL`.

1. Start Postgres in WSL (Windows dev machines) or directly with Docker
   Compose (Linux/macOS):

   ```bash
   wsl docker compose -f docker-compose.dev.yml up -d
   ```

   This publishes the dev-only Postgres on host port **5434**, not 5432 —
   pick a free port for your machine if 5434 is also taken (check
   `docker ps` first; other local projects may already use 5432/5433).

2. Find the connection host. On a plain WSL2 NAT setup (no `mirrored`
   networking — see `.wslconfig`), `localhost:5434` from Windows sometimes
   does **not** reach a container's port published *after* the WSL VM was
   already running (a known WSL2 NAT limitation, not a Rodak bug). If
   `localhost` doesn't work, use the WSL VM's IP instead:

   ```bash
   wsl hostname -I   # first IP printed is the one to use
   ```

3. Run Prisma commands with `DATABASE_URL` passed inline — never write it to
   a file (see "Environment variables" above):

   ```bash
   DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npx prisma migrate dev
   DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npx tsx prisma/seed.ts
   ```

   `<host>` is `localhost` if step 2 worked, otherwise the WSL IP. The seed
   script is idempotent (upserts by `slug`/`sku`) — running it twice does
   not duplicate products.

4. `npm run dev` also needs `DATABASE_URL` in its shell for the same reason:

   ```bash
   DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npm run dev
   ```

`prisma migrate deploy` (not `migrate dev`) is the only path schema changes
take in staging/production — see `prisma.config.ts` and design D8. Never run
`prisma db push` or hand-edit tables in any shared environment.

### Detecting schema drift

`prisma migrate deploy` does **not** detect or reject manual schema changes
made outside migration history — it only applies pending migration files and
happily reports "No pending migrations" even if the live table shape no
longer matches `prisma/schema.prisma` (verified live: an `ALTER TABLE` run
by hand is invisible to `migrate deploy`). Drift must be checked separately:

```bash
DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npm run db:check-drift
```

This runs `prisma migrate diff --from-config-datasource --to-schema=prisma/schema.prisma --exit-code`,
comparing the live database against the schema file. Exit codes: `0` = no
drift, `2` = drift detected (also treated as a script failure by npm/CI —
any non-zero exit fails the step), `1` = the command itself errored (e.g.
bad `DATABASE_URL`). Run it before trusting `migrate deploy` output and
after applying any out-of-band change you need to investigate.

Work Unit 3 wires this into the container start command **before**
`prisma migrate deploy`, so a deployment fails loud on drift instead of
silently serving mismatched code and schema:
`npm run db:check-drift && npx prisma migrate deploy && node server.js`.

## Deployment

Deployment pipeline (Docker build, CI, Coolify staging setup) lands in a
later work unit. This skeleton only covers local development.

**Planned for Work Unit 3** (recorded now so the drift-check dependency
isn't lost): the container start command runs the schema-drift check
(`npm run db:check-drift`) BEFORE `prisma migrate deploy`, so staging fails
loud instead of deploying against a manually-altered database — see
"Detecting schema drift" above.
