import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `products.ts` imports `server-only` and `@/lib/db`, neither of which loads
// in plain jsdom — same stubbing pattern as
// `src/app/(shop)/categoria/[slug]/page.test.tsx`.
vi.mock("server-only", () => ({}));

const getProductCardsByCategoryMock = vi.fn();

vi.mock("@/lib/data/products", () => ({
  getProductCardsByCategory: getProductCardsByCategoryMock,
}));

const { CrossSell } = await import("./CrossSell");

function card(slug: string) {
  return {
    slug,
    name: `Producto ${slug}`,
    categoryName: "Mesas",
    categorySlug: "mesas",
    image: null,
    fromPriceCents: 100000,
    fromSalePriceCents: null,
    hasConsultPrice: false,
    inStock: true,
    materials: [],
    tag: null,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("CrossSell", () => {
  it("[task 6.8] queries the SAME categorySlug only, excludes the current product, and renders a ProductCard per result", async () => {
    getProductCardsByCategoryMock.mockResolvedValueOnce({
      items: [card("mesa-a"), card("mesa-b"), card("mesa-actual")],
      page: 1,
      pageSize: 24,
      total: 3,
      totalPages: 1,
    });

    const jsx = await CrossSell({ categorySlug: "mesas", currentSlug: "mesa-actual" });
    render(jsx);

    expect(getProductCardsByCategoryMock).toHaveBeenCalledWith("mesas", {});
    expect(screen.getByText("Producto mesa-a")).toBeInTheDocument();
    expect(screen.getByText("Producto mesa-b")).toBeInTheDocument();
    expect(screen.queryByText("Producto mesa-actual")).not.toBeInTheDocument();
  });

  it("renders EmptyState (not a blank section) when the category has no OTHER products", async () => {
    getProductCardsByCategoryMock.mockResolvedValueOnce({
      items: [card("mesa-actual")],
      page: 1,
      pageSize: 24,
      total: 1,
      totalPages: 1,
    });

    const jsx = await CrossSell({ categorySlug: "mesas", currentSlug: "mesa-actual" });
    render(jsx);

    expect(
      screen.getByText("No encontramos más productos en esta categoría."),
    ).toBeInTheDocument();
  });

  it("renders EmptyState with zero DAL calls when the product has no category", async () => {
    const jsx = await CrossSell({ categorySlug: null, currentSlug: "mesa-actual" });
    render(jsx);

    expect(getProductCardsByCategoryMock).not.toHaveBeenCalled();
    expect(
      screen.getByText("No encontramos más productos en esta categoría."),
    ).toBeInTheDocument();
  });

  // PR7 review WARNING, fixed here: the "exactly one preload per page" rule
  // (design D13-PDP) rests entirely on `CrossSell` rendering `ProductCard`
  // directly instead of `ProductGrid` (whose own `index===0` logic would add
  // a SECOND preload), and until now that reasoning lived only in a comment.
  // Real images (not `image: null`) are required here — a null image never
  // renders an `<Image>` at all, which would pass this assertion for the
  // wrong reason.
  it("[D13] renders zero preload links, proving CrossSell never doubles the PDP's one `Gallery` preload", async () => {
    getProductCardsByCategoryMock.mockResolvedValueOnce({
      items: [
        { ...card("mesa-a"), image: { url: "https://cdn.example/mesa-a.jpg", alt: "Mesa A" } },
        { ...card("mesa-b"), image: { url: "https://cdn.example/mesa-b.jpg", alt: "Mesa B" } },
      ],
      page: 1,
      pageSize: 24,
      total: 2,
      totalPages: 1,
    });

    const jsx = await CrossSell({ categorySlug: "mesas", currentSlug: "mesa-actual" });
    render(jsx);

    expect(document.head.querySelectorAll('link[rel="preload"][as="image"]')).toHaveLength(0);
  });
});
