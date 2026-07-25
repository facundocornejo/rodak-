import { notFound } from "next/navigation";

import { Gallery } from "@/components/pdp/Gallery";
import { ProductOptions } from "@/components/pdp/ProductOptions";
import { Reassurance } from "@/components/pdp/Reassurance";
import { ProductTagBadge } from "@/components/product/ProductTagBadge";
import { getProductBySlug } from "@/lib/data/products";

import styles from "./page.module.css";

// No DB is reachable during `next build` in CI (design D1); force this route
// to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

interface ProductPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * `/producto/{slug}/` — PDP, buy column only (PR6a; tabs/reviews/cross-sell
 * are PR6b, see the marked slot below).
 *
 * `getProductBySlug` returning `null` is a real 404, never a 500: `notFound()`
 * is called directly in the page body, same shape as `/categoria/[slug]/`'s
 * lookup. `(shop)/not-found.tsx` (added in this PR) renders the
 * chrome-preserving 404 UI instead of Next's bare default — before this PR
 * that file did not exist, so a `notFound()` anywhere under `(shop)/` lost
 * the announce bar, header and footer the same way an unhandled error did
 * before `(shop)/error.tsx` (PR5).
 *
 * Renders its own `<main>` — `(shop)/layout.tsx` deliberately renders none.
 */
export default async function ProductPage({ params }: ProductPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (product === null) {
    notFound();
  }

  return (
    <main>
      <div className={styles.wrap}>
        <div className={styles.layout}>
          <Gallery media={product.media} />
          <div className={styles.buyColumn}>
            <header className={styles.header}>
              <div className={styles.eyebrow}>
                <ProductTagBadge tag={product.tag} />
                {product.categoryName !== null && (
                  <span className={styles.category}>{product.categoryName}</span>
                )}
              </div>
              <h1 className={styles.title}>{product.name}</h1>
            </header>
            <ProductOptions variants={product.variants} />
            <Reassurance />
          </div>
        </div>
        {/*
         * PR6b mounts <Tabs> (Descripción/Specs/Envío y armado/Reseñas) and
         * <CrossSell> here, below the two-column layout above. Deliberately
         * no placeholder markup: an empty skeleton box would just be dead
         * weight for PR6b to strip out, and there is no CLS risk in leaving
         * it out — this section starts below the fold on every viewport this
         * page targets, so its absence today does not shift anything above
         * it when PR6b adds it back.
         */}
      </div>
    </main>
  );
}
