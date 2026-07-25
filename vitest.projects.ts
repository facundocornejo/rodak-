/**
 * Single source of truth for each vitest project's file-discovery glob(s).
 *
 * Consumed by `vitest.config.ts` (which builds the real `projects` array from
 * it) AND by `vitest.globalSetup.ts` (which asserts every pattern below still
 * matches at least one real file on disk). Splitting this out of
 * `vitest.config.ts` itself — rather than exporting it alongside the
 * `defineConfig(...)` default export — keeps the guard depending on plain data
 * instead of on all of the config's machinery, and stops the two from drifting
 * apart: there is one array, and both read it.
 *
 * Why this file exists at all (PR2b review finding, made live by PR4a):
 * vitest's "no test files found" check is aggregated ACROSS ALL projects, not
 * per project (`onTestRunEnd` / `printNoTestFound` in vitest's CLI). Before
 * the `dom` project matched any file, that didn't matter: a broken `node`
 * `include` still zeroed the aggregate and `vitest run` failed loudly. The
 * moment `dom` matches real files (this PR adds the first `*.test.tsx`), that
 * protection disappears — a typo in the `node` include could silently drop
 * all 200+ node tests while `dom`'s handful of files keep the aggregate
 * non-zero, and CI would stay green. The guard closes that gap by checking
 * EVERY PATTERN below on its own — not every project, because the `node`
 * project globs two directories and one of them breaking would hide behind
 * the other — asserting only "> 0" per pattern (never a hardcoded count,
 * which every future PR would have to bump).
 */
export const TEST_PROJECTS = [
  {
    name: "node",
    // `scripts/` holds the catalog migration pipeline; its pure transform
    // layer is unit-tested and must run in the same `npm test` gate as the
    // app code.
    include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
  },
  {
    name: "dom",
    include: ["src/**/*.test.tsx"],
  },
] as const;
