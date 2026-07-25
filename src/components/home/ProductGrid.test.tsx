import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductCardDTO } from "@/lib/data/products";

import { ProductGrid } from "./ProductGrid";

/**
 * Pins design D13's "exactly one `preload` per page" invariant at the
 * component that owns the decision (`ProductGrid`'s own docblock: "index 0
 * gets it, nothing else does"). Nothing else in the suite asserted this
 * before — `ProductCard.test.tsx` renders a single card in isolation, so it
 * cannot observe the multi-card rule.
 *
 * `next/image`'s `preload` prop does not surface as a plain DOM attribute:
 * inside the App Router (no `RouterContext` provider, which is exactly this
 * test's condition), `next/image` calls React 19's `ReactDOM.preload(...)`
 * instead of rendering a `<link>` element inline — that call hoists the tag
 * directly into `document.head`, NOT into the render container, so the
 * assertion below reads `document.head`, not RTL's `container`. This is the
 * same signal PR4b's real `curl` measurement checked in the served HTML,
 * reused here as a fast, DB-less regression test.
 *
 * Deliberately ONE test, not "N items -> 1 preload" plus a separate "0 items
 * -> 0 preload" case: `ReactDOM.preload` hints are resource-level, not tied
 * to the render container's lifecycle, so they are NOT removed by RTL's
 * automatic unmount/cleanup between tests in the same file — a second test
 * reading `document.head` would see the first test's leftover hint and could
 * pass or fail for the wrong reason. Checking WHICH image was preloaded
 * (not just the count) inside a single render is both a stronger assertion
 * and immune to that cross-test leakage.
 */
function cardFixture(overrides: Partial<ProductCardDTO> = {}): ProductCardDTO {
  return {
    slug: "mesa-kendall",
    name: "Mesa Kendall",
    categorySlug: "mesas",
    categoryName: "Mesas",
    image: { url: "https://rodak.ar/wp-content/uploads/mesa-kendall.jpg", alt: "Mesa Kendall" },
    fromPriceCents: 3899000,
    fromSalePriceCents: null,
    hasConsultPrice: false,
    inStock: true,
    materials: [],
    tag: null,
    ...overrides,
  };
}

describe("ProductGrid — D13 preload invariant", () => {
  it("marks only the FIRST card's image for preload, and it is the first card's image", () => {
    const products = [
      cardFixture({
        slug: "mesa-kendall",
        image: { url: "https://rodak.ar/wp-content/uploads/mesa-kendall.jpg", alt: "Mesa Kendall" },
      }),
      cardFixture({
        slug: "silla-havana",
        image: { url: "https://rodak.ar/wp-content/uploads/silla-havana.jpg", alt: "Silla Havana" },
      }),
      cardFixture({
        slug: "banco-tandil",
        image: { url: "https://rodak.ar/wp-content/uploads/banco-tandil.jpg", alt: "Banco Tandil" },
      }),
    ];

    render(<ProductGrid products={products} />);

    const preloadLinks = document.head.querySelectorAll('link[rel="preload"][as="image"]');
    expect(preloadLinks).toHaveLength(1);

    // The Next.js image loader rewrites the URL, but the original filename
    // survives inside the query string it builds — enough to tell which of
    // the three products' images was actually the one preloaded.
    const preloadedSrc =
      preloadLinks[0].getAttribute("imagesrcset") ?? preloadLinks[0].getAttribute("href") ?? "";
    expect(preloadedSrc).toContain("mesa-kendall");
    expect(preloadedSrc).not.toContain("silla-havana");
    expect(preloadedSrc).not.toContain("banco-tandil");
  });
});
