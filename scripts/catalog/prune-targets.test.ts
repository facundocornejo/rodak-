import { describe, expect, it } from "vitest";

import { partitionByCutoff, selectTargets } from "./prune-targets";
import type { RawProduct, Snapshot } from "./types";

// These guards are the only thing between a stale report and an irreversible
// DELETE with a cascade behind it, so every rejection path is exercised here.
// The happy path is the least interesting test in this file.

function product(slug: string): RawProduct {
  // Only `slug` is read by the guards; the rest is filler that keeps the value
  // a real RawProduct so a drift in types.ts fails typecheck instead of hiding.
  return {
    id: 1,
    name: slug,
    slug,
    permalink: `https://rodak.ar/producto/${slug}/`,
    sku: slug.toUpperCase(),
    type: "simple",
    prices: {
      currency_minor_unit: 2,
      price: "1000.00",
      regular_price: "1000.00",
      sale_price: "1000.00",
      on_sale: false,
    },
    is_in_stock: true,
    images: [],
    categories: [],
    attributes: [],
    variations: [],
  };
}

function snapshotOf(slugs: string[]): Snapshot {
  return {
    fetchedAt: "2026-07-22T13:00:00.000Z",
    source: "https://rodak.ar/wp-json/wc/store/v1",
    counts: { xWpTotal: slugs.length, sitemap: slugs.length, products: slugs.length },
    sitemapSlugs: slugs,
    products: slugs.map(product),
  };
}

describe("selectTargets", () => {
  const snapshot = snapshotOf(["mesa-varena", "recibidor-varena"]);

  it("returns the removed-at-origin slugs, sorted", () => {
    const targets = selectTargets(
      { removedAtOrigin: ["soporte-celular", "cajonera-kendall"], counts: { snapshot: 2, db: 4 } },
      snapshot,
    );

    expect(targets).toEqual(["cajonera-kendall", "soporte-celular"]);
  });

  it("returns an empty list when the import reported nothing removed", () => {
    expect(selectTargets({ removedAtOrigin: [], counts: { snapshot: 2, db: 2 } }, snapshot)).toEqual([]);
  });

  it("refuses a report whose product count disagrees with the snapshot", () => {
    // The snapshot was re-exported after the report was written: it may now
    // publish a product the report still lists as removed.
    expect(() =>
      selectTargets({ removedAtOrigin: ["soporte-celular"], counts: { snapshot: 88, db: 93 } }, snapshot),
    ).toThrow(/different\s+runs/);
  });

  it("refuses a report with no counts instead of skipping the check", () => {
    // Fails closed: an older or hand-edited report cannot be matched against
    // the snapshot at all, which is a reason to stop, not to proceed.
    expect(() => selectTargets({ removedAtOrigin: ["soporte-celular"] }, snapshot)).toThrow(
      /counts\.snapshot/,
    );
  });

  it("refuses to target a slug the snapshot still publishes", () => {
    expect(() =>
      selectTargets({ removedAtOrigin: ["mesa-varena"], counts: { snapshot: 2, db: 3 } }, snapshot),
    ).toThrow(/still publishes: mesa-varena/);
  });

  it("refuses a report that is not an object or has no removedAtOrigin array", () => {
    expect(() => selectTargets(null, snapshot)).toThrow(/not a JSON object/);
    expect(() => selectTargets({ counts: { snapshot: 2, db: 2 } }, snapshot)).toThrow(
      /removedAtOrigin/,
    );
  });
});

describe("partitionByCutoff", () => {
  const cutoff = new Date("2026-07-22T13:00:00.000Z"); // snapshot.fetchedAt
  const old = new Date("2026-07-19T00:03:52.715Z");
  const afterwards = new Date("2026-07-24T18:00:00.000Z");

  it("keeps rows untouched since the snapshot was taken", () => {
    const rows = [
      { slug: "soporte-celular", createdAt: old, updatedAt: old },
      { slug: "cajonera-kendall", createdAt: old, updatedAt: cutoff },
    ];

    const { prunable, touched } = partitionByCutoff(rows, cutoff);

    expect(prunable.map((row) => row.slug)).toEqual(["soporte-celular", "cajonera-kendall"]);
    expect(touched).toEqual([]);
  });

  it("excludes a row created after the snapshot — an import re-created it", () => {
    const rows = [
      { slug: "soporte-celular", createdAt: old, updatedAt: old },
      { slug: "cajonera-kendall", createdAt: afterwards, updatedAt: afterwards },
    ];

    const { prunable, touched } = partitionByCutoff(rows, cutoff);

    expect(prunable.map((row) => row.slug)).toEqual(["soporte-celular"]);
    expect(touched.map((row) => row.slug)).toEqual(["cajonera-kendall"]);
  });

  it("excludes a row resurrected in place — same id, only updatedAt moved", () => {
    // The import's rename path updates the existing row instead of creating
    // one, so `createdAt` alone would wave this live product through.
    const rows = [{ slug: "cajonera-kendall", createdAt: old, updatedAt: afterwards }];

    const { prunable, touched } = partitionByCutoff(rows, cutoff);

    expect(prunable).toEqual([]);
    expect(touched.map((row) => row.slug)).toEqual(["cajonera-kendall"]);
  });
});
