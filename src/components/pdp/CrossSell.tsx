import { EmptyState } from "@/components/category/EmptyState";
import { ProductCard } from "@/components/product/ProductCard";
import { getProductCardsByCategory } from "@/lib/data/products";

import styles from "./CrossSell.module.css";

export interface CrossSellProps {
  categorySlug: string | null;
  currentSlug: string;
}

/**
 * Deliberately small — this is a teaser rail below the fold, not a second
 * category grid. `getProductCardsByCategory` returns up to
 * `PRODUCT_PAGE_SIZE` (24) items; showing all of them here would compete
 * with the buy column and blur the line with `/categoria/[slug]/` itself.
 */
const CROSS_SELL_LIMIT = 4;

/**
 * Other products in the SAME `categorySlug` only (task 6.8) — no curated
 * compatibility set, which is explicitly a later phase, and no ranking
 * beyond the DAL's own `name asc, slug asc` order.
 *
 * `preload` is never passed to `ProductCard` here (defaults to `false`):
 * the PDP already has its one `preload` image (`Gallery`'s `media[0]`,
 * design D13 — "exactly one preload per page"), and reusing `ProductGrid`
 * here would silently add a second one via its own `index===0` logic, which
 * is why this renders `ProductCard` directly instead of through
 * `ProductGrid`.
 *
 * Server Component — the async leaf `<Suspense>` wraps in
 * `producto/[slug]/page.tsx` (design D1b, same reasoning as `ReviewsTab`).
 */
export async function CrossSell({ categorySlug, currentSlug }: CrossSellProps) {
  // No category means there is no "same category" to draw from — an
  // honest empty state, no DAL call needed.
  const candidates =
    categorySlug === null ? [] : (await getProductCardsByCategory(categorySlug, {})).items;

  const items = candidates.filter((product) => product.slug !== currentSlug).slice(0, CROSS_SELL_LIMIT);

  return (
    <section className={styles.wrap}>
      <h2 className={styles.heading}>También te puede interesar</h2>
      {items.length === 0 ? (
        <EmptyState message="No encontramos más productos en esta categoría." />
      ) : (
        <ul className={styles.grid}>
          {items.map((product) => (
            <ProductCard key={product.slug} product={product} />
          ))}
        </ul>
      )}
    </section>
  );
}
