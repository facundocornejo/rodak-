import type { ProductVariantDTO } from "@/lib/data/products";

/**
 * Pure variant logic for the PDP option selectors (design D8, D8b).
 *
 * The only import is a TYPE from the DAL, which the bundler erases: this module
 * never pulls `server-only` or Prisma into a Client Component, and it runs in
 * the plain node test project.
 *
 * Real-catalog note (snapshot `data/woo-snapshot/snapshot.json`, fetched
 * 2026-07-22): all 272 variants have `material === null` and only `sizeMm`
 * varies (104 distinct values, 10 variants with no size either). The
 * "dimension with no values renders no selector" rule below is therefore the
 * normal case today, not an edge case.
 */

/** A dimension the user can pick. `null` = the product does not vary on it. */
export interface VariantSelection {
  material: string | null;
  sizeMm: string | null;
}

export interface VariantOptions {
  /**
   * Distinct non-empty `material` values in DAL order (`sku asc`), first seen
   * first. Empty when no variant carries a material.
   */
  materials: string[];
  /** Same, for `sizeMm`. */
  sizes: string[];
}

/**
 * Distinct values of one dimension, in first-seen order.
 *
 * First-seen (rather than sorted) keeps the selector in the DAL's `sku asc`
 * order, which is stable across requests; re-sorting here would need a
 * locale-dependent comparison of free-form values like
 * "1000x400x600 (Ancho x profundidad x alto )".
 *
 * Blank strings are treated as absent: an attribute imported as `""` is missing
 * data, and rendering an unlabelled option would be worse than rendering none.
 */
function distinct(values: (string | null)[]): string[] {
  const seen: string[] = [];

  for (const value of values) {
    if (value !== null && value.trim() !== "" && !seen.includes(value)) {
      seen.push(value);
    }
  }

  return seen;
}

/**
 * Options to render for a product. A dimension whose values are all `null`
 * yields an empty array — the caller renders NO selector for it rather than a
 * one-item control or an empty dropdown.
 */
export function deriveVariantOptions(variants: readonly ProductVariantDTO[]): VariantOptions {
  return {
    materials: distinct(variants.map((variant) => variant.material)),
    sizes: distinct(variants.map((variant) => variant.sizeMm)),
  };
}

/**
 * The variant matching a selection, or `null` when that combination does not
 * exist in the catalog.
 *
 * `null` is the DISABLED signal, never a reason to hide the option (design D8,
 * Baymard): the PDP keeps every derived option in the DOM and marks the
 * impossible ones `aria-disabled`, so the product's real range stays visible.
 * A caller decides whether option `m` is selectable by asking
 * `selectVariant(variants, { material: m, sizeMm: currentSize }) !== null`.
 *
 * The first match in DAL order (`sku asc`) wins. That matters: the importer
 * resolves duplicate SKUs with `-2`/`-3` suffixes, so two variants CAN share the
 * same (material, sizeMm) pair, and picking the first keeps the rendered price
 * and SKU stable across requests.
 */
export function selectVariant(
  variants: readonly ProductVariantDTO[],
  selection: VariantSelection,
): ProductVariantDTO | null {
  return (
    variants.find(
      (variant) =>
        variant.material === selection.material && variant.sizeMm === selection.sizeMm,
    ) ?? null
  );
}

/**
 * Selection the PDP starts on: the first variant in DAL order, so the page
 * always opens on a real, priced, resolvable variant instead of an empty state.
 *
 * Returns both dimensions as `null` for a product with no variants — which the
 * importer forbids (it refuses to store a product without at least one priced
 * variant), so this is a defensive default, not an expected state.
 */
export function defaultSelection(variants: readonly ProductVariantDTO[]): VariantSelection {
  const first = variants[0];

  return {
    material: first?.material ?? null,
    sizeMm: first?.sizeMm ?? null,
  };
}

/**
 * Whether this variant must render "Consultar precio" instead of a price
 * [INV-1, design D8b]. NEVER "$0", "gratis" or a blank price row.
 *
 * The test is `<= 0`, not `=== 0`: it matches the DAL, which already excludes
 * every `priceCents <= 0` variant from a card's "desde" price. A negative price
 * is corrupt origin data, and formatting it as "-$1.000" would be the one
 * outcome worse than saying the price must be quoted.
 */
export function isConsultPrice(variant: ProductVariantDTO): boolean {
  return variant.priceCents <= 0;
}
