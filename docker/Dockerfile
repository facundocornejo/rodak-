# syntax=docker/dockerfile:1
#
# Multi-stage build for Coolify (design D6). Build pack = Dockerfile, not
# Nixpacks (known Prisma/OpenSSL failures on Nixpacks — see design D6).
# Base is `node:24-slim` (Debian/glibc), not an Alpine/musl image: sharp
# (next/image optimizer) needs a glibc memory allocator tuned via
# MALLOC_ARENA_MAX (see PERFORMANCE.md §2 and the runtime stage below).
#
# Pinned by digest (not just the floating `node:24-slim` tag) so every build
# — local, CI, and Coolify — resolves the exact same bytes and a retagged or
# compromised upstream can't slip in silently. Declared once and reused by
# all three stages; to move to a newer node:24-slim, bump this one line with
# the digest from `docker pull node:24-slim && docker inspect \
# --format='{{index .RepoDigests 0}}' node:24-slim`.
ARG NODE_IMAGE=node:24-slim@sha256:6f7b03f7c2c8e2e784dcf9295400527b9b1270fd37b7e9a7285cf83b6951452d

# ---- deps: install once, reused by the build stage ----
FROM ${NODE_IMAGE} AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- build: prisma generate + next build (output: 'standalone') ----
FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# prisma.config.ts calls env("DATABASE_URL") (Prisma 7 moved connection
# config out of schema.prisma — see design D2/prisma.config.ts). No database
# is reached during `generate` or `next build` (the DAL's Proxy-wrapped
# client defers the real connection to first query — see src/lib/db.ts and
# design D11 "CI builds without DB"); a syntactically valid dummy value only
# satisfies the config loader.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate
RUN npm run build

# ---- runtime: minimal image that actually serves traffic ----
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production
# sharp needs a bounded glibc allocator or memory creeps under sustained
# image-transform load (PERFORMANCE.md §2 / §6, sharp's own Linux
# memory-allocator note: https://sharp.pixelplumbing.com/install#linux-memory-allocator).
ENV MALLOC_ARENA_MAX=2

# Coolify's healthcheck runs curl INSIDE the container. Next's standalone
# runtime image does not ship curl by default — without this, deploys fail
# their healthcheck even though the app itself works fine (design D6 risk
# register: "Healthcheck gotcha").
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*

# The start command below runs `npx prisma migrate deploy` and
# `npm run db:check-drift` (design D8) — they need the prisma CLI, the full
# migration history, and prisma.config.ts. None of that is traced into
# Next's standalone output (it only bundles what server.js actually imports
# at runtime, i.e. @prisma/client + @prisma/adapter-pg, not the CLI). Copy
# the full node_modules from the build stage so the CLI is present.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./prisma.config.ts

# Next's standalone server: self-contained server.js plus its own minimal
# traced node_modules subset, layered on top of the full copy above.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# No src/app static assets exist yet in Fase 0 (no public/ directory). Add
# `COPY --from=build /app/public ./public` here once one is introduced.

USER node
EXPOSE 3000

# Order matters (see README "Detecting schema drift" / task 2.13 — verified
# live): `migrate deploy` MUST run before `db:check-drift`, never after.
# The drift check compares the live DB against the target schema, so a
# legitimate pending migration (including the very first deploy ever, on an
# empty database) would look identical to real drift if checked first,
# aborting the deploy. Running it after `migrate deploy` still catches real
# drift, because a manual out-of-band change is never part of any migration
# file and survives `migrate deploy` untouched.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:check-drift && node server.js"]
