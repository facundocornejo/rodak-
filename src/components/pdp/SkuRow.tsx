"use client";

import { useVariantSelection } from "./VariantSelectionProvider";

/**
 * The currently selected variant's SKU, read from `VariantSelectionProvider`
 * — a client leaf so `SpecsTab` (a Server Component) can still show a value
 * that updates when the visitor changes the buy column's material/size
 * selection, without `SpecsTab` itself needing to be a Client Component.
 *
 * Falls back to "Sin datos." only in the defensive `selectedVariant === null`
 * case (see `variants.ts`'s `defaultSelection` docblock: the importer never
 * stores a variantless product, so this is not expected to render against
 * the real catalog).
 */
export function SkuRow() {
  const { selectedVariant } = useVariantSelection();

  return <>{selectedVariant?.sku ?? "Sin datos."}</>;
}
