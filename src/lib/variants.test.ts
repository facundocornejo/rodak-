import { describe, expect, it } from "vitest";

import type { ProductVariantDTO } from "@/lib/data/products";

import { defaultSelection, deriveVariantOptions, isConsultPrice, selectVariant } from "./variants";

function variant(overrides: Partial<ProductVariantDTO> = {}): ProductVariantDTO {
  return {
    sku: "RODAK-1",
    material: null,
    sizeMm: null,
    priceCents: 38990000,
    salePriceCents: null,
    inStock: true,
    ...overrides,
  };
}

// Two dimensions, deliberately NOT a full cross product: (Paraíso, 1200) has no
// variant, which is the impossible-pair case D8 requires to stay visible.
const twoDimensional: ProductVariantDTO[] = [
  variant({ sku: "A-1", material: "Roble", sizeMm: "1000x600" }),
  variant({ sku: "A-2", material: "Roble", sizeMm: "1200x600" }),
  variant({ sku: "A-3", material: "Paraíso", sizeMm: "1000x600" }),
];

// What the real catalog looks like today: material is null on all 272 variants.
const sizeOnly: ProductVariantDTO[] = [
  variant({ sku: "B-1", sizeMm: "1000x400x600 (Ancho x profundidad x alto )" }),
  variant({ sku: "B-2", sizeMm: "1200x400x600 (Ancho x profundidad x alto )" }),
];

describe("deriveVariantOptions", () => {
  it("derives both dimensions in DAL order, first seen first", () => {
    expect(deriveVariantOptions(twoDimensional)).toEqual({
      materials: ["Roble", "Paraíso"],
      sizes: ["1000x600", "1200x600"],
    });
  });

  it("does not re-sort values into alphabetical order", () => {
    const options = deriveVariantOptions([
      variant({ sku: "z", material: "Roble" }),
      variant({ sku: "a", material: "Guatambú" }),
    ]);

    expect(options.materials).toEqual(["Roble", "Guatambú"]);
  });

  it("returns no material options when every variant has a null material", () => {
    const options = deriveVariantOptions(sizeOnly);

    // Empty array = the PDP renders NO material selector at all.
    expect(options.materials).toEqual([]);
    expect(options.sizes).toHaveLength(2);
  });

  it("returns no options at all for a single dimensionless variant", () => {
    expect(deriveVariantOptions([variant()])).toEqual({ materials: [], sizes: [] });
  });

  it("treats a blank value as missing data, not as an unlabelled option", () => {
    expect(deriveVariantOptions([variant({ material: "  " }), variant({ material: "Roble" })])).toEqual(
      { materials: ["Roble"], sizes: [] },
    );
  });

  it("deduplicates repeated values", () => {
    const options = deriveVariantOptions([
      variant({ sku: "a", material: "Roble", sizeMm: "1000" }),
      variant({ sku: "b", material: "Roble", sizeMm: "1000" }),
    ]);

    expect(options).toEqual({ materials: ["Roble"], sizes: ["1000"] });
  });

  it("returns empty dimensions for an empty variant list", () => {
    expect(deriveVariantOptions([])).toEqual({ materials: [], sizes: [] });
  });
});

describe("selectVariant", () => {
  it("resolves an existing pair", () => {
    expect(selectVariant(twoDimensional, { material: "Roble", sizeMm: "1200x600" })?.sku).toBe(
      "A-2",
    );
  });

  it("returns null for a pair with no variant, so the option is disabled and not hidden", () => {
    const options = deriveVariantOptions(twoDimensional);

    // The impossible pair's parts are BOTH still offered as options...
    expect(options.materials).toContain("Paraíso");
    expect(options.sizes).toContain("1200x600");
    // ...and only the combination is unavailable.
    expect(selectVariant(twoDimensional, { material: "Paraíso", sizeMm: "1200x600" })).toBeNull();
  });

  it("matches null against null, so a dimensionless product still resolves", () => {
    expect(selectVariant(sizeOnly, { material: null, sizeMm: sizeOnly[0].sizeMm })?.sku).toBe(
      "B-1",
    );
  });

  it("does not treat null as a wildcard", () => {
    expect(selectVariant(twoDimensional, { material: null, sizeMm: "1000x600" })).toBeNull();
  });

  it("returns the first match in DAL order when a pair is duplicated", () => {
    const duplicated: ProductVariantDTO[] = [
      variant({ sku: "DUP-1", material: "Roble", sizeMm: "1000" }),
      variant({ sku: "DUP-1-2", material: "Roble", sizeMm: "1000" }),
    ];

    expect(selectVariant(duplicated, { material: "Roble", sizeMm: "1000" })?.sku).toBe("DUP-1");
  });

  it("returns null for an empty variant list", () => {
    expect(selectVariant([], { material: null, sizeMm: null })).toBeNull();
  });
});

describe("defaultSelection", () => {
  it("opens on the first variant in DAL order", () => {
    expect(defaultSelection(twoDimensional)).toEqual({ material: "Roble", sizeMm: "1000x600" });
  });

  it("always resolves to a real variant", () => {
    expect(selectVariant(twoDimensional, defaultSelection(twoDimensional))).not.toBeNull();
    expect(selectVariant(sizeOnly, defaultSelection(sizeOnly))).not.toBeNull();
  });

  it("returns both dimensions null for a product with no variants", () => {
    expect(defaultSelection([])).toEqual({ material: null, sizeMm: null });
  });
});

describe("isConsultPrice [INV-1]", () => {
  it("is true when priceCents is 0", () => {
    expect(isConsultPrice(variant({ priceCents: 0 }))).toBe(true);
  });

  it("is false for a priced variant", () => {
    expect(isConsultPrice(variant({ priceCents: 1 }))).toBe(false);
    expect(isConsultPrice(variant({ priceCents: 38990000 }))).toBe(false);
  });

  it("is true for a negative price, which must never be formatted as money", () => {
    expect(isConsultPrice(variant({ priceCents: -100 }))).toBe(true);
  });

  it("ignores salePriceCents (a sale on a quote-only variant is still a quote)", () => {
    expect(isConsultPrice(variant({ priceCents: 0, salePriceCents: 500 }))).toBe(true);
  });
});
