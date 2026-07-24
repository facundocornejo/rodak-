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
migrated database holding the imported catalog — see "Local database" below
before your first run. (An empty-but-migrated database is not an error: the
page renders "Catálogo en construcción.".)

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
   DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npm run catalog:export
   DATABASE_URL="postgresql://rodak:rodak_dev_only@<host>:5434/rodak_dev" npm run catalog:import
   ```

   `<host>` is `localhost` if step 2 worked, otherwise the WSL IP. There is
   **no seed data**: the catalog is the real one, snapshotted from rodak.ar by
   `catalog:export` (network required, writes the gitignored
   `data/woo-snapshot/`) and written by `catalog:import`, which is idempotent
   (upserts by `slug`/`sku`) — running it twice does not duplicate products.
   `catalog:import` never deletes; a product that disappears upstream is
   reported and removed only by the explicit `npm run catalog:prune`
   (dry run by default, `-- --confirm` to write).

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
bad `DATABASE_URL`).

**Run this AFTER `prisma migrate deploy`, never before.** The check compares
the live database against the *target* schema (`prisma/schema.prisma`), so
if there is a legitimate pending migration not yet applied, the live
database necessarily differs from the target schema too — running the drift
check first would report drift on every ordinary deploy that ships a schema
change, including the very first deploy ever (verified live: on a freshly
created, fully empty database, `db:check-drift` reports every table as
"drift" with exit 2 — that's simply "nothing has been migrated yet", not
tampering). Checking AFTER `migrate deploy` still catches real drift,
because a manual out-of-band change is never part of any migration file, so
it survives `migrate deploy` untouched and still shows up in the diff
(verified live: applied `migrate deploy` to a clean DB, confirmed
`db:check-drift` was clean, added a manual `ALTER TABLE` probe column,
re-ran `db:check-drift` — exit 2, correctly flagged the extra column).

Work Unit 3 wires this into the container start command **after**
`prisma migrate deploy` and before starting the server, so a deployment
fails loud on drift instead of silently serving mismatched code and schema:
`npx prisma migrate deploy && npm run db:check-drift && node server.js`.

## Continuous Integration

`.github/workflows/ci.yml` runs on every push and pull request targeting
`main`: `npm ci` → `prisma generate` (dummy `DATABASE_URL`, no DB
contacted) → lint → typecheck → test → `next build`. **CI is a quality
gate, not the deployer** — Coolify's GitHub App redeploys `main`
independently of CI's result (see design D11). Coolify webhook auto-deploy
and this workflow are two separate integrations against the same repo;
merging via PR is what makes CI run before code reaches `main` in practice.
Coupling CI success to the deploy itself is a later refinement, not part of
Fase 0.

## Deployment (Coolify)

The app deploys as a **Coolify Application** on the existing netcup VPS
(shared with other projects — Coolify + Traefik already own ports 80/443;
see design D6/D7). Everything below except "Verification checklist" is a
**one-time manual setup Facu runs in the Coolify dashboard and DNS
provider** — no agent in this pipeline can reach the VPS or Cloudflare.

### 1. Create the Application

1. In Coolify: **New Resource → Application → GitHub App** source (not a
   plain Git URL — the GitHub App gives push-triggered auto-deploy and PR
   previews). Select `facundocornejo/rodak-`, branch `main`.
2. **Build pack: Dockerfile**, path `docker/Dockerfile`, build context repo
   root (the Dockerfile expects `package.json`/`prisma/` at the root, not
   inside `docker/`). Do **not** use Nixpacks — it has known Prisma/OpenSSL
   build failures (see design D6).
3. **Port: 3000** (matches `EXPOSE 3000` in the Dockerfile and Next's
   default `node server.js` listen port).
4. **Healthcheck path: `/`** (no dedicated `/api/health` route exists yet
   in Fase 0 — see design "Open Questions"). Coolify's healthcheck runs
   `curl` **inside** the container; the Dockerfile installs `curl` in the
   final stage specifically for this (see design D6 risk register
   "Healthcheck gotcha" — without it, deploys fail their healthcheck even
   though the app itself works).
5. **Persistent volume**: mount a volume at `/app/.next/cache` (PERFORMANCE.md
   §2/§6 — without this, every deploy re-encodes every AVIF/WebP image
   variant from scratch instead of reusing the sharp cache).
6. **Concurrent builds: 1 server-wide** (Coolify setting, shared-server rule
   — Next builds have OOMed 8 GB servers on this platform; see design D6).
7. **Resource limits**: set CPU/memory limits to roughly **1.5× expected
   usage** for this app (shared-server rule from the netcup runbook — this
   VPS also hosts other projects). If a build OOMs (exit 137), add
   `NODE_OPTIONS=--max-old-space-size=4096` as a **build-time** env var
   first before raising the limit further.

### 2. Create the Postgres resource

1. **New Resource → Postgres** (Coolify-managed, not our
   `docker-compose.dev.yml` — that file is dev-only, see design D7).
2. **Never** enable "make it publicly available" — Docker port publishing
   bypasses UFW, so a published Postgres port is internet-exposed
   regardless of any host firewall rule (deploy-guide hard rule; design
   D7).
3. Copy the resource's **internal Docker-network connection string**
   (`postgres://…@<container-name>:5432/…`, not `localhost`, not the
   server's public IP) — this is the value for `DATABASE_URL` below.

### 3. Configure environment variables (in the Coolify UI — never in this repo)

| Variable       | Value                                                                                   |
| -------------- | ---------------------------------------------------------------------------------------- |
| `DATABASE_URL` | The Postgres resource's **internal network** connection string from step 2.3.            |
| `STAGING_HOST` | `rodak.fromdevdiego.com` (exact subdomain — Facu's call per design; drives `robots.ts` noindex and `metadataBase`). |
| `SITE_URL`     | Leave **empty** until the real production cutover (Fase 6) — see `src/lib/site-url.ts` precedence. Setting it early would make `robots.ts`/`metadataBase` behave as if this were the real production domain. |
| `NODE_ENV`     | `production` (Coolify's own runtime default for Applications; confirm it is set). |

None of these are `NEXT_PUBLIC_*` today, so none need Coolify's "Build
Variable" flag (that flag exists for client-bundled env vars, which force a
rebuild on change — recorded for later phases per design D13).

### 4. Cloudflare DNS

1. Add an **A record**: `rodak` (or the exact `STAGING_HOST` subdomain) →
   the netcup VPS public IP (take it from the netcup control panel or the
   Coolify server settings — not committed here since this repo is public).
2. **Gray cloud (DNS only) initially**, not orange — this lets Traefik's
   Let's Encrypt HTTP-01/TLS-ALPN challenge reach the origin directly for
   first-issuance. Switch to orange-cloud proxying (and Cloudflare SSL mode
   **Full (strict)**, never Flexible) once the certificate is confirmed
   issued — see PERFORMANCE.md §4 for the full CDN setup, which is a later
   optimization pass, not required for Fase 0's milestone deploy.

### 5. Deploy

Push to `main` (or click "Deploy" in Coolify for the first run). The
container start command is:

```
npx prisma migrate deploy && npm run db:check-drift && node server.js
```

Order matters — see "Detecting schema drift" above: `migrate deploy` must
run first, or the drift check false-positives on every legitimate pending
migration, including the very first deploy ever on an empty database.

### Verification checklist (run after each deploy — the agent-verifiable part)

- [ ] `curl -sSI https://rodak.fromdevdiego.com/` from **outside** the VPS
      returns `200` (or the app's real status) with a valid TLS certificate
      chain (`curl -v` shows the Let's Encrypt-issued cert, no `-k` needed).
- [ ] The response body contains the imported product names (confirms the DB
      connection, migrations, and catalog import all worked end-to-end).
- [ ] An external port scan of the server's public IP (`nmap -p 5432
      <VPS_PUBLIC_IP>` or equivalent `ss`/`nc` check run from outside the
      VPS) shows **5432 NOT reachable** — only 22/80/443 (+ the Coolify
      dashboard port until closed) should answer. This proves the Postgres
      resource from step 2 is internal-network-only, per the "Database
      Network Isolation" spec requirement.
- [ ] The Coolify deploy log shows the start command's three steps running
      in order — `prisma migrate deploy` output, then `db:check-drift`
      output (exit 0, no drift), then the Next.js server startup log —
      confirming migrations really ran as part of the deploy and the drift
      check ran in the correct position.
- [ ] Pushing one intentionally failing commit (e.g. a typecheck error)
      reports CI failure on that SHA; a following passing commit reports
      success (this is a `main`-branch check, not staging-specific — see
      "Continuous Integration" above).

Steps 1–5 (Coolify Application setup, Postgres resource, DNS) are **manual,
one-time actions for Facu** — no tool in this pipeline has network access
to the VPS, the Coolify dashboard, or the Cloudflare account. The
verification checklist's `curl`/`nmap`/log-reading steps can be run by
whoever has that access once the deploy is live.
