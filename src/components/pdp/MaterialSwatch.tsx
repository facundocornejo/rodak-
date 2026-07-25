import { materialToken } from "@/lib/materials";

import styles from "./MaterialSwatch.module.css";

export interface MaterialSwatchProps {
  material: string;
}

/**
 * One material option's visual: a colour dot for a mapped material (design
 * D7), or text-only — zero elements carrying the dot class — for an unmapped
 * one, so this app can never render a fabricated finish. Reused inside
 * `ProductOptions.tsx`'s material selector.
 *
 * `materials: string[]` is `[]` for every product in the real catalog today
 * (see `src/lib/materials.ts`'s provenance block), so this component simply
 * does not render in production — `MaterialSwatch.test.tsx` is what actually
 * exercises both branches.
 */
export function MaterialSwatch({ material }: MaterialSwatchProps) {
  const color = materialToken(material);

  return (
    <span className={styles.wrap}>
      {color !== null && (
        <span className={styles.dot} style={{ background: color }} aria-hidden="true" />
      )}
      <span className={styles.label}>{material}</span>
    </span>
  );
}
