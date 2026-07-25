import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// `categories.ts`/`products.ts` import `server-only` and `@/lib/db`, neither
// of which loads in plain jsdom — same stubbing pattern as
// `categoria/[slug]/page.test.tsx`.
vi.mock("server-only", () => ({}));

const getCategoriesMock = vi.fn();
const getProductCardsMock = vi.fn();

vi.mock("@/lib/data/categories", () => ({
  getCategories: getCategoriesMock,
}));

vi.mock("@/lib/data/products", () => ({
  getProductCards: getProductCardsMock,
}));

const { default: HomePage } = await import("./page");

/**
 * PR5 review WARNING #2: the same follow-up that gave the category route its
 * `EmptyState` render test never landed for the home page — the only test
 * touching `(shop)/page.tsx` (`page.test.ts`, the D1b tripwire) reads it as
 * source text and never mounts it. `HomePage` has no exported grid-only slice
 * to await in isolation the way `CategoryGrid` does (design D1b: the whole
 * page stays body-awaited, not `<Suspense>`-split, until the `/api/health`
 * cutover), so this test awaits and renders the WHOLE default export instead
 * — safe here specifically because nothing in it is an unresolved async
 * component under a live `<Suspense>` boundary (unlike the category page).
 */
describe("HomePage — empty-catalog branch", () => {
  it("renders EmptyState, not a blank/silent grid, when the catalog has 0 products", async () => {
    getCategoriesMock.mockResolvedValueOnce([]);
    getProductCardsMock.mockResolvedValueOnce({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 0,
    });

    const ui = await HomePage();
    render(ui);

    expect(
      screen.getByText(
        "Todavía no hay productos publicados. Volvé pronto — estamos cargando el catálogo.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Ver el catálogo")).toBeInTheDocument();
  });

  it("renders the real product grid, not the empty state, when the catalog has products", async () => {
    getCategoriesMock.mockResolvedValueOnce([]);
    getProductCardsMock.mockResolvedValueOnce({
      items: [
        {
          slug: "mesa-kendall",
          name: "Mesa Kendall",
          categorySlug: "mesas",
          categoryName: "Mesas",
          image: null,
          fromPriceCents: 3899000,
          fromSalePriceCents: null,
          hasConsultPrice: false,
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

    const ui = await HomePage();
    render(ui);

    expect(screen.getByText("Mesa Kendall")).toBeInTheDocument();
    expect(
      screen.queryByText("Todavía no hay productos publicados. Volvé pronto — estamos cargando el catálogo."),
    ).not.toBeInTheDocument();
  });
});
