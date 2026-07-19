import { defineConfig, env } from "@prisma/config";

// Prisma 7 moved connection config out of schema.prisma. This file is read
// by the CLI (migrate/generate/studio) only — it never ships to the app
// runtime. DATABASE_URL is passed inline on the command line for local dev
// (see README) and is set as a Coolify env var in staging; it is never
// written to a file in this repo.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
