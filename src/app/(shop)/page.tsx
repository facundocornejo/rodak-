// `EmptyState` lives under `src/components/category/` because PR5 is the
// slice that built it as a real component, but it is a shared surface (PR5's
// task: "migrate [the home page's inline empty-state block] to this shared
// component so there is one empty state, not two") — reused here unchanged.
import { EmptyState } from "@/components/category/EmptyState";
import { CategoryList } from "@/components/home/CategoryList";
import { CraftBand } from "@/components/home/CraftBand";
import { Hero } from "@/components/home/Hero";
import { Marquee } from "@/components/home/Marquee";
import { ProductGrid } from "@/components/home/ProductGrid";
import { TrustRow } from "@/components/home/TrustRow";
import { getCategories } from "@/lib/data/categories";
import { getProductCards } from "@/lib/data/products";

import styles from "./page.module.css";

// No DB is reachable during `next build` in CI (design D1); force this page
// to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

/**
 * Home page. `/` is still Coolify's healthcheck path until the `/api/health`
 * cutover (PR8/D2b), so both catalog queries are AWAITED here in the page
 * body and this component is deliberately NOT wrapped in `<Suspense>`
 * (design D1b): streaming would let the shell respond 200 while the database
 * is down, which would blind the current healthcheck. PR9 moves this to
 * `<Suspense>` after Facu repoints Coolify to `/api/health/`. Do not "fix"
 * this to stream here.
 *
 * Renders its own `<main>` — `(shop)/layout.tsx` deliberately renders none.
 */
export default async function HomePage() {
  const [categories, catalog] = await Promise.all([
    getCategories(),
    getProductCards({ page: 1 }),
  ]);

  return (
    <main>
      <Hero />
      <Marquee />
      <CategoryList categories={categories} />
      <section id="catalogo" className={styles.catalog}>
        <div className={styles.catalogHead}>
          <span className={styles.eyebrow}>Lo más elegido</span>
          <h2 className={styles.catalogTitle}>Escritorios &amp; sets</h2>
        </div>
        {catalog.items.length === 0 ? (
          // Honest empty state (design "states" rule) — no product exists in
          // this environment yet, and the copy says exactly that, nothing
          // more.
          <EmptyState message="Todavía no hay productos publicados. Volvé pronto — estamos cargando el catálogo." />
        ) : (
          <ProductGrid products={catalog.items} />
        )}
      </section>
      <TrustRow />
      <CraftBand />
    </main>
  );
}
