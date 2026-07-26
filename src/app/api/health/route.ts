import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

// No DB is reachable during `next build` in CI (design D1/INV-8); this route
// must never be statically evaluated or cached — every request re-runs the
// probe.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Design D2: the probe must fail fast, not hang behind a stalled connection. */
const HEALTH_CHECK_TIMEOUT_MS = 2000;

const NO_STORE_HEADERS = { "Cache-Control": "no-store" } as const;

/**
 * `GET /api/health/` (note the trailing slash — see `src/lib/routes.ts` and
 * `next.config.ts`'s `trailingSlash: true`; the slashless form 308-redirects,
 * which reads as non-2xx to a naive healthcheck probe).
 *
 * This is the ONE thing Coolify checks to decide whether the container is
 * healthy, once Facu repoints it here (design D2b — `/` stays the probe
 * target until that manual cutover is recorded). The check itself races
 * `prisma.$queryRaw` against a fixed timeout rather than trusting the
 * database driver's own timeout, which is unbounded from this route's point
 * of view.
 *
 * The body NEVER carries the underlying failure: this endpoint is public and
 * unauthenticated, so a Prisma error message, an error code, a stack trace or
 * anything that could resemble a connection string must never reach a
 * client. The only fact this endpoint reports is "database reachable, yes or
 * no" — nothing about WHY it is not.
 */
export async function GET(): Promise<Response> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  const timedOut = new Promise<"timeout">((resolve) => {
    timeoutHandle = setTimeout(() => resolve("timeout"), HEALTH_CHECK_TIMEOUT_MS);
  });

  // The query's own rejection is handled right here, inline, rather than left
  // to whoever loses the race: `Promise.race` does not "cancel" the loser, so
  // a query that is still in flight when the timeout wins would otherwise
  // reject on its own schedule with nothing attached to it — an unhandled
  // rejection Node logs as a warning even though this route already decided
  // what to answer. Folding both outcomes into a resolved `"ok" | "error"`
  // value means there is never a rejected promise left unattended.
  const queried = prisma.$queryRaw`SELECT 1`.then(
    () => "ok" as const,
    () => "error" as const,
  );

  const outcome = await Promise.race([queried, timedOut]);

  // Release the timer regardless of which side won: an uncleared `setTimeout`
  // keeps a handle alive for the rest of the 2s window even after this
  // request has already been answered.
  clearTimeout(timeoutHandle);

  if (outcome === "ok") {
    return NextResponse.json({ status: "ok" }, { status: 200, headers: NO_STORE_HEADERS });
  }

  return NextResponse.json({ status: "error" }, { status: 503, headers: NO_STORE_HEADERS });
}
