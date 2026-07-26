import { SHIPPING_COPY } from "@/content/shipping";

import styles from "./ShippingTab.module.css";

/**
 * "Envío" tab — static, source-controlled copy only, no fetch, no state (obs
 * #615's copy rule; see `src/content/shipping.ts` for exactly which claims
 * are and are not backed by anything in this repository).
 *
 * PR8 review-follow-up fix: this docblock used to say "Envío y armado",
 * stale since PR7 renamed the rendered tab label to "Envío"
 * (`producto/[slug]/page.tsx`).
 */
export function ShippingTab() {
  return (
    <div className={styles.wrap}>
      {SHIPPING_COPY.map((line) => (
        <p key={line} className={styles.line}>
          {line}
        </p>
      ))}
    </div>
  );
}
