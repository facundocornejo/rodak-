/**
 * Material → swatch colour lookup for the card/PDP material pills (design D7).
 *
 * The map holds ONLY materials that actually exist in the database. An unknown
 * material resolves to `null` and the caller renders a text-only pill with no
 * colour dot. The two rejected alternatives are the reason this file exists:
 * a hash-derived colour invents a finish the workshop does not sell, and a
 * neutral grey dot reads as a real grey finish. Degrading to "no dot" is the
 * only option that cannot lie about the product.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROVENANCE OF THIS MAP — READ BEFORE ADDING AN ENTRY
 *
 * Canonical query (the map may only be populated from its result):
 *
 *     SELECT DISTINCT material FROM "ProductVariant" ORDER BY material;
 *
 * No database was running when this shipped, so the same values were derived
 * from the committed catalog snapshot the importer replays into
 * `ProductVariant` — `data/woo-snapshot/snapshot.json`, `fetchedAt`
 * `2026-07-22T13:46:29.855Z`, `counts` 88 products — by running every product
 * through `scripts/catalog/transform.ts#transformProduct` (the exact function
 * `scripts/catalog/import.ts` uses to build variant rows) and collecting
 * `variant.material`.
 *
 * RESULT (272 variants over 88 products):
 *
 *     material
 *     ---------
 *     NULL          -- 272 of 272 variants
 *     (0 non-null distinct values)
 *
 * The origin catalog carries a single variation attribute, "Medida (mm)"
 * (104 distinct values); it has no material/madera/acabado attribute at all, so
 * `mapAttributes` leaves `material` null for every variant. The map is
 * therefore EMPTY ON PURPOSE, and `materialToken` currently returns `null` for
 * every input — the honest degradation path is the only path in production
 * today.
 *
 * Consequences for later PRs: `ProductCardDTO.materials` is always `[]`, so no
 * swatch row renders on any card, and the PDP renders no material selector.
 * Do NOT "fix" that by inventing entries here — the fix is either a real
 * material attribute in the origin catalog (re-export + re-import) or owner-
 * supplied data. Re-run the query above after any such change.
 * ────────────────────────────────────────────────────────────────────────────
 */

/**
 * Comparison form for a material name: decompose, drop combining marks,
 * lowercase, collapse internal whitespace. "Paraíso", "PARAISO" and
 * " paraiso " must hit the same entry.
 *
 * Deliberately independent of `search/rank.ts`'s normalizer even though the
 * expression is the same: search folding is tuned for recall and may change,
 * and a change there must not silently repaint swatches.
 */
export function normalizeMaterial(material: string): string {
  return material
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * Normalized material name → OKLCH colour for its swatch dot. Values are raw
 * OKLCH so a component can hand them to a CSS custom property; they are not
 * `var(--…)` names because `tokens.css` intentionally has no per-material
 * tokens (the palette there is the editorial theme, not a wood chart).
 *
 * Empty by construction — see the provenance block above. Keys MUST be written
 * in normalized form; `materials.test.ts` fails if one is not.
 *
 * A `Map`, not an object literal: with a plain object, a material named
 * "constructor" or "toString" resolves through the prototype chain and would
 * hand a *function* to a CSS custom property. A `Map` has no such keys.
 */
export const MATERIAL_TOKENS: ReadonlyMap<string, string> = new Map<string, string>([
  // Intentionally empty. Populate only from the query documented above.
]);

/**
 * Swatch colour for a material, or `null` when there is none to show.
 *
 * `null` covers every honest "no colour" case: an unmapped material, a variant
 * with no material at all (`null`/`undefined`), and a blank string. The caller
 * renders the label with no dot in all of them.
 */
export function materialToken(material: string | null | undefined): string | null {
  if (material === null || material === undefined) return null;

  const key = normalizeMaterial(material);
  if (key === "") return null;

  return MATERIAL_TOKENS.get(key) ?? null;
}
