"use client";

import { useState } from "react";

import type { ProductVariantDTO } from "@/lib/data/products";
import { PriceBlock } from "@/components/product/PriceBlock";
import {
  defaultSelection,
  deriveVariantOptions,
  isConsultPrice,
  selectVariant,
  type VariantSelection,
} from "@/lib/variants";

import { Availability } from "./Availability";
import { MaterialSwatch } from "./MaterialSwatch";
import styles from "./ProductOptions.module.css";

export interface ProductOptionsProps {
  /** `ProductDetailDTO.variants`, `sku asc` — a flat DTO array [INV-9]. */
  variants: ProductVariantDTO[];
}

type Dimension = "material" | "sizeMm";

/**
 * The PDP's option selectors + resolved price/availability (design D8, D8b).
 * Client Component: owns `{material, sizeMm}` in-page state, no URL change,
 * no server data of its own.
 *
 * **No `<button>` anywhere in this component** (design D8b's verification:
 * "zero `<button>` in the buy column" — there is no verified contact channel,
 * so nothing here should read as a CTA, including the option controls
 * themselves). Each option is a native `<input type="radio">` visually hidden
 * and paired with a `<label>` styled as the pill — a standard accessible
 * pattern (real keyboard/tab semantics, `:checked`/`:disabled` drive the
 * visuals) that happens to compile to zero `<button>` elements.
 *
 * An impossible (material, size) pair renders `disabled` on its `<input>`,
 * never hidden (design D8): the browser excludes it from the tab order and
 * blocks interaction while the label pill stays fully visible with reduced
 * contrast — `selectVariant(...) === null` for that candidate IS the disabled
 * signal, computed against the OTHER dimension's current selection so a user
 * can only ever click into a combination that really exists.
 *
 * NO quantity control and NO add-to-cart anywhere in this file [INV-10].
 */
export function ProductOptions({ variants }: ProductOptionsProps) {
  const options = deriveVariantOptions(variants);
  const [selection, setSelection] = useState<VariantSelection>(() => defaultSelection(variants));

  const selectedVariant = selectVariant(variants, selection);

  function choose(dimension: Dimension, value: string) {
    setSelection((current) => ({ ...current, [dimension]: value }));
  }

  function isSelectable(dimension: Dimension, value: string): boolean {
    const candidate: VariantSelection =
      dimension === "material"
        ? { material: value, sizeMm: selection.sizeMm }
        : { material: selection.material, sizeMm: value };

    return selectVariant(variants, candidate) !== null;
  }

  const consult = selectedVariant !== null && isConsultPrice(selectedVariant);

  return (
    <div className={styles.wrap}>
      {options.materials.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Material</legend>
          <div className={styles.options}>
            {options.materials.map((material) => {
              const id = optionId("material", material);
              const selectable = isSelectable("material", material);

              return (
                <span key={material} className={styles.optionSlot}>
                  <input
                    type="radio"
                    id={id}
                    name="pdp-material"
                    className={styles.input}
                    checked={selection.material === material}
                    disabled={!selectable}
                    onChange={() => choose("material", material)}
                  />
                  <label htmlFor={id} className={styles.option}>
                    <MaterialSwatch material={material} />
                  </label>
                </span>
              );
            })}
          </div>
        </fieldset>
      )}

      {options.sizes.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Medida</legend>
          <div className={styles.options}>
            {options.sizes.map((size) => {
              const id = optionId("size", size);
              const selectable = isSelectable("sizeMm", size);

              return (
                <span key={size} className={styles.optionSlot}>
                  <input
                    type="radio"
                    id={id}
                    name="pdp-size"
                    className={styles.input}
                    checked={selection.sizeMm === size}
                    disabled={!selectable}
                    onChange={() => choose("sizeMm", size)}
                  />
                  <label htmlFor={id} className={styles.option}>
                    {size}
                  </label>
                </span>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className={styles.buyInfo}>
        {selectedVariant === null ? (
          // Defensive only: the importer refuses to store a product without
          // at least one priced variant (see `defaultSelection`'s docblock in
          // `src/lib/variants.ts`), so this branch is not expected to render
          // against the real catalog.
          <p className={styles.unavailable}>Esta combinación no está disponible.</p>
        ) : (
          <>
            <PriceBlock
              priceCents={selectedVariant.priceCents}
              salePriceCents={selectedVariant.salePriceCents}
            />
            {consult ? (
              <p className={styles.consultNote}>A medida — se cotiza por pedido</p>
            ) : (
              <Availability inStock={selectedVariant.inStock} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A stable, DOM-safe id for a free-form option value (sizes can read like
 * `"1000x400x600 (Ancho x profundidad x alto )"`). `encodeURIComponent`
 * keeps it collision-free without needing a slugify dependency (D0).
 */
function optionId(dimension: "material" | "size", value: string): string {
  return `pdp-${dimension}-${encodeURIComponent(value)}`;
}
