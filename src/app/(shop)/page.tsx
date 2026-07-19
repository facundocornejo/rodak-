import { getProductsForListing } from "@/lib/data/products";
import { formatPriceCents } from "@/lib/format";

// No DB is reachable during `next build` in CI (see design D11); force
// this page to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const products = await getProductsForListing();

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
