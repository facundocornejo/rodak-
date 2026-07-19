import "server-only";

import { prisma } from "@/lib/db";

export interface ProductVariantDTO {
  sku: string;
  material: string | null;
  sizeMm: string | null;
  priceCents: number;
  stock: number;
}

export interface ProductListingDTO {
  slug: string;
  name: string;
  variants: ProductVariantDTO[];
}

/**
 * Minimal plain DTOs for the storefront listing page. This is the only
 * function in the app that touches Prisma for the catalog — the `server-only`
 * import above makes any accidental client-side import a build error.
 */
export async function getProductsForListing(): Promise<ProductListingDTO[]> {
  const products = await prisma.product.findMany({
    orderBy: { name: "asc" },
    include: {
      variants: {
        orderBy: { sku: "asc" },
      },
    },
  });

  return products.map((product) => ({
    slug: product.slug,
    name: product.name,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      material: variant.material,
      sizeMm: variant.sizeMm,
      priceCents: variant.priceCents,
      stock: variant.stock,
    })),
  }));
}
