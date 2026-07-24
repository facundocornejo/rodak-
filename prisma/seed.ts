// The catalog is NOT seeded any more.
//
// Fase 1 replaced the six hand-written placeholder products this file used to
// write with the real WooCommerce catalog, imported by `scripts/catalog/`:
//
//   npm run catalog:export   # snapshot rodak.ar into data/woo-snapshot/
//   npm run catalog:import   # upsert it into Postgres (idempotent)
//   npm run catalog:prune    # dry run; -- --confirm deletes removed-at-origin rows
//
// The placeholders were not merely redundant, they were harmful: their short
// slugs duplicated real products that arrive with a suffix (`cajonera-kendall`
// vs `cajonera-kendall-paraiso`) — five such duplicates had to be deleted from
// staging on 2026-07-24 — one of them collided outright with a real slug
// (`escritorio-brent-paraiso`), and every one wrote the `stock` column, which
// the import contract forbids: it has no Fase-1 data source and `inStock` is
// the only authoritative availability signal (design D1).
//
// This file stays wired to `prisma.config.ts` on purpose. `prisma migrate
// reset` runs the configured seed command, and failing loudly is the point:
// it tells the operator the database is empty and which commands fill it,
// instead of silently succeeding and leaving them to wonder why `/` renders
// "Catálogo en construcción.".

console.error(
  "There is no seed data for this project.\n" +
    "The catalog comes from the real WooCommerce import, not from fixtures:\n" +
    '  DATABASE_URL="postgresql://..." npm run catalog:export\n' +
    '  DATABASE_URL="postgresql://..." npm run catalog:import\n' +
    "See README § Local database.",
);

process.exitCode = 1;
