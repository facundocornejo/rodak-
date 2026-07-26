import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// `search.ts` imports `server-only` and `@/lib/db`, neither of which loads
// in plain jsdom — same stubbing pattern as
// `src/app/(shop)/categoria/[slug]/page.test.tsx`.
vi.mock("server-only", () => ({}));

const searchProductsMock = vi.fn();

vi.mock("@/lib/data/search", () => ({
  searchProducts: searchProductsMock,
}));

const { SearchResults } = await import("./page");

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

describe("SearchResults — validation failure (design D3)", () => {
  it("renders the too-short copy for a 1-character query", async () => {
    searchProductsMock.mockResolvedValueOnce({ validQuery: false });

    const ui = await SearchResults({ query: "m", page: undefined });
    render(ui);

    expect(screen.getByText("Escribí al menos 2 caracteres para buscar.")).toBeInTheDocument();
  });

  it("renders the bare-page copy for an absent query, not the too-short copy", async () => {
    searchProductsMock.mockResolvedValueOnce({ validQuery: false });

    const ui = await SearchResults({ query: "", page: undefined });
    render(ui);

    expect(screen.getByText("Escribí qué estás buscando.")).toBeInTheDocument();
    expect(
      screen.queryByText("Escribí al menos 2 caracteres para buscar."),
    ).not.toBeInTheDocument();
  });
});

describe("SearchResults — zero matches", () => {
  it("renders EmptyState, not a blank/silent grid, when the ranked result is empty", async () => {
    searchProductsMock.mockResolvedValueOnce({
      validQuery: true,
      result: { items: [], page: 1, pageSize: 24, total: 0, totalPages: 0 },
    });

    const ui = await SearchResults({ query: "zzznomatch", page: undefined });
    render(ui);

    expect(
      screen.getByText("No encontramos resultados para “zzznomatch”. Probá con otra palabra."),
    ).toBeInTheDocument();
  });
});

describe("SearchResults — matches", () => {
  it("renders the result count, the grid and pagination, and forwards the query+page to searchProducts", async () => {
    searchProductsMock.mockResolvedValueOnce({
      validQuery: true,
      result: { items: [card("mesa-kendall")], page: 1, pageSize: 24, total: 1, totalPages: 1 },
    });

    const ui = await SearchResults({ query: "mesa", page: 1 });
    render(ui);

    expect(searchProductsMock).toHaveBeenCalledWith("mesa", { page: 1 });
    expect(screen.getByText("1 resultado para “mesa”")).toBeInTheDocument();
    expect(screen.getByText("Producto mesa-kendall")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Paginación" })).toBeInTheDocument();
  });

  it("pluralizes the count for more than one match", async () => {
    searchProductsMock.mockResolvedValueOnce({
      validQuery: true,
      result: {
        items: [card("mesa-kendall"), card("mesa-ratona")],
        page: 1,
        pageSize: 24,
        total: 2,
        totalPages: 1,
      },
    });

    const ui = await SearchResults({ query: "mesa", page: undefined });
    render(ui);

    expect(screen.getByText("2 resultados para “mesa”")).toBeInTheDocument();
  });
});
