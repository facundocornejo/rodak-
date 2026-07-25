import { Suspense } from "react";

import { notFound } from "next/navigation";

import { CrossSell } from "@/components/pdp/CrossSell";
import { CrossSellSkeleton } from "@/components/pdp/CrossSellSkeleton";
import { DescriptionTab } from "@/components/pdp/DescriptionTab";
import { Gallery } from "@/components/pdp/Gallery";
import { ProductOptions } from "@/components/pdp/ProductOptions";
import { Reassurance } from "@/components/pdp/Reassurance";
import { ReviewsTab } from "@/components/pdp/ReviewsTab";
import { ReviewsTabSkeleton } from "@/components/pdp/ReviewsTabSkeleton";
import { ShippingTab } from "@/components/pdp/ShippingTab";
import { SpecsTab } from "@/components/pdp/SpecsTab";
import { Tabs } from "@/components/pdp/Tabs";
import { VariantSelectionProvider } from "@/components/pdp/VariantSelectionProvider";
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
 * `/producto/{slug}/` — full PDP: buy column (PR6a) + tabs/reviews/cross-sell
 * (PR6b).
 *
 * `getProductBySlug` returning `null` is a real 404, never a 500: `notFound()`
 * is called directly in the page body, same shape as `/categoria/[slug]/`'s
 * lookup. `(shop)/not-found.tsx` renders the chrome-preserving 404 UI instead
 * of Next's bare default.
 *
 * `VariantSelectionProvider` wraps everything from the buy column down
 * through the tabs section: `ProductOptions` (buy column) and the Specs
 * tab's SKU row both need the SAME live `{material, sizeMm}` selection, and
 * they are DOM siblings, not parent/child — see that provider's own
 * docblock for why this needed lifting out of `ProductOptions`'s local
 * state (PR6a) into a shared client context (PR6b).
 *
 * Reviews and Cross-sell are each their own `<Suspense>` boundary (design
 * D1b: the PDP MAY stream — the no-streaming rule is `/`-only, pre-cutover).
 * Description/Specs/Envío render synchronously inside the page body: neither
 * touches the database, so there is nothing to stream.
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
        <VariantSelectionProvider variants={product.variants}>
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

          <section className={styles.tabsSection}>
            <Tabs
              tabs={[
                {
                  id: "descripcion",
                  label: "Descripción",
                  content: <DescriptionTab description={product.description} />,
                },
                {
                  id: "specs",
                  label: "Specs",
                  content: (
                    <SpecsTab variants={product.variants} categoryName={product.categoryName} />
                  ),
                },
                {
                  id: "envio",
                  label: "Envío y armado",
                  content: <ShippingTab />,
                },
                {
                  id: "resenas",
                  label: "Reseñas",
                  content: (
                    <Suspense fallback={<ReviewsTabSkeleton />}>
                      <ReviewsTab productSlug={product.slug} />
                    </Suspense>
                  ),
                },
              ]}
            />
          </section>
        </VariantSelectionProvider>

        <section className={styles.crossSellSection}>
          <Suspense fallback={<CrossSellSkeleton />}>
            <CrossSell categorySlug={product.categorySlug} currentSlug={product.slug} />
          </Suspense>
        </section>
      </div>
    </main>
  );
}
