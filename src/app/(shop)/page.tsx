import { getProductCards, type ProductCardDTO } from "@/lib/data/products";
import { formatPriceCents } from "@/lib/format";

// No DB is reachable during `next build` in CI (see design D1); force this
// page to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

/**
 * Placeholder listing. PR4 replaces this whole page with the real home
 * (hero, marquee, category list, product grid); this slice only swaps the
 * deleted listing helper for the new card DAL so the data layer can ship on
 * its own. Intentionally unstyled.
 */
export default async function HomePage() {
  // A catalog query failure must propagate: `/` is still Coolify's healthcheck
  // path, so this page has to answer non-200 when the DB is down. The query is
  // therefore awaited in the page body and NOT wrapped in <Suspense> until the
  // healthcheck is repointed to /api/health/ (design D1b).
  const catalog = await getProductCards({ page: 1 });

  return (
    <main>
      <h1>Rodak</h1>
      {catalog.items.length === 0 ? (
        <p>Catálogo en construcción.</p>
      ) : (
        <ul>
          {catalog.items.map((product: ProductCardDTO) => (
            <li key={product.slug}>
              <span>{product.name}</span>
              <span> — {fromPriceLabel(product)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** `priceCents === 0` is "consultar precio", never $0 or blank [INV-1, INV-4]. */
function fromPriceLabel(product: ProductCardDTO): string {
  if (product.fromPriceCents === null) {
    return "Consultar precio";
  }

  return formatPriceCents(product.fromSalePriceCents ?? product.fromPriceCents);
}
