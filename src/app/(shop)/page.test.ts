import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * D1b tripwire, not a behavioural proof: this test reads `page.tsx`'s SOURCE
 * TEXT and checks for two literal strings. It cannot observe what the route
 * actually does at runtime (that needs a real request against a real/stopped
 * database — see PR4b's apply notes and this PR's manual `curl` verification)
 * — it only proves the two lines this constraint depends on are still there.
 *
 * WHY this constraint exists (design D1b): `/` is Coolify's healthcheck
 * target until the `/api/health` cutover (PR8) is fully complete, INCLUDING
 * Facu's manual step of repointing Coolify (D2b). Until then:
 *   - `export const dynamic = "force-dynamic"` must stay, or Next could try
 *     to statically prerender `/` at build time, which would need a database
 *     `next build` cannot reach in CI [INV-8].
 *   - the catalog grid must stay AWAITED in the page body, NOT wrapped in
 *     `<Suspense>`. Streaming would let the route answer `200` with the shell
 *     before the DB query even runs, so a real database outage would report
 *     healthy to Coolify's probe and the platform would never know to
 *     restart or alert — exactly the failure mode `/api/health` (PR8) exists
 *     to replace, and only once Coolify is repointed to it.
 * Removing either line goes green in every OTHER test in this suite (no
 * component test renders `/` against a live DB), which is why this one
 * exists: without it, the constraint rested on a comment alone.
 */
describe("(shop)/page.tsx — D1b tripwire", () => {
  const source = readFileSync(path.resolve(here, "./page.tsx"), "utf-8");

  // This docblock itself talks ABOUT `<Suspense>` (to explain why it must
  // stay absent), so a naive `source.match(/<Suspense/)` would false-positive
  // on its own explanation. Comments are stripped first so the assertion
  // below can only match a REAL `<Suspense` usage in code.
  const codeOnly = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");

  it('keeps "force-dynamic" so `/` is never statically prerendered [D1, INV-8]', () => {
    expect(codeOnly).toMatch(/export const dynamic = "force-dynamic";/);
  });

  it("does NOT wrap the catalog grid in <Suspense> before the /api/health cutover [D1b]", () => {
    expect(codeOnly).not.toMatch(/<Suspense/);
  });
});
