import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws unconditionally outside Next's RSC bundler — same
// stubbing pattern as `products.test.ts`.
vi.mock("server-only", () => ({}));

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: findManyMock,
    },
  },
}));

const { getSearchIndexRows, searchProducts } = await import("./search");

/**
 * The task brief asks to "spy on `getSearchIndexRows` and assert it was
 * never called". That is not directly doable here: `searchProducts` calls
 * `getSearchIndexRows` as a same-module top-level function reference, and
 * ESM internal calls bypass the module's exported binding — spying on the
 * export (even via a namespace import) would not intercept that internal
 * call, only calls made THROUGH the imported binding from outside the
 * module. `getSearchIndexRows`'s entire body is exactly one
 * `prisma.product.findMany` call, so asserting on `findManyMock` (the one
 * real DB round trip a short-circuit must avoid) proves the same thing this
 * task actually cares about: an invalid query never reaches the database.
 */

function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "mesa-kendall",
    name: "Mesa Kendall",
    description: "Mesa de roble macizo.",
    categories: [{ name: "Mesas", slug: "mesas" }],
    media: [{ url: "https://cdn.example/mesa.jpg", alt: "Mesa Kendall de frente" }],
    variants: [
      {
        material: "Roble",
        priceCents: 38990000,
        salePriceCents: null,
        inStock: true,
        // Mocked rows carry `stock` on purpose, same discipline as
        // `products.test.ts`: the DTO must drop it even if a future select
        // change starts reading the column again [INV-2].
        stock: 0,
      },
    ],
    tags: [],
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
});

describe("searchProducts — validation short-circuit (design D3)", () => {
  it.each([
    ["empty", ""],
    ["one character", "m"],
    ["whitespace only", "   "],
    ["longer than MAX_QUERY_LENGTH (65 chars)", "a".repeat(65)],
  ])("returns validQuery:false WITHOUT any DAL call for a %s query", async (_label, query) => {
    const result = await searchProducts(query);

    expect(result).toEqual({ validQuery: false });
    expect(findManyMock).not.toHaveBeenCalled();
  });
});

describe("searchProducts — the query never reaches SQL (design D3)", () => {
  it("issues exactly ONE findMany call with no where clause at all", async () => {
    findManyMock.mockResolvedValueOnce([row()]);

    await searchProducts("mesa");

    expect(findManyMock).toHaveBeenCalledTimes(1);
    const args = findManyMock.mock.calls[0]?.[0] as Record<string, any>;

    // No `where`: `getSearchIndexRows()` loads the WHOLE catalog unfiltered,
    // so there is no argument the query string could be interpolated into —
    // ranking happens entirely in memory, on the already-loaded rows.
    expect(args.where).toBeUndefined();
    expect(JSON.stringify(args)).not.toContain("mesa");
  });

  it("does not select the stock column [INV-2]", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await searchProducts("mesa");

    const args = findManyMock.mock.calls[0]?.[0] as Record<string, any>;
    expect("stock" in args.select.variants.select).toBe(false);
  });
});

describe("searchProducts — ranking + mapping", () => {
  it("ranks matches best-first and maps them to a flat ProductCardDTO, dropping description and stock", async () => {
    findManyMock.mockResolvedValueOnce([
      row({ slug: "mesita", name: "Mesita", description: null }), // noise: no match at all
      row({ slug: "mesa-ratona", name: "Mesa ratona", description: "Una mesa baja." }),
      row({ slug: "mesa-kendall", name: "Mesa Kendall" }),
    ]);

    const result = await searchProducts("mesa");

    expect(result.validQuery).toBe(true);
    if (!result.validQuery) throw new Error("unreachable");

    expect(result.result.items.map((item) => item.slug)).toEqual(["mesa-kendall", "mesa-ratona"]);
    expect(result.result.total).toBe(2);

    const [card] = result.result.items;
    expect(card).toMatchObject({
      slug: "mesa-kendall",
      name: "Mesa Kendall",
      categoryName: "Mesas",
      categorySlug: "mesas",
      fromPriceCents: 38990000,
      hasConsultPrice: false,
      inStock: true,
      materials: ["Roble"],
      tag: null,
    });
    expect("stock" in card).toBe(false);
    expect("description" in card).toBe(false);
  });

  it("is accent- and case-insensitive end to end, through the DAL (mirrors rank.test.ts)", async () => {
    findManyMock.mockResolvedValueOnce([row({ slug: "mesa-kendall", name: "Mesa Kendall" })]);
    const lower = await searchProducts("mesa");

    findManyMock.mockResolvedValueOnce([row({ slug: "mesa-kendall", name: "Mesa Kendall" })]);
    const accented = await searchProducts("MÉsa");

    if (!lower.validQuery || !accented.validQuery) throw new Error("unreachable");
    expect(accented.result.items.map((item) => item.slug)).toEqual(
      lower.result.items.map((item) => item.slug),
    );
  });

  it("returns an empty page (never an error, never the full catalog) for a query with no matches", async () => {
    findManyMock.mockResolvedValueOnce([
      row({ slug: "estante", name: "Estante", description: "Roble macizo." }),
    ]);

    const result = await searchProducts("hamaca paraguaya");

    if (!result.validQuery) throw new Error("unreachable");
    expect(result.result.items).toEqual([]);
    expect(result.result.total).toBe(0);
    expect(result.result.totalPages).toBe(0);
  });

  it("clamps an out-of-range page instead of throwing or 404-ing (design D12 parity)", async () => {
    const rows = Array.from({ length: 30 }, (_, index) =>
      row({ slug: `mesa-${String(index)}`, name: `Mesa ${String(index)}` }),
    );
    findManyMock.mockResolvedValueOnce(rows);

    const result = await searchProducts("mesa", { page: 99 });

    if (!result.validQuery) throw new Error("unreachable");
    expect(result.result.total).toBe(30);
    expect(result.result.totalPages).toBe(2);
    expect(result.result.page).toBe(2);
  });
});

describe("getSearchIndexRows", () => {
  it("loads the whole catalog with no where filter, description included, ordered by slug", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await getSearchIndexRows();

    const args = findManyMock.mock.calls[0]?.[0] as Record<string, any>;
    expect(args.where).toBeUndefined();
    expect(args.select.description).toBe(true);
    expect(args.orderBy).toEqual({ slug: "asc" });
  });
});
