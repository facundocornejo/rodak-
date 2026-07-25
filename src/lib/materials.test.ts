import { describe, expect, it } from "vitest";

import { MATERIAL_TOKENS, materialToken, normalizeMaterial } from "./materials";

describe("normalizeMaterial", () => {
  it("strips accents and lowercases", () => {
    expect(normalizeMaterial("Paraíso")).toBe("paraiso");
    expect(normalizeMaterial("GUATAMBÚ")).toBe("guatambu");
  });

  it("trims and collapses whitespace", () => {
    expect(normalizeMaterial("  Roble   macizo ")).toBe("roble macizo");
  });

  it("is idempotent", () => {
    const once = normalizeMaterial("Petiribí Natural");

    expect(normalizeMaterial(once)).toBe(once);
  });
});

describe("MATERIAL_TOKENS", () => {
  /**
   * The map is empty today because `SELECT DISTINCT material FROM
   * "ProductVariant"` yields only NULL (see the provenance block in
   * `materials.ts`). This test is the tripwire: it fails the moment someone adds
   * an entry, forcing them to re-read that block and re-run the query instead of
   * inventing a wood colour.
   */
  it("is empty, matching the real catalog's zero non-null materials", () => {
    expect(MATERIAL_TOKENS.size).toBe(0);
  });

  it.each([...MATERIAL_TOKENS])("key %s is stored in normalized form", (key) => {
    expect(key).toBe(normalizeMaterial(key));
  });

  it.each([...MATERIAL_TOKENS])("entry %s maps to an OKLCH colour", (_key, value) => {
    expect(value).toMatch(/^oklch\(/);
  });
});

describe("materialToken", () => {
  it("returns null for an unmapped material [D7]", () => {
    expect(materialToken("Petiribí no mapeado")).toBeNull();
  });

  it("returns null for every material present in the real catalog today", () => {
    // Every variant's material is NULL in the snapshot, so this IS the whole
    // production input set.
    expect(materialToken(null)).toBeNull();
  });

  it("returns null rather than a placeholder colour for missing input", () => {
    expect(materialToken(undefined)).toBeNull();
    expect(materialToken("")).toBeNull();
    expect(materialToken("   ")).toBeNull();
  });

  it("never returns an empty string, which CSS would treat as an invalid colour", () => {
    for (const input of ["Roble", "roble", "", "   ", "Paraíso"]) {
      expect(materialToken(input)).not.toBe("");
    }
  });

  it("looks entries up through the normalizer", () => {
    // Vacuous while the map is empty; it starts asserting real behaviour the
    // moment an entry exists, without hardcoding a fabricated material here.
    for (const [key, value] of MATERIAL_TOKENS) {
      expect(materialToken(key)).toBe(value);
      expect(materialToken(key.toUpperCase())).toBe(value);
      expect(materialToken(`  ${key}  `)).toBe(value);
    }
  });

  it("is not fooled by a prototype key", () => {
    // Regression guard: with an object-literal map, "constructor" resolved
    // through the prototype chain and returned `Object` — a function on its way
    // into a CSS custom property. Hence the `Map`.
    expect(materialToken("constructor")).toBeNull();
    expect(materialToken("toString")).toBeNull();
    expect(materialToken("__proto__")).toBeNull();
  });
});
