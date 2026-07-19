import { getProductsForListing, type ProductListingDTO } from "@/lib/data/products";
import { formatPriceCents } from "@/lib/format";

// No DB is reachable during `next build` in CI (see design D11); force
// this page to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // A catalog query failure must propagate: `/` is Coolify's healthcheck
  // path, so this page has to answer non-200 when the DB is down. The
  // empty catalog below is the only anticipated non-error state; failures
  // render `src/app/error.tsx`.
  const products: ProductListingDTO[] = await getProductsForListing();

  return (
    <main>
      <h1>Rodak</h1>
      {products.length === 0 ? (
        <p>Catálogo en construcción.</p>
      ) : (
        <ul>
          {products.map((product) => {
            const [variant] = product.variants;

            return (
              <li key={product.slug}>
                <span>{product.name}</span>
                {variant ? <span> — {formatPriceCents(variant.priceCents)}</span> : null}
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
