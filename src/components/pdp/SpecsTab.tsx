import type { ProductVariantDTO } from "@/lib/data/products";
import { deriveVariantOptions } from "@/lib/variants";

import { SkuRow } from "./SkuRow";
import styles from "./SpecsTab.module.css";

export interface SpecsTabProps {
  /** `ProductDetailDTO.variants`, `sku asc` — a flat DTO array [INV-9]. */
  variants: ProductVariantDTO[];
  categoryName: string | null;
}

const NO_DATA = "Sin datos.";

/**
 * Specs rows built ONLY from structured fields — this is the GATE-2 planning
 * revision (design doc, "Specs tab" row), which overrode an earlier draft
 * that parsed the free-text `description`. Never parses prose, never
 * fabricates a row:
 *
 *   - Materiales: distinct `variant.material` (`deriveVariantOptions`, same
 *     pure function `ProductOptions.tsx` uses for its own material selector —
 *     one derivation, two call sites).
 *   - Medidas: distinct `variant.sizeMm`, same function.
 *   - SKU: of the CURRENTLY SELECTED variant (`SkuRow.tsx`, reactive to the
 *     buy column via `VariantSelectionProvider` — see that file's docblock
 *     for why this needed a client leaf inside an otherwise server-rendered
 *     tab).
 *   - Categoría: `ProductDetailDTO.categoryName`.
 *
 * Consistency rule for "no data" (the task leaves the choice to the
 * implementer, with the requirement to be consistent and to say which):
 * Materiales/Medidas are OMITTED entirely when empty — showing "Sin datos."
 * for a dimension a product simply does not vary on would read as an error
 * message on every product with only one size, which is most of the catalog.
 * SKU and Categoría, by contrast, always render a value or the "Sin datos."
 * line — every product is expected to carry a SKU and (usually) a category,
 * so a missing one is a real gap worth surfacing, not a normal absence.
 *
 * Real-catalog note (`src/lib/materials.ts`'s provenance block): every one of
 * the 272 real variants has `material === null`, so the Materiales row is
 * absent for every product in production today — the honest, tested outcome,
 * not a bug. `Medidas` renders `sizeMm` strings exactly as the DAL returns
 * them, including free-form values like
 * "1000x400x600 (Ancho x profundidad x alto )" — no attempt is made to parse
 * them into structured numbers.
 */
export function SpecsTab({ variants, categoryName }: SpecsTabProps) {
  const { materials, sizes } = deriveVariantOptions(variants);

  return (
    <dl className={styles.list}>
      {materials.length > 0 && (
        <div className={styles.row}>
          <dt className={styles.term}>Materiales</dt>
          <dd className={styles.value}>{materials.join(", ")}</dd>
        </div>
      )}
      {sizes.length > 0 && (
        <div className={styles.row}>
          <dt className={styles.term}>Medidas</dt>
          <dd className={styles.value}>{sizes.join(", ")}</dd>
        </div>
      )}
      <div className={styles.row}>
        <dt className={styles.term}>SKU</dt>
        <dd className={styles.value}>
          <SkuRow />
        </dd>
      </div>
      <div className={styles.row}>
        <dt className={styles.term}>Categoría</dt>
        <dd className={styles.value}>{categoryName ?? NO_DATA}</dd>
      </div>
    </dl>
  );
}
