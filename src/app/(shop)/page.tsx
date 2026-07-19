import { getProductsForListing, type ProductListingDTO } from "@/lib/data/products";
import { formatPriceCents } from "@/lib/format";

// No DB is reachable during `next build` in CI (see design D11); force
// this page to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  let products: ProductListingDTO[];

  try {
    products = await getProductsForListing();
  } catch (error) {
    // Anticipated-error handling, distinct from the empty-catalog state
    // below (an empty result is not an error — it renders normally). This
    // is a Server Component, so `console.error` here runs on the server,
    // not in the browser; `src/app/error.tsx` remains the fallback boundary
    // for genuinely unexpected errors elsewhere in the tree.
    console.error("[HomePage] catalog query failed:", error);

    return (
      <main>
        <h1>Rodak</h1>
        <p>No pudimos cargar el catálogo. Probá de nuevo en unos minutos.</p>
      </main>
    );
  }

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
