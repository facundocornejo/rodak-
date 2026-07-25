import { materialToken } from "@/lib/materials";

import styles from "./SwatchRow.module.css";

export interface SwatchRowProps {
  materials: string[];
}

/**
 * Renders one pill per distinct material a product's variants carry (design
 * D7). A mapped material gets a colour swatch dot; an UNMAPPED material
 * renders text-only — zero elements carrying the swatch class — so a
 * material this app cannot honestly colour can never show a fabricated dot.
 *
 * `materials` is `[]` for every product in the real catalog today (see
 * `src/lib/materials.ts`'s provenance block: 272/272 variants have
 * `material === null`), so the empty-array branch below — render nothing —
 * is the production path, not a fallback that only exists for completeness.
 */
export function SwatchRow({ materials }: SwatchRowProps) {
  if (materials.length === 0) {
    return null;
  }

  return (
    <ul className={styles.row}>
      {materials.map((material) => {
        const color = materialToken(material);

        return (
          <li key={material} className={styles.pill}>
            {color !== null ? (
              <span className={styles.swatch} style={{ background: color }} aria-hidden="true" />
            ) : null}
            <span className={styles.label}>{material}</span>
          </li>
        );
      })}
    </ul>
  );
}
