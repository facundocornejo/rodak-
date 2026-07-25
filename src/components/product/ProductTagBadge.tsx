import type { ProductTag } from "@/lib/data/products";

import styles from "./ProductTagBadge.module.css";

const LABELS: Record<ProductTag, string> = {
  BEST_SELLER: "Más vendido",
  NEW: "Nuevo",
};

export interface ProductTagBadgeProps {
  tag: ProductTag | null;
}

/**
 * Renders nothing when `tag === null` — the PRIMARY case, not an edge case:
 * every product in the real catalog is untagged today, since `Product.tags`
 * defaults to `[]` and no product has been curated yet (design D11). The
 * DAL's `pickTag()` (`src/lib/data/products.ts`) already resolves BEST_SELLER
 * over NEW when a product carries both, so this component only ever receives
 * at most one tag and never has to pick a winner itself.
 */
export function ProductTagBadge({ tag }: ProductTagBadgeProps) {
  if (tag === null) {
    return null;
  }

  return <span className={styles.badge}>{LABELS[tag]}</span>;
}
