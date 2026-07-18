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

Serves the app at `http://localhost:3000`.

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

| Variable       | Purpose                                             |
| -------------- | ---------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string (local dev / staging).   |
| `STAGING_HOST` | Staging hostname; drives `robots.ts` noindex logic.   |
| `NODE_ENV`     | Standard Node environment flag.                       |

Staging values (including the real `STAGING_HOST`) are configured in Coolify,
never in this repository.

## Deployment

Deployment pipeline (Docker build, CI, Coolify staging setup) lands in a
later work unit. This skeleton only covers local development.
