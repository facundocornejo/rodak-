import type { Snapshot } from "./types";

// Pure target-selection logic for `prune.ts`, extracted so the guards that
// stand between a stale report and an irreversible DELETE can be unit tested
// without a database. `prune.ts` owns every side effect (reading files, the
// Prisma client); this file only decides.

export interface ReconciliationReport {
  removedAtOrigin: string[];
  counts: { snapshot: number; db: number };
}

/** A database row as far as target selection is concerned. */
export interface PrunableRow {
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * The slugs the operator is allowed to delete: the ones the last import
 * reported as removed at origin, once the report has been proven to belong to
 * the snapshot on disk. Throws — never returns a filtered list — because every
 * failure here means the inputs disagree about reality, and quietly pruning a
 * subset is how a live product gets deleted.
 */
export function selectTargets(report: unknown, snapshot: Snapshot): string[] {
  if (typeof report !== "object" || report === null) {
    throw new Error("The reconciliation report is not a JSON object — refusing to guess.");
  }

  const candidate = report as Partial<ReconciliationReport>;

  if (!Array.isArray(candidate.removedAtOrigin)) {
    throw new Error("The reconciliation report has no `removedAtOrigin` array — refusing to guess.");
  }

  // Fails CLOSED when `counts` is missing. The count is what ties the report to
  // the snapshot; without it there is no way to tell a fresh report from one
  // written before an export that brought a product back, so an absent field is
  // a reason to stop, not a check to skip.
  if (
    typeof candidate.counts !== "object" ||
    candidate.counts === null ||
    typeof candidate.counts.snapshot !== "number"
  ) {
    throw new Error(
      "The reconciliation report has no `counts.snapshot` — it predates the current import format " +
        "or was hand-edited, and cannot be matched against the snapshot. Re-run " +
        "`npm run catalog:export` and `npm run catalog:import` before pruning.",
    );
  }

  if (candidate.counts.snapshot !== snapshot.products.length) {
    throw new Error(
      `The report was written for a snapshot of ${String(candidate.counts.snapshot)} product(s) but ` +
        `the snapshot on disk holds ${String(snapshot.products.length)}. They come from different ` +
        "runs — re-run `npm run catalog:export` and `npm run catalog:import` before pruning.",
    );
  }

  const liveSlugs = new Set(snapshot.products.map((product) => product.slug));
  const stillLive = candidate.removedAtOrigin.filter((slug) => liveSlugs.has(slug));
  if (stillLive.length > 0) {
    throw new Error(
      "The reconciliation report lists slug(s) that the snapshot still publishes: " +
        `${stillLive.join(", ")}. The report is stale — re-run the import before pruning.`,
    );
  }

  return [...candidate.removedAtOrigin].sort();
}

/**
 * Splits the matched rows into the ones the snapshot actually describes as
 * removed and the ones that have been touched since it was taken.
 *
 * The cutoff is the snapshot's own `fetchedAt` — a timestamp inside the file's
 * content, not the file's mtime, which any editor save or copy would move.
 *
 * A target row is only prunable if it has been untouched since the origin was
 * read: `catalog:import` never writes rows that are absent from the snapshot,
 * so a target whose `createdAt` OR `updatedAt` is newer than the cutoff was
 * re-created (delete-then-insert) or resurrected in place (the import's rename
 * path, which keeps the id and only moves `updatedAt`) by a later run. Either
 * way it is live now, and deleting it would take a real product and its
 * cascade. Such a row is excluded and named, never dropped silently.
 *
 * Clock skew between the machine that took the snapshot and the database
 * server is real and NOT corrected here; it only ever makes this check skip a
 * row it could have deleted, which is the safe direction.
 */
export function partitionByCutoff<T extends PrunableRow>(
  rows: T[],
  cutoff: Date,
): { prunable: T[]; touched: T[] } {
  const prunable: T[] = [];
  const touched: T[] = [];

  for (const row of rows) {
    const lastWrite = Math.max(row.createdAt.getTime(), row.updatedAt.getTime());
    if (lastWrite > cutoff.getTime()) touched.push(row);
    else prunable.push(row);
  }

  return { prunable, touched };
}
