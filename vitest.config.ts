import path from "node:path";

import { defineConfig } from "vitest/config";

import { TEST_PROJECTS } from "./vitest.projects";

const alias = {
  "@": path.resolve(__dirname, "./src"),
};

/**
 * Two projects (design D5), one `npm run test`:
 *
 *  - `node` — everything that existed before: pure modules, the DAL with its
 *    mocked Prisma client, and the catalog pipeline under `scripts/`. Kept on
 *    the `node` environment so the existing suite does not start paying for a
 *    DOM it never touches.
 *  - `dom` — React component tests, on `jsdom`. Selected by EXTENSION
 *    (`*.test.tsx`), not by directory, so a component test cannot silently land
 *    in the wrong environment.
 *
 * `jsdom` over `happy-dom`: the PDP gallery relies on focus and `<dialog>`
 * behaviour, where jsdom is the more faithful of the two.
 *
 * Inline projects do not inherit the root `resolve`, so the `@` alias is
 * declared per project as well.
 *
 * DEVIATION from design D5, with evidence: D5 prescribes `plugins: [react()]`
 * for the dom project. `@vitejs/plugin-react@6.0.4` (peer-compatible with the
 * installed vite 8.1.5) makes every dom worker die on this machine —
 * `RangeError: WebAssembly.instantiate(): Out of memory: Cannot allocate Wasm
 * memory for new instance`, then `FATAL ERROR: Zone Allocation failed - process
 * out of memory` — because it loads the rolldown/babel native pipeline per
 * worker while only ~1.5 GB of the 16 GB is free. Reproduced 4/4 times with the
 * plugin (including with `--maxWorkers=1`) and 3/3 clean runs without it. The
 * plugin is not needed for tests: esbuild transforms TSX using this repo's
 * `tsconfig.json` (`jsx: "react-jsx"`, automatic runtime), so `render(<X />)`
 * works with no React import, and the plugin's Fast Refresh and Babel hooks are
 * dev-server/build concerns that vitest never uses. It was therefore dropped
 * from devDependencies too. If a future component test truly needs a Babel
 * transform, add `@vitejs/plugin-react` back for that project only and re-verify
 * memory behaviour first.
 */
export default defineConfig({
  resolve: { alias },
  test: {
    // Runs once, before any project's file discovery — see
    // `vitest.globalSetup.ts` for why this (not a `*.test.ts` file) is the
    // mechanism that closes the "no test files found" aggregation gap.
    globalSetup: ["./vitest.globalSetup.ts"],
    /**
     * One worker at a time, deliberately.
     *
     * Vitest defaults to one fork per CPU (12 here). The node project alone
     * survived that, but adding the `dom` project's vite server plus a jsdom
     * environment pushes the run past the memory this machine has free
     * (~1.5 GB of 16 GB, the rest held by the desktop), and the failure mode is
     * ugly: `FATAL ERROR: Zone Allocation failed - process out of memory`,
     * followed by every remaining worker failing to start and a PARTIAL count
     * reported as a pass-looking summary. Measured on 2026-07-25 against a
     * 13-file / 188-test suite — this one plus a throwaway `*.test.tsx` that
     * made the `dom` project actually load jsdom, which is the condition that
     * triggers the failure: default concurrency 0/2 clean, `--maxWorkers=4`
     * 1/2, `--maxWorkers=2` 1/3, `--maxWorkers=1` 3/3. `--pool=threads` crashed
     * 3/3.
     *
     * The cost then was ~6.5 s instead of ~2.8 s. PR4a ships the first real
     * `*.test.tsx` files, so the `dom` project now loads jsdom on every run —
     * the OOM condition above is no longer hypothetical and this line is the
     * only thing holding it off. Do not raise it on this machine without
     * re-measuring; a CI runner with more RAM is a different question.
     * Revisit if the suite ever grows big enough for serialization to hurt.
     */
    maxWorkers: 1,
    projects: [
      {
        resolve: { alias },
        test: {
          name: TEST_PROJECTS[0].name,
          environment: "node",
          include: [...TEST_PROJECTS[0].include],
        },
      },
      {
        resolve: { alias },
        test: {
          name: TEST_PROJECTS[1].name,
          environment: "jsdom",
          include: [...TEST_PROJECTS[1].include],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
