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

# Coolify's healthcheck runs INSIDE the container and needs curl or wget
# there; Next's standalone runtime image ships neither. Current Coolify
# (verified live, deploy log 2026-07-21: "/bin/sh: 1: wget: not found")
# generates the check with wget, older versions used curl — install both so
# a Coolify upgrade can't flip the deploy back to unhealthy (design D6 risk
# register: "Healthcheck gotcha").
RUN apt-get update \
  && apt-get install -y --no-install-recommends curl wget \
  && rm -rf /var/lib/apt/lists/*

# The start command below runs `npx prisma migrate deploy` and
# `npm run db:check-drift` (design D8) — they need the prisma CLI, the full
# migration history, and prisma.config.ts. None of that is traced into
# Next's standalone output (it only bundles what server.js actually imports
# at runtime, i.e. @prisma/client + @prisma/adapter-pg, not the CLI). Copy
# the full node_modules from the build stage so the CLI is present.
# --chown=node:node on every runtime COPY: the container runs as USER node,
# but COPY defaults to root:root ownership. Prisma's CLI writes its schema
# engine into node_modules/@prisma/engines at `migrate deploy` time, and
# Next writes the image-optimizer cache under .next/cache — both fail with
# EACCES against root-owned files (verified live: first Coolify deploy
# crash-looped on exactly this).
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts

# Next's standalone server: self-contained server.js plus its own minimal
# traced node_modules subset, layered on top of the full copy above.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

# Pre-create the image-optimizer cache dir owned by node: the Coolify volume
# mounts here, and a mount point auto-created by Docker would be root-owned,
# leaving the runtime user unable to write cached AVIF/WebP transforms.
RUN install -d -o node -g node /app/.next/cache
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
