import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { transformProduct } from "./transform";
import type { PreparedProduct, RawProduct, Snapshot } from "./types";

// Database step of the catalog migration: reads the gitignored snapshot written
// by `export.ts`, runs it through the pure transform, and upserts it into
// Postgres. Re-runnable by design — products are keyed by `slug`, variants by
// `sku`, so a second run updates rows instead of duplicating them.
//
// Run: DATABASE_URL="postgresql://..." npm run catalog:import
//
// Two hard contracts this file must never break:
// - the `stock` column is NEVER written (it has no Fase-1 data source; `inStock`
//   is the only authoritative availability signal — see design D1);
// - a product that exists in the database but not in the snapshot is REPORTED,
//   never deleted.

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Pass it inline when running the import, e.g.\n" +
      '  DATABASE_URL="postgresql://..." npm run catalog:import',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const SNAPSHOT_DIR = join(process.cwd(), "data", "woo-snapshot");
const SNAPSHOT_PATH = join(SNAPSHOT_DIR, "snapshot.json");
const REPORT_PATH = join(SNAPSHOT_DIR, "reconciliation-report.json");

// One product's writes are a handful of round trips; the 5s Prisma default is
// tight for a cold local container, and a timeout here would abort a run that
// has nothing wrong with it.
const TRANSACTION_TIMEOUT_MS = 30_000;

interface ReconciliationReport {
  removedAtOrigin: string[];
  zeroPriced: string[];
  created: number;
  updated: number;
  counts: { snapshot: number; db: number };
}

/**
 * Variants the origin publishes at price 0 are the "A medida (consultar)"
 * made-to-order options: real catalog entries whose price is quoted per job.
 * They are imported as-is (owner's decision) rather than dropped, but they are
 * NOT allowed to blend in — every one is listed in the reconciliation report and
 * warned about on stdout, because a 0 that reaches a price tag reads as "free".
 * Whatever renders prices in Fase 2 must special-case `priceCents === 0`.
 */
function collectZeroPriced(products: PreparedProduct[]): string[] {
  return products
    .flatMap((product) =>
      product.variants
        .filter((variant) => variant.priceCents === 0)
        .map((variant) => `${product.slug} / ${variant.sku}`),
    )
    .sort();
}

/**
 * Raises one error listing EVERY problem found by a validation stage.
 *
 * Stopping at the first failure would turn a data fix over the whole catalog
 * into a dozen round trips; every message is prefixed with the check that failed and
 * names the product (and sku) at fault, because an error that cannot be traced
 * back to a row is the expensive kind.
 */
function assertNoProblems(stage: string, problems: string[]): void {
  if (problems.length === 0) return;

  throw new Error(
    `${stage} failed with ${String(problems.length)} problem(s):\n` +
      problems.map((problem) => `  - ${problem}`).join("\n"),
  );
}

/**
 * Reads the snapshot from disk. The structural checks here are deliberately
 * shallow — `export.ts` already asserts the payload shape before writing — but
 * they stop a truncated or hand-edited file from crashing later with an
 * unattributable `undefined` error.
 */
function readSnapshot(): Snapshot {
  if (!existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      `No snapshot at ${SNAPSHOT_PATH}.\n` +
        "Run `npm run catalog:export` first — the import never touches the network, " +
        "it only replays the snapshot that export writes.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(SNAPSHOT_PATH, "utf8"));
  } catch (error: unknown) {
    throw new Error(
      `Snapshot at ${SNAPSHOT_PATH} is not valid JSON. Re-run \`npm run catalog:export\`.`,
      { cause: error },
    );
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error(`Snapshot at ${SNAPSHOT_PATH} is not an object. Re-run \`npm run catalog:export\`.`);
  }

  const candidate = parsed as Partial<Snapshot>;
  const problems: string[] = [];

  if (typeof candidate.fetchedAt !== "string" || candidate.fetchedAt.trim() === "") {
    problems.push("[fetchedAt] missing or empty — the snapshot has no provenance timestamp.");
  }
  if (!Array.isArray(candidate.products)) {
    problems.push("[products] missing or not an array.");
  }
  if (!Array.isArray(candidate.sitemapSlugs)) {
    problems.push("[sitemapSlugs] missing or not an array.");
  }
  if (typeof candidate.counts !== "object" || candidate.counts === null) {
    problems.push("[counts] missing — the completeness gate cannot run without it.");
  }

  assertNoProblems(`Snapshot at ${SNAPSHOT_PATH} is malformed`, problems);

  return candidate as Snapshot;
}

/**
 * Pre-import gate over the RAW snapshot: completeness, provenance and the facts
 * the transform is entitled to assume. Runs before a single row is written.
 */
function validateSnapshot(snapshot: Snapshot): void {
  const problems: string[] = [];

  if (snapshot.products.length !== snapshot.counts.xWpTotal) {
    problems.push(
      `[counts] snapshot holds ${String(snapshot.products.length)} product(s) but counts.xWpTotal is ` +
        `${String(snapshot.counts.xWpTotal)} — the export was partial; re-run \`npm run catalog:export\`.`,
    );
  }

  const seenSlugs = new Set<string>();
  const duplicateSlugs = new Set<string>();
  for (const product of snapshot.products) {
    if (seenSlugs.has(product.slug)) duplicateSlugs.add(product.slug);
    seenSlugs.add(product.slug);
  }
  for (const slug of duplicateSlugs) {
    problems.push(
      `[slug-uniqueness] slug "${slug}" appears more than once in the snapshot; the import upserts ` +
        "products by slug, so the rows would silently overwrite each other.",
    );
  }

  for (const slug of snapshot.sitemapSlugs) {
    if (!seenSlugs.has(slug)) {
      problems.push(
        `[sitemap] "${slug}" is published in the sitemap but absent from the snapshot (under-import).`,
      );
    }
  }

  for (const product of snapshot.products) {
    const label = `product ${String(product.id)} (${product.slug})`;

    if (!Number.isInteger(product.id) || product.id <= 0) {
      problems.push(`[wooId] ${label} has no usable WooCommerce id; provenance would be lost.`);
    }
    if (product.name.trim() === "") {
      problems.push(`[name] ${label} has an empty name.`);
    }
    if (product.prices.currency_minor_unit !== 2) {
      problems.push(
        `[currency] ${label} reports currency_minor_unit=${String(product.prices.currency_minor_unit)} ` +
          "(expected 2); the cents parser refuses to guess where the decimal point goes.",
      );
    }
    for (const variation of product.variations) {
      if (variation.prices.currency_minor_unit !== 2) {
        problems.push(
          `[currency] ${label} variation ${String(variation.id)} reports ` +
            `currency_minor_unit=${String(variation.prices.currency_minor_unit)} (expected 2).`,
        );
      }
    }
  }

  assertNoProblems("Pre-import snapshot validation", problems);
}

/**
 * Runs the pure transform over every product, collecting failures instead of
 * aborting on the first one. Nothing has been written yet at this point, so a
 * full list of broken products is strictly more useful than the first message.
 */
function transformAll(products: RawProduct[]): PreparedProduct[] {
  const prepared: PreparedProduct[] = [];
  const problems: string[] = [];

  for (const raw of products) {
    try {
      // `transformProduct` already prefixes its errors with the product id and slug.
      prepared.push(transformProduct(raw));
    } catch (error: unknown) {
      problems.push(error instanceof Error ? error.message : String(error));
    }
  }

  assertNoProblems("Transform", problems);
  return prepared;
}

/**
 * Pre-import gate over the PREPARED model: the money and identity invariants the
 * database itself cannot express.
 */
function validatePrepared(products: PreparedProduct[]): void {
  const problems: string[] = [];
  const skuOwner = new Map<string, string>();

  for (const product of products) {
    if (product.variants.length === 0) {
      problems.push(
        `[variants] product ${product.slug} has no variants; it would reach the catalog with no price.`,
      );
    }

    for (const variant of product.variants) {
      const label = `product ${product.slug} / sku ${variant.sku}`;

      // 0 is allowed and means "quoted on request" (see collectZeroPriced); a
      // negative or fractional amount is always a parsing bug.
      if (!Number.isInteger(variant.priceCents) || variant.priceCents < 0) {
        problems.push(
          `[price] ${label} has priceCents=${String(variant.priceCents)}; expected a whole number of cents, 0 or more.`,
        );
      }

      const sale = variant.salePriceCents;
      if (sale !== null) {
        if (!Number.isInteger(sale) || sale <= 0) {
          problems.push(
            `[sale-price] ${label} has salePriceCents=${String(sale)}; expected null or an integer above 0.`,
          );
        } else if (sale >= variant.priceCents) {
          problems.push(
            `[sale-price] ${label} has salePriceCents=${String(sale)} but priceCents=` +
              `${String(variant.priceCents)}; a discount must be cheaper than the regular price.`,
          );
        }
      }

      const owner = skuOwner.get(variant.sku);
      if (owner === undefined) {
        skuOwner.set(variant.sku, product.slug);
      } else {
        problems.push(
          `[sku-uniqueness] sku "${variant.sku}" is claimed by both ${owner} and ${product.slug}; ` +
            "sku is globally unique in the database, so the second product would steal the first one's row.",
        );
      }
    }
  }

  assertNoProblems("Pre-import prepared-model validation", problems);
}

/**
 * Every distinct category in the snapshot, slug → name. First occurrence wins,
 * which is deterministic because the snapshot is ordered: a slug carrying two
 * different names at the origin is source noise, not a fact worth flip-flopping
 * between runs.
 */
function collectCategories(products: PreparedProduct[]): Map<string, string> {
  const names = new Map<string, string>();

  for (const product of products) {
    for (const category of product.categories) {
      if (!names.has(category.slug)) names.set(category.slug, category.name);
    }
  }

  return names;
}

/**
 * Writes one product and everything hanging off it inside a single transaction:
 * either the product, its category links, its variants and its media all match
 * the snapshot, or none of them changed. Per-product (rather than one giant
 * transaction) keeps lock windows short while still making each product atomic.
 *
 * Note `categories: { set: … }` on update — a full replace. `connect` alone
 * only ever adds links, so a category removed at the origin would linger
 * forever (the exact staleness bug `prisma/seed.ts` still has).
 *
 * The `stock` column is intentionally absent from every write below.
 */
async function importProduct(
  product: PreparedProduct,
  categoryIdBySlug: Map<string, string>,
): Promise<void> {
  const categoryIds = product.categories.map((category) => {
    const id = categoryIdBySlug.get(category.slug);
    if (id === undefined) {
      throw new Error(`category "${category.slug}" was never upserted; refusing to drop its link.`);
    }
    return { id };
  });

  const skus = product.variants.map((variant) => variant.sku);
  // The schema stores "no description" as NULL; an empty string would be a
  // neutral-looking value that reads as a real (blank) description.
  const description = product.description === "" ? null : product.description;

  await prisma.$transaction(
    async (tx) => {
      const fields = {
        name: product.name,
        description,
        wooId: product.wooId,
      };

      // Renaming a product in WooCommerce regenerates its slug but never its
      // numeric id. Looking the row up by `wooId` FIRST is what makes that a
      // rename instead of a crash: upserting by slug alone would take the
      // create path and try to insert a second row carrying an already-taken
      // unique `wooId`, aborting this run and every re-run after it.
      const renamed = await tx.product.findUnique({ where: { wooId: product.wooId } });

      const row =
        renamed === null
          ? await tx.product.upsert({
              where: { slug: product.slug },
              update: { ...fields, categories: { set: categoryIds } },
              create: { ...fields, slug: product.slug, categories: { connect: categoryIds } },
            })
          : await tx.product.update({
              where: { id: renamed.id },
              data: { ...fields, slug: product.slug, categories: { set: categoryIds } },
            });

      for (const variant of product.variants) {
        const variantFields = {
          productId: row.id,
          material: variant.material,
          sizeMm: variant.sizeMm,
          priceCents: variant.priceCents,
          salePriceCents: variant.salePriceCents,
          inStock: variant.inStock,
          wooId: variant.wooId,
        };

        // Same rename problem one level down: a variation keeps its id while its
        // derived sku changes (an attribute value edited at the origin). Only
        // real variations have a wooId — synthesized single variants carry null,
        // which no lookup can match, so those fall through to the sku upsert.
        const renamedVariant =
          variant.wooId === null
            ? null
            : await tx.productVariant.findUnique({ where: { wooId: variant.wooId } });

        if (renamedVariant === null) {
          await tx.productVariant.upsert({
            where: { sku: variant.sku },
            update: variantFields,
            create: { ...variantFields, sku: variant.sku },
          });
        } else {
          await tx.productVariant.update({
            where: { id: renamedVariant.id },
            data: { ...variantFields, sku: variant.sku },
          });
        }
      }

      // Variants dropped at the origin. Scoped to this product, so a sku that
      // legitimately moved to another product is not collected here.
      await tx.productVariant.deleteMany({
        where: { productId: row.id, sku: { notIn: skus } },
      });

      // Media has no stable business key (a url can repeat, there is no wooId),
      // so it is replaced wholesale. Inside the transaction there is never a
      // window where the product is visible with zero images.
      await tx.productMedia.deleteMany({ where: { productId: row.id } });
      if (product.media.length > 0) {
        await tx.productMedia.createMany({
          data: product.media.map((item, index) => ({
            productId: row.id,
            url: item.url,
            alt: item.alt,
            position: index,
          })),
        });
      }
    },
    { timeout: TRANSACTION_TIMEOUT_MS },
  );
}

/**
 * Post-import gate. Re-reads the database rather than trusting the counters the
 * run kept in memory, so a write that silently did nothing still fails the run.
 */
async function assertImported(
  products: PreparedProduct[],
  removedAtOrigin: string[],
): Promise<number> {
  const rows = await prisma.product.findMany({
    select: { slug: true, wooId: true, _count: { select: { variants: true, media: true } } },
  });
  const rowBySlug = new Map(rows.map((row) => [row.slug, row]));
  const problems: string[] = [];

  for (const product of products) {
    const row = rowBySlug.get(product.slug);
    if (row === undefined) {
      problems.push(`[missing] ${product.slug} is in the snapshot but not in the database after the import.`);
      continue;
    }
    // Equality, not just non-null: a wrong id is as broken as a missing one, and
    // a non-null check would wave through a row still carrying a stale wooId.
    if (row.wooId !== product.wooId) {
      problems.push(
        `[wooId] ${product.slug} stored wooId=${String(row.wooId)} but the snapshot says ` +
          `${String(product.wooId)}; provenance is broken.`,
      );
    }
    if (row._count.variants !== product.variants.length) {
      problems.push(
        `[variants] ${product.slug} has ${String(row._count.variants)} variant(s) in the database but ` +
          `${String(product.variants.length)} in the snapshot.`,
      );
    }
    if (row._count.media !== product.media.length) {
      problems.push(
        `[media] ${product.slug} has ${String(row._count.media)} image(s) in the database but ` +
          `${String(product.media.length)} in the snapshot.`,
      );
    }
  }

  // Accounting identity. Products absent from the snapshot are kept on purpose
  // (reconciliation is report-only), so they are expected here — but they are the
  // ONLY rows allowed to make the totals differ. Anything else is a bug.
  const expected = products.length + removedAtOrigin.length;
  if (rows.length !== expected) {
    problems.push(
      `[count] the database holds ${String(rows.length)} product(s); expected ${String(expected)} ` +
        `(${String(products.length)} from the snapshot + ${String(removedAtOrigin.length)} kept as removed-at-origin).`,
    );
  }

  assertNoProblems("Post-import validation", problems);
  return rows.length;
}

async function main(): Promise<void> {
  const snapshot = readSnapshot();
  console.log(
    `Snapshot fetched at ${snapshot.fetchedAt} from ${snapshot.source} — ` +
      `${String(snapshot.products.length)} product(s).`,
  );

  validateSnapshot(snapshot);
  const products = transformAll(snapshot.products);
  validatePrepared(products);
  console.log("Validation gates passed.");

  // Categories first: the product upsert links to ids that must already exist.
  const categoryNames = collectCategories(products);
  const categoryIdBySlug = new Map<string, string>();
  for (const [slug, name] of categoryNames) {
    const category = await prisma.category.upsert({
      where: { slug },
      update: { name },
      create: { slug, name },
    });
    categoryIdBySlug.set(slug, category.id);
  }
  console.log(`Categories upserted: ${String(categoryIdBySlug.size)}.`);

  // Captured BEFORE the writes: this is what "already existed" means for the
  // created/updated split. Both keys are needed — a product renamed at the
  // origin arrives under a slug nobody has seen but a wooId we already store,
  // and counting that as "created" would misreport the run.
  const preexisting = await prisma.product.findMany({ select: { slug: true, wooId: true } });
  const preexistingSlugs = new Set(preexisting.map((row) => row.slug));
  const preexistingWooIds = new Set(preexisting.map((row) => row.wooId).filter((id) => id !== null));

  let created = 0;
  let updated = 0;
  let done = 0;

  for (const product of products) {
    try {
      await importProduct(product, categoryIdBySlug);
      done += 1;
      // Each product commits in its own transaction, so a failure mid-run leaves
      // the earlier ones written. Printing the running count is what tells the
      // operator how far the catalog actually got before it stopped.
      if (done % 10 === 0 || done === products.length) {
        console.log(`  ...${String(done)}/${String(products.length)} products written`);
      }
    } catch (error: unknown) {
      // Not caught to continue — rethrown with the product named so the run
      // exits non-zero and the operator knows exactly which row to look at.
      // A partially imported catalog must never look like a success.
      const detail = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Import failed for product ${product.slug} (woo ${String(product.wooId)}) after ` +
          `${String(done)}/${String(products.length)} product(s) were already written: ${detail}\n` +
          "Those writes stand — fix the cause and re-run; the import is idempotent.",
        { cause: error },
      );
    }

    if (preexistingSlugs.has(product.slug) || preexistingWooIds.has(product.wooId)) updated += 1;
    else created += 1;
  }

  // Read back AFTER the writes rather than diffing the pre-write slugs: a
  // product renamed at the origin leaves no stale row behind (its slug was
  // updated in place), so the pre-write slug set would report a row that no
  // longer exists and the totals would never balance.
  const snapshotSlugs = new Set(products.map((product) => product.slug));
  const removedAtOrigin = (await prisma.product.findMany({ select: { slug: true } }))
    .map((row) => row.slug)
    .filter((slug) => !snapshotSlugs.has(slug))
    .sort();

  const dbProductCount = await assertImported(products, removedAtOrigin);

  const [variantCount, categoryCount, mediaCount] = await Promise.all([
    prisma.productVariant.count(),
    prisma.category.count(),
    prisma.productMedia.count(),
  ]);

  const zeroPriced = collectZeroPriced(products);

  const report: ReconciliationReport = {
    removedAtOrigin,
    zeroPriced,
    created,
    updated,
    counts: { snapshot: products.length, db: dbProductCount },
  };

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  console.log("");
  console.log("Import summary");
  console.log(`  created        ${String(created)}`);
  console.log(`  updated        ${String(updated)}`);
  console.log(`  snapshot       ${String(products.length)} product(s)`);
  console.log(`  database       ${String(dbProductCount)} product(s)`);
  console.log(`  variants       ${String(variantCount)}`);
  console.log(`  categories     ${String(categoryCount)}`);
  console.log(`  media          ${String(mediaCount)}`);
  console.log(`  removedAtOrigin ${String(removedAtOrigin.length)}`);
  console.log(`  zeroPriced     ${String(zeroPriced.length)}`);

  if (zeroPriced.length > 0) {
    console.warn(
      `WARNING: ${String(zeroPriced.length)} variant(s) were imported with priceCents=0 ` +
        '("A medida (consultar)" at the origin). Whatever renders prices must special-case ' +
        `them — a 0 shown as a price reads as free:\n` +
        zeroPriced.map((entry) => `  - ${entry}`).join("\n"),
    );
  }

  if (removedAtOrigin.length > 0) {
    // Report only, never delete: a product missing from one export can be an
    // origin outage, and deleting it would be unrecoverable from here.
    console.warn(
      `WARNING: ${String(removedAtOrigin.length)} product(s) exist in the database but not in the ` +
        `snapshot. They were KEPT — review them by hand:\n` +
        removedAtOrigin.map((slug) => `  - ${slug}`).join("\n"),
    );
  }

  console.log(`Reconciliation report written to ${REPORT_PATH}`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
