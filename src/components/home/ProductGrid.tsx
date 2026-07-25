import type { ProductCardDTO } from "@/lib/data/products";
import { ProductCard } from "@/components/product/ProductCard";

import styles from "./ProductGrid.module.css";

export interface ProductGridProps {
  products: ProductCardDTO[];
}

/**
 * Presentational grid only — it does not call the DAL itself. Design's
 * component inventory lists `ProductGrid` under Home, Category (PR5) and
 * Search (PR7): the three surfaces fetch through different DAL functions
 * (`getProductCards`, `getProductCardsByCategory`, `searchProducts`) but
 * share the exact same rendering + "one preload image" rule, so the fetch
 * belongs to each page, not to this component. `page.tsx` here calls
 * `getProductCards` and passes the resulting `items` down.
 *
 * Owns the D13 image-slot rule ("exactly one `preload` per page, everything
 * else lazy") in ONE place: index 0 gets it, nothing else does, regardless
 * of which page rendered this grid.
 */
export function ProductGrid({ products }: ProductGridProps) {
  return (
    <ul className={styles.grid}>
      {products.map((product, index) => (
        <ProductCard key={product.slug} product={product} preload={index === 0} />
      ))}
    </ul>
  );
}
