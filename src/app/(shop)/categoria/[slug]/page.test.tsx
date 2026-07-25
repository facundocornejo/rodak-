import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `products.ts`/`categories.ts` import `server-only` and `@/lib/db`, neither
// of which loads in plain jsdom — same stubbing pattern as
// `src/lib/data/products.test.ts`.
vi.mock("server-only", () => ({}));

const getProductCardsByCategoryMock = vi.fn();

vi.mock("@/lib/data/products", () => ({
  getProductCardsByCategory: getProductCardsByCategoryMock,
}));

const getCategoryBySlugMock = vi.fn();

vi.mock("@/lib/data/categories", () => ({
  getCategoryBySlug: getCategoryBySlugMock,
}));

// Real `notFound()` throws a special (uncatchable-by-design) error to abort
// rendering — mirrored here so `CategoryPage` behaves the same way under
// test as it does in production, instead of silently falling through to
// `category.name`/`category.productCount` on a `null` category.
const notFoundMock = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: notFoundMock,
}));

const { default: CategoryPage, CategoryGrid } = await import("./page");

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Follow-up 4 (PR4b review): the empty-catalog branch had never been
 * exercised, only reasoned about. This renders the category page's grid
 * slice directly — `CategoryGrid` is exported from `page.tsx` specifically so
 * this test can `await` it and render its result like any other server
 * component, without needing a live `<Suspense>` tree or a real database.
 */
describe("CategoryGrid — zero-product branch", () => {
  it("renders EmptyState, not a blank/silent grid, when the category has 0 products", async () => {
    getProductCardsByCategoryMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 0,
    });

    const ui = await CategoryGrid({ slug: "categoria-vacia", page: undefined });
    render(ui);

    expect(
      screen.getByText("Todavía no hay productos publicados en esta categoría."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Paginación" })).not.toBeInTheDocument();
  });

  it("renders the grid and pagination when the category has products", async () => {
    getProductCardsByCategoryMock.mockResolvedValueOnce({
      items: [
        {
          slug: "mesa-kendall",
          name: "Mesa Kendall",
          categorySlug: "mesas",
          categoryName: "Mesas",
          image: null,
          fromPriceCents: 3899000,
          fromSalePriceCents: null,
          inStock: true,
          materials: [],
          tag: null,
        },
      ],
      page: 1,
      pageSize: 24,
      total: 1,
      totalPages: 1,
    });

    const ui = await CategoryGrid({ slug: "mesas", page: 1 });
    render(ui);

    expect(screen.getByText("Mesa Kendall")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeInTheDocument();
  });
});

/**
 * PR5 review WARNING #3: `getCategoryBySlug` was mocked but never configured
 * with a return value, so the `null` → `notFound()` branch was documented as
 * "not exercised" — inverting the guard (or deleting it outright) would have
 * failed no test. These two tests pin both directions of that guard.
 */
describe("CategoryPage — notFound() branch", () => {
  it("calls notFound() when the category does not exist, and never reaches the render", async () => {
    getCategoryBySlugMock.mockResolvedValueOnce(null);

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: "no-existe-esta-categoria" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFoundMock).toHaveBeenCalledTimes(1);
    // Never even reaches the paginated grid lookup once the category is null.
    expect(getProductCardsByCategoryMock).not.toHaveBeenCalled();
  });

  it("does NOT call notFound() when the category exists — a known-but-empty category still renders, not 404s", async () => {
    // `CategoryPage`'s JSX nests the async `CategoryGrid` inside
    // `<Suspense>` (unavoidable — that async component only resolves under
    // Next's real RSC renderer, not client-side `render()`; see
    // `CategoryGrid`'s own tests above for why it is awaited directly
    // instead). This test therefore only awaits `CategoryPage` itself —
    // constructing that JSX does not execute `CategoryGrid`'s body — and
    // asserts the guard was not tripped, which is the behaviour this
    // follow-up exists to pin.
    getCategoryBySlugMock.mockResolvedValueOnce({
      slug: "accesorios",
      name: "Accesorios",
      productCount: 0,
    });

    await expect(
      CategoryPage({
        params: Promise.resolve({ slug: "accesorios" }),
        searchParams: Promise.resolve({}),
      }),
    ).resolves.toBeTruthy();

    expect(notFoundMock).not.toHaveBeenCalled();
  });
});
