import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `products.ts`/`categories.ts` import `server-only` and `@/lib/db`, neither
// of which loads in plain jsdom — same stubbing pattern as
// `src/lib/data/products.test.ts`.
vi.mock("server-only", () => ({}));

const getProductCardsByCategoryMock = vi.fn();

vi.mock("@/lib/data/products", () => ({
  getProductCardsByCategory: getProductCardsByCategoryMock,
}));

// Not exercised by this test (only the page's default export calls it), but
// the module graph still needs it to resolve without touching `@/lib/db`.
vi.mock("@/lib/data/categories", () => ({
  getCategoryBySlug: vi.fn(),
}));

const { CategoryGrid } = await import("./page");

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
