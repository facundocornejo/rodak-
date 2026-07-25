"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import type { ProductVariantDTO } from "@/lib/data/products";
import { defaultSelection, selectVariant, type VariantSelection } from "@/lib/variants";

interface VariantSelectionContextValue {
  selection: VariantSelection;
  setSelection: (next: VariantSelection) => void;
  selectedVariant: ProductVariantDTO | null;
}

const VariantSelectionContext = createContext<VariantSelectionContextValue | null>(null);

export interface VariantSelectionProviderProps {
  /** `ProductDetailDTO.variants`, `sku asc` — a flat DTO array [INV-9]. */
  variants: ProductVariantDTO[];
  children: ReactNode;
}

/**
 * Owns the PDP's in-page variant selection (design D8: no URL, no
 * persistence) and shares it between two DOM siblings that both need the
 * SAME `selectedVariant`: `ProductOptions` (the buy column) and the Specs
 * tab's SKU row (`SkuRow.tsx`, PR6b — the Specs task explicitly asks for
 * "SKU of the selected variant", and `ProductOptions.tsx` deliberately does
 * not render SKU itself, per PR6a's traceability matrix note).
 *
 * PR6a had this state live entirely inside `ProductOptions`'s own
 * `useState`. That no longer reaches far enough once the Specs tab (rendered
 * below the fold, outside the two-column layout) needs the same value, so
 * PR6b lifts it to this provider and `ProductOptions` becomes a consumer
 * instead of the owner. The contract is otherwise unchanged: in-page state
 * only, lost on reload, no cart implication.
 */
export function VariantSelectionProvider({ variants, children }: VariantSelectionProviderProps) {
  const [selection, setSelection] = useState<VariantSelection>(() => defaultSelection(variants));
  const selectedVariant = useMemo(() => selectVariant(variants, selection), [variants, selection]);

  const value = useMemo<VariantSelectionContextValue>(
    () => ({ selection, setSelection, selectedVariant }),
    [selection, selectedVariant],
  );

  return <VariantSelectionContext.Provider value={value}>{children}</VariantSelectionContext.Provider>;
}

/**
 * Reads the shared selection. Throws outside a `VariantSelectionProvider` —
 * every consumer in this PDP is nested under the one provider mounted in
 * `producto/[slug]/page.tsx`, so a thrown error here means a real wiring
 * bug, not a state a caller should silently tolerate.
 */
export function useVariantSelection(): VariantSelectionContextValue {
  const ctx = useContext(VariantSelectionContext);

  if (ctx === null) {
    throw new Error("useVariantSelection must be used within a VariantSelectionProvider.");
  }

  return ctx;
}
