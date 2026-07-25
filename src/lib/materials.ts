/**
 * Material → swatch colour lookup for the card/PDP material pills (design D7).
 *
 * An unknown material resolves to `null` and the caller renders a text-only
 * pill with no colour dot. The two rejected alternatives are the reason this
 * file exists: a hash-derived colour invents a finish the workshop does not
 * sell, and a neutral grey dot reads as a real grey finish. Degrading to
 * "no dot" is the only option that cannot lie about the product.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * PROVENANCE OF THIS MAP — READ BEFORE ADDING AN ENTRY
 *
 * `SELECT DISTINCT material FROM "ProductVariant"` returns a single row:
 * `NULL`, 272 of 272 variants (verified against the committed catalog
 * snapshot, `data/woo-snapshot/snapshot.json`, `fetchedAt`
 * `2026-07-22T13:46:29.855Z`, 88 products, replayed through
 * `scripts/catalog/transform.ts#transformProduct`). The origin catalog carries
 * a single variation attribute, "Medida (mm)"; it has no material/madera/
 * acabado attribute at all, so `mapAttributes` leaves `material` null for
 * every variant today. **No product in the database carries a material.**
 *
 * The owner has nonetheless decided (PR4a) to pre-populate this map with the
 * wood species and lacquer finishes an Argentine solid-wood furniture
 * workshop plausibly offers, each mapped to an OKLCH colour that resembles
 * the real material. This is deliberately NOT "inventing material data for a
 * product": no row in `ProductVariant`, no fixture and no test pretends any
 * SKU has one of these materials. `materialToken()` still returns `null` for
 * every value that actually reaches it in production, because
 * `ProductCardDTO.materials` is `[]` for all 88 products and
 * `ProductVariantDTO.material` is `null` for all 272 variants — `SwatchRow`
 * therefore renders nothing today regardless of this map's contents. The
 * entries exist so that the day a real `material` value is loaded into the
 * database (re-export with a material attribute, or an owner-supplied
 * backfill), a swatch appears immediately with no code change here.
 *
 * Re-run the query above after any catalog change that adds a material
 * attribute, and extend this map from the real distinct values it returns —
 * do not extend it from guesses at that point; the guesses live here only
 * because there is nothing real to read yet.
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
 * Plausible woods/finishes only — see the provenance block above for why
 * these are here despite no product carrying a material today. Keys MUST be
 * written in normalized form; `materials.test.ts` fails if one is not.
 *
 * A `Map`, not an object literal: with a plain object, a material named
 * "constructor" or "toString" resolves through the prototype chain and would
 * hand a *function* to a CSS custom property. A `Map` has no such keys.
 */
export const MATERIAL_TOKENS: ReadonlyMap<string, string> = new Map<string, string>([
  ["roble", "oklch(0.62 0.045 60)"], // roble (oak) — warm medium tan-brown
  ["nogal", "oklch(0.38 0.045 50)"], // nogal (walnut) — dark chocolate brown
  ["paraiso", "oklch(0.78 0.06 80)"], // paraíso (chinaberry) — light honeyed gold
  ["guatambu", "oklch(0.88 0.02 85)"], // guatambú — pale cream, near-white
  ["petiribi", "oklch(0.5 0.06 40)"], // petiribí — reddish mid-brown
  ["lenga", "oklch(0.68 0.035 45)"], // lenga — light pinkish tan
  ["pino", "oklch(0.82 0.04 90)"], // pino (pine) — pale straw yellow
  ["cedro", "oklch(0.55 0.07 35)"], // cedro (cedar) — reddish auburn
  ["wengue", "oklch(0.28 0.03 50)"], // wengué — near-black exotic brown
  ["laqueado blanco", "oklch(0.97 0.005 90)"], // white lacquer finish
  ["laqueado negro", "oklch(0.18 0.005 90)"], // black lacquer finish
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
