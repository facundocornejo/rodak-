import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { partitionByCutoff, selectTargets } from "./prune-targets";
import type { Snapshot } from "./types";

// Deletion step of the catalog migration, kept OUT of `import.ts` on purpose:
// the import is report-only by contract (a product in the database but not in
// the snapshot is reported, never deleted), so removing those rows is a
// separate, explicit, operator-driven action.
//
// Run (dry run — prints what it WOULD delete, writes nothing):
//   DATABASE_URL="postgresql://..." npm run catalog:prune
// Run (executes the deletion):
//   DATABASE_URL="postgresql://..." npm run catalog:prune -- --confirm
//
// Targets come from `removedAtOrigin` in the reconciliation report written by
// the last import — never from an ad-hoc list typed at the prompt. Five guards
// stand between that list and a DELETE:
//   1. the report and the snapshot must come from the same run (their product
//      counts must agree) — a report without `counts` fails closed;
//   2. every target must be absent from the snapshot, so a product the origin
//      still publishes can never be dropped;
//   3. a matched row written after the snapshot was taken is excluded and
//      named: a later import re-created or resurrected it, so it is live;
//   4. nothing is written without `--confirm` — the dry run is the gate;
//   5. the rows are dumped to a backup file before the transaction, and the
//      DELETE is keyed by immutable id rather than by the slug an import could
//      re-create in the meantime.
//
// Guards 1-3 live in `prune-targets.ts` as pure functions and are unit tested
// there; this file owns the side effects.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Pass it inline when running the prune, e.g.\n" +
      '  DATABASE_URL="postgresql://..." npm run catalog:prune',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SNAPSHOT_DIR = join(process.cwd(), "data", "woo-snapshot");
const SNAPSHOT_PATH = join(SNAPSHOT_DIR, "snapshot.json");
const REPORT_PATH = join(SNAPSHOT_DIR, "reconciliation-report.json");

// Same value and same reasoning as `import.ts`: the 5s Prisma default is tight
// for a cold container, and a timeout here would abort a transaction that has
// nothing wrong with it. A prune is one statement plus its cascade, so the
// ceiling is generous rather than tuned.
const TRANSACTION_TIMEOUT_MS = 30_000;

const confirmed = process.argv.slice(2).includes("--confirm");

interface TargetSelection {
  targets: string[];
  /** `snapshot.fetchedAt`: the cutoff that tells a removed row from a live one. */
  cutoff: Date;
}

function readTargets(): TargetSelection {
  if (!existsSync(REPORT_PATH)) {
    throw new Error(
      `No reconciliation report at ${REPORT_PATH}. Run \`npm run catalog:import\` first — ` +
        "the prune targets are whatever that run reported as removed at origin.",
    );
  }

  // The snapshot is the authority on what the origin still publishes; a report
  // alone can never authorize a deletion.
  if (!existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      `No snapshot at ${SNAPSHOT_PATH}. It is the cross-check that keeps a live product ` +
        "from being deleted by a stale report — run `npm run catalog:export` first.",
    );
  }

  const report: unknown = JSON.parse(readFileSync(REPORT_PATH, "utf8"));
  const snapshot = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8")) as Snapshot;

  // The cutoff comes from the snapshot's content, never from a file mtime: an
  // editor save or a copy moves an mtime without changing what the file says,
  // and this timestamp decides which rows may be deleted.
  const cutoff = new Date(snapshot.fetchedAt);
  if (Number.isNaN(cutoff.getTime())) {
    throw new Error(
      `${SNAPSHOT_PATH} has an unreadable \`fetchedAt\` (${String(snapshot.fetchedAt)}). It is the ` +
        "cutoff that separates a removed product from one an import brought back — re-run " +
        "`npm run catalog:export`.",
    );
  }

  return { targets: selectTargets(report, snapshot), cutoff };
}

async function main(): Promise<void> {
  const { targets, cutoff } = readTargets();

  if (targets.length === 0) {
    console.log("Nothing to prune: the last import reported no products removed at origin.");
    return;
  }

  // Everything about the rows, not just what the dry run prints: this is both
  // the deletion target and the backup written before the transaction.
  const matched = await prisma.product.findMany({
    where: { slug: { in: targets } },
    include: {
      variants: true,
      media: true,
      categories: { select: { slug: true } },
    },
    orderBy: { slug: "asc" },
  });

  const { prunable: rows, touched } = partitionByCutoff(matched, cutoff);
  const missing = targets.filter((slug) => !matched.some((row) => row.slug === slug));

  console.log(`Prune targets (from ${REPORT_PATH}): ${String(targets.length)}`);
  for (const row of rows) {
    // wooId tells the operator where the row came from: null = never imported
    // (a seed placeholder), a number = a product the origin once published and
    // has since taken down. Same deletion, very different decision.
    const provenance = row.wooId === null ? "no wooId (never imported)" : `woo ${String(row.wooId)}`;
    console.log(
      `  ${row.slug} — "${row.name}" — ${provenance} — ` +
        `${String(row.variants.length)} variant(s), ${String(row.media.length)} image(s)`,
    );
  }
  for (const row of touched) {
    const lastWrite = row.updatedAt > row.createdAt ? row.updatedAt : row.createdAt;
    console.log(
      `  ${row.slug} — SKIPPED: last written ${lastWrite.toISOString()}, after the snapshot was ` +
        `taken (${cutoff.toISOString()}) — an import brought it back, so it is live, not removed.`,
    );
  }
  for (const slug of missing) {
    console.log(`  ${slug} — already absent from this database, nothing to delete`);
  }

  if (rows.length === 0) {
    console.log("");
    console.log("Nothing to delete: no target row is eligible.");
    return;
  }

  if (!confirmed) {
    console.log("");
    console.log("DRY RUN — nothing was written. Re-run with `-- --confirm` to delete the rows above.");
    console.log("Variants, images and category links go with each product (ON DELETE CASCADE).");
    return;
  }

  const before = await prisma.product.count();

  // Written BEFORE the delete, and the run aborts if it cannot be written: the
  // cascade takes variants, images and category links with each product, and
  // the console lines above are nowhere near enough to rebuild one. Restoring
  // still means an operator reading this file, but "recoverable from a file on
  // disk" and "recoverable only from last night's database backup" are very
  // different mornings. The directory is gitignored — this is operator data.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = join(SNAPSHOT_DIR, `pruned-${stamp}.json`);
  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(backupPath, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
  console.log(`Backup of the rows about to be deleted: ${backupPath}`);

  // Delete by primary key, never by slug: `slug` is the key `catalog:import`
  // upserts on, so an import running between the read above and this delete
  // could have re-created a product under a target slug — and a slug-keyed
  // DELETE would take that live row (and its cascade) instead of the stale one
  // the operator approved in the dry run. Ids are immutable and unambiguous.
  const targetIds = rows.map((row) => row.id);

  // One transaction: a partial prune would leave the catalog in a state no
  // report describes.
  //
  // The call itself is inside the try for a reason: a connection that drops
  // after Postgres commits but before the client is told still throws here, and
  // the outcome of THAT throw is unknown, not "nothing happened" — over the SSH
  // tunnel this tool runs through, it is the likeliest failure of all. From
  // here to the end of the block, no error may read as "nothing was deleted".
  let deleted = 0;
  try {
    deleted = await prisma.$transaction(
      async (tx) => {
        const result = await tx.product.deleteMany({ where: { id: { in: targetIds } } });
        return result.count;
      },
      { timeout: TRANSACTION_TIMEOUT_MS },
    );

    // Read back rather than trust the count: the point of the prune is that
    // those rows are gone, not that a DELETE reported a number.
    const survivors = await prisma.product.findMany({
      where: { id: { in: targetIds } },
      select: { slug: true },
    });
    if (survivors.length > 0) {
      throw new Error(
        `Prune incomplete — still present after the delete: ${survivors.map((row) => row.slug).join(", ")}`,
      );
    }

    const [after, variantCount, mediaCount] = await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.productMedia.count(),
    ]);

    console.log("");
    console.log("Prune summary");
    console.log(`  deleted        ${String(deleted)} product(s)`);
    console.log(`  products       ${String(before)} -> ${String(after)}`);
    console.log(`  variants       ${String(variantCount)}`);
    console.log(`  media          ${String(mediaCount)}`);
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `The prune of ${String(targetIds.length)} product(s) reached the database and its outcome is ` +
        `UNKNOWN — the DELETE may have committed. Failure: ${detail}\n` +
        'Do NOT re-run to "retry" until you have looked: query the ids in the backup at ' +
        `${backupPath} and check whether they are still there. That file holds everything the ` +
        "delete would have taken (products, variants, images, category links).",
      { cause: error },
    );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
