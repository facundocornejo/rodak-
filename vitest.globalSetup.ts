import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TEST_PROJECTS } from "./vitest.projects";

/**
 * Fails the WHOLE `vitest run` loudly when ANY single `include` pattern
 * matches zero files — closing a real gap (PR2b review finding, made live by
 * PR4a, the PR that added the first `dom`-project `*.test.tsx`).
 *
 * Vitest's own "no test files found" check is aggregated ACROSS ALL projects,
 * not per project. While the `dom` project matched zero files (true before
 * this PR), that didn't matter: a broken `node` `include` still zeroed the
 * aggregate and `vitest run` failed loudly on its own. The moment `dom`
 * matches real files, that protection disappears — a typo in the `node`
 * `include` can silently drop 200+ node tests while `dom`'s handful of files
 * keep the aggregate non-zero, and `vitest run` exits 0.
 *
 * A REGULAR TEST FILE cannot close this gap: a `*.test.ts` guard living
 * inside `src/**` is itself discovered through the very `include` pattern it
 * would need to verify, so the exact failure this guards against — the
 * `node` project's `include` breaking — also makes the guard test vanish
 * (proven while building this file: with a broken `node` include, `npm run
 * test` reported "3 passed (3) / 13 passed (13)" and exited 0, silently
 * including a since-deleted `src/lib/vitestProjects.guard.test.ts` among the
 * missing tests). `globalSetup` is wired directly into `vitest.config.ts`
 * (below), runs once before ANY project's file discovery, and is therefore
 * immune to every project's `include` breaking independently.
 *
 * Deliberately asserts "> 0" per project, never a hardcoded count: a fixed
 * number would need bumping by every future PR that adds a test file, which
 * is exactly the flaky/maintenance-burden gate the task rules out.
 */
export default function setup(): void {
  const repoRoot = path.dirname(fileURLToPath(import.meta.url));

  // Checked PER PATTERN, not per project. Summing a project's patterns first
  // would rebuild the very blind spot this guard exists to close, one level
  // down: the `node` project globs `src/**` AND `scripts/**`, so a typo in the
  // `src` pattern alone would leave the project total non-zero via the two
  // files under `scripts/` and stay silent. Measured, not reasoned: with only
  // the `src` pattern broken, the suite fell from 16 files / 250 tests to
  // 5 / 63 and `vitest run` still exited 0.
  const broken = TEST_PROJECTS.flatMap((project) =>
    project.include
      .filter((pattern) => fs.globSync(pattern, { cwd: repoRoot }).length === 0)
      .map((pattern) => ({ project: project.name, pattern })),
  );

  if (broken.length > 0) {
    throw new Error(
      "vitest project discovery guard: these `include` pattern(s) in " +
        "vitest.projects.ts match ZERO test files — " +
        broken.map(({ project, pattern }) => `${project}: ${pattern}`).join("; ") +
        ". A pattern that matches nothing (typo, moved directory, bad merge) makes " +
        "every test it should have collected stop running while `vitest run` still " +
        "exits 0, because vitest's built-in \"no test files found\" check is " +
        "aggregated across the whole run rather than checked per project — let alone " +
        "per pattern. Fix the pattern, or delete it if the directory is genuinely gone.",
    );
  }
}
