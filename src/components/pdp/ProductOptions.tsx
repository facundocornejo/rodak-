"use client";

import { useRef, type KeyboardEvent } from "react";

import type { ProductVariantDTO } from "@/lib/data/products";
import { PriceBlock } from "@/components/product/PriceBlock";
import { deriveVariantOptions, isConsultPrice, selectVariant } from "@/lib/variants";

import { Availability } from "./Availability";
import { MaterialSwatch } from "./MaterialSwatch";
import { useVariantSelection } from "./VariantSelectionProvider";
import styles from "./ProductOptions.module.css";

export interface ProductOptionsProps {
  /** `ProductDetailDTO.variants`, `sku asc` — a flat DTO array [INV-9]. */
  variants: ProductVariantDTO[];
}

type Dimension = "material" | "sizeMm";

/**
 * The PDP's option selectors + resolved price/availability (design D8, D8b).
 * Client Component: reads/writes the selection owned by
 * `VariantSelectionProvider` (PR6b — moved out of local `useState` so the
 * Specs tab's SKU row, a DOM sibling below the fold, can read the same
 * `selectedVariant` without prop-drilling across the whole page).
 *
 * **No `<button>` anywhere in this component** (design D8b's verification,
 * unchanged since PR6a: "zero `<button>` in the buy column" — there is no
 * verified contact channel, so nothing here should read as a CTA, including
 * the option controls themselves).
 *
 * **PR6a review WARNING, fixed here**: options used to be a native
 * `<input type="radio" disabled>` group. `disabled` removes an element from
 * the tab order entirely, which contradicts design D8 and `selectVariant`'s
 * own docblock (an impossible combination must stay reachable by keyboard so
 * the visitor can find out WHY it is unavailable, not just that it vanished).
 * Each option is therefore a custom `role="radio"` `<div>` inside a
 * `role="radiogroup"` fieldset, with its own roving-tabindex + arrow-key
 * handling (Left/Right/Up/Down/Home/End move focus; Enter/Space commits a
 * selection) — chosen over a native `<input type="radio">` group specifically
 * because native radio-group semantics tie focusability AND selection to the
 * `disabled` attribute, which is exactly what this fix removes. Disabled
 * options carry `aria-disabled="true"` only, stay focusable, and are
 * genuinely inert: `choose()` returns before calling `setSelection` when
 * `selectable` is false, so no state — and therefore no visual "checked" —
 * ever changes for them, whether triggered by click, Enter, Space, or (in a
 * real browser) any assistive-technology activation gesture. Visibly inert
 * via `aria-disabled` + reduced contrast (`ProductOptions.module.css`), never
 * colour alone (also lower opacity + `cursor: not-allowed`).
 *
 * NO quantity control and NO add-to-cart anywhere in this file [INV-10].
 */
export function ProductOptions({ variants }: ProductOptionsProps) {
  const options = deriveVariantOptions(variants);
  const { selection, setSelection, selectedVariant } = useVariantSelection();

  const materialRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sizeRefs = useRef<Record<string, HTMLDivElement | null>>({});

  function isSelectable(dimension: Dimension, value: string): boolean {
    const candidate =
      dimension === "material"
        ? { material: value, sizeMm: selection.sizeMm }
        : { material: selection.material, sizeMm: value };

    return selectVariant(variants, candidate) !== null;
  }

  function choose(dimension: Dimension, value: string, selectable: boolean) {
    if (!selectable) return;
    setSelection({ ...selection, [dimension]: value });
  }

  function focusValueAt(refs: Record<string, HTMLDivElement | null>, values: string[], index: number) {
    const value = values[(index + values.length) % values.length];
    if (value !== undefined) {
      refs[value]?.focus();
    }
  }

  function onOptionKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    dimension: Dimension,
    values: string[],
    index: number,
    value: string,
    selectable: boolean,
  ) {
    const refs = dimension === "material" ? materialRefs.current : sizeRefs.current;

    switch (event.key) {
      case "ArrowRight":
      case "ArrowDown":
        event.preventDefault();
        focusValueAt(refs, values, index + 1);
        break;
      case "ArrowLeft":
      case "ArrowUp":
        event.preventDefault();
        focusValueAt(refs, values, index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusValueAt(refs, values, 0);
        break;
      case "End":
        event.preventDefault();
        focusValueAt(refs, values, values.length - 1);
        break;
      case " ":
      case "Enter":
        event.preventDefault();
        choose(dimension, value, selectable);
        break;
      default:
        break;
    }
  }

  /**
   * Roving tabindex: the checked option is the group's one Tab stop. If
   * nothing in this dimension is currently checked (defensive — in the real
   * catalog `defaultSelection` always picks a value that IS one of the
   * derived options), the first option takes over so the group is never
   * entirely untabbable.
   */
  function tabIndexFor(value: string, index: number, values: string[], selectedValue: string | null) {
    const hasSelection = selectedValue !== null && values.includes(selectedValue);
    if (hasSelection) return value === selectedValue ? 0 : -1;
    return index === 0 ? 0 : -1;
  }

  const consult = selectedVariant !== null && isConsultPrice(selectedVariant);

  return (
    <div className={styles.wrap}>
      {options.materials.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Material</legend>
          <div className={styles.options} role="radiogroup" aria-label="Material">
            {options.materials.map((material, index) => {
              const selectable = isSelectable("material", material);
              const checked = selection.material === material;

              return (
                <div
                  key={material}
                  ref={(el) => {
                    materialRefs.current[material] = el;
                  }}
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={!selectable}
                  tabIndex={tabIndexFor(material, index, options.materials, selection.material)}
                  className={!selectable ? `${styles.option} ${styles.optionDisabled}` : styles.option}
                  onClick={() => choose("material", material, selectable)}
                  onKeyDown={(event) =>
                    onOptionKeyDown(event, "material", options.materials, index, material, selectable)
                  }
                >
                  <MaterialSwatch material={material} />
                </div>
              );
            })}
          </div>
        </fieldset>
      )}

      {options.sizes.length > 0 && (
        <fieldset className={styles.group}>
          <legend className={styles.legend}>Medida</legend>
          <div className={styles.options} role="radiogroup" aria-label="Medida">
            {options.sizes.map((size, index) => {
              const selectable = isSelectable("sizeMm", size);
              const checked = selection.sizeMm === size;

              return (
                <div
                  key={size}
                  ref={(el) => {
                    sizeRefs.current[size] = el;
                  }}
                  role="radio"
                  aria-checked={checked}
                  aria-disabled={!selectable}
                  tabIndex={tabIndexFor(size, index, options.sizes, selection.sizeMm)}
                  className={!selectable ? `${styles.option} ${styles.optionDisabled}` : styles.option}
                  onClick={() => choose("sizeMm", size, selectable)}
                  onKeyDown={(event) =>
                    onOptionKeyDown(event, "sizeMm", options.sizes, index, size, selectable)
                  }
                >
                  {size}
                </div>
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
