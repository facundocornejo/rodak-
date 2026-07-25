import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws unconditionally outside Next's RSC bundler (it relies
// on a webpack alias Next provides at build time to swap it for a no-op).
// Vitest runs in plain Node, so it must be stubbed for this DAL module to
// load at all.
vi.mock("server-only", () => ({}));

const countMock = vi.fn();
const findManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      count: countMock,
      findMany: findManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

const { PRODUCT_PAGE_SIZE, getProductBySlug, getProductCards, getProductCardsByCategory } =
  await import("./products");

// Mocked rows carry a `stock` value on purpose: the DTOs must drop it even if
// a future query change starts selecting the column again [INV-2].
type MockVariant = Record<string, unknown>;

function variantRow(overrides: MockVariant = {}): MockVariant {
  return {
    sku: "RODAK-MESA-1",
    material: "Roble",
    sizeMm: "1200x800",
    priceCents: 38990000,
    salePriceCents: null,
    inStock: true,
    stock: 0,
    ...overrides,
  };
}

function productRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "mesa-kendall",
    name: "Mesa Kendall",
    description: "Mesa de roble macizo.",
    categories: [{ name: "Mesas", slug: "mesas" }],
    media: [{ url: "https://cdn.example/mesa.jpg", alt: "Mesa Kendall de frente" }],
    variants: [variantRow()],
    ...overrides,
  };
}

function lastFindManyArgs(): Record<string, any> {
  return findManyMock.mock.calls.at(-1)?.[0] as Record<string, any>;
}

beforeEach(() => {
  countMock.mockReset();
  findManyMock.mockReset();
  findUniqueMock.mockReset();
});

describe("getProductCards", () => {
  it("maps a Prisma row to a flat card DTO", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([productRow()]);

    const result = await getProductCards();

    expect(result).toEqual({
      items: [
        {
          slug: "mesa-kendall",
          name: "Mesa Kendall",
          categoryName: "Mesas",
          categorySlug: "mesas",
          image: { url: "https://cdn.example/mesa.jpg", alt: "Mesa Kendall de frente" },
          fromPriceCents: 38990000,
          fromSalePriceCents: null,
          hasConsultPrice: false,
          inStock: true,
          materials: ["Roble"],
          tag: null,
        },
      ],
      page: 1,
      pageSize: 24,
      total: 1,
      totalPages: 1,
    });
    expect(PRODUCT_PAGE_SIZE).toBe(24);
  });

  it("reports inStock:true and never exposes stock when stock=0 and inStock=true [INV-2]", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({ variants: [variantRow({ stock: 0, inStock: true })] }),
    ]);

    const [card] = (await getProductCards()).items;

    expect(card.inStock).toBe(true);
    expect("stock" in card).toBe(false);
    expect(JSON.stringify(card)).not.toContain("stock\":");
  });

  it("reports inStock:false and never exposes stock when stock=0 and inStock=false [INV-2]", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({ variants: [variantRow({ stock: 0, inStock: false })] }),
    ]);

    const [card] = (await getProductCards()).items;

    expect(card.inStock).toBe(false);
    expect("stock" in card).toBe(false);
  });

  it("does not even select the stock column [INV-2]", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await getProductCards();

    expect("stock" in lastFindManyArgs().select.variants.select).toBe(false);
  });

  it("derives availability by OR-ing the variants' inStock", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({
        variants: [
          variantRow({ sku: "A", inStock: false }),
          variantRow({ sku: "B", inStock: true }),
        ],
      }),
    ]);

    expect((await getProductCards()).items[0].inStock).toBe(true);
  });

  it("takes both price fields from the cheapest effective variant", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({
        variants: [
          variantRow({ sku: "A", priceCents: 30000, salePriceCents: null }),
          variantRow({ sku: "B", priceCents: 50000, salePriceCents: 20000 }),
        ],
      }),
    ]);

    const [card] = (await getProductCards()).items;

    // Variant B is effectively cheaper (20000 < 30000), so BOTH the list price
    // and the sale price come from B — never a was/now pair from two variants.
    expect(card.fromPriceCents).toBe(50000);
    expect(card.fromSalePriceCents).toBe(20000);
  });

  it("ignores a sale price that is not a real discount", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({ variants: [variantRow({ priceCents: 30000, salePriceCents: 30000 })] }),
    ]);

    const [card] = (await getProductCards()).items;

    expect(card.fromPriceCents).toBe(30000);
    expect(card.fromSalePriceCents).toBeNull();
  });

  it("flags priceCents=0 as consult-price instead of a zero price [INV-1]", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({ variants: [variantRow({ priceCents: 0, salePriceCents: null })] }),
    ]);

    const [card] = (await getProductCards()).items;

    expect(card.hasConsultPrice).toBe(true);
    expect(card.fromPriceCents).toBeNull();
    expect(card.fromSalePriceCents).toBeNull();
  });

  it("keeps a real from-price when only some variants are consult-price", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({
        variants: [
          variantRow({ sku: "A", priceCents: 0 }),
          variantRow({ sku: "B", priceCents: 45000 }),
        ],
      }),
    ]);

    const [card] = (await getProductCards()).items;

    expect(card.hasConsultPrice).toBe(true);
    expect(card.fromPriceCents).toBe(45000);
  });

  it("lists distinct materials in DAL order and drops nulls", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({
        variants: [
          variantRow({ sku: "A", material: "Roble" }),
          variantRow({ sku: "B", material: null }),
          variantRow({ sku: "C", material: "Nogal" }),
          variantRow({ sku: "D", material: "Roble" }),
        ],
      }),
    ]);

    expect((await getProductCards()).items[0].materials).toEqual(["Roble", "Nogal"]);
  });

  it("falls back to the product name when the image has no alt text", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([
      productRow({ media: [{ url: "https://cdn.example/mesa.jpg", alt: null }] }),
    ]);

    expect((await getProductCards()).items[0].image).toEqual({
      url: "https://cdn.example/mesa.jpg",
      alt: "Mesa Kendall",
    });
  });

  it("returns a null image and null category when the product has neither", async () => {
    countMock.mockResolvedValueOnce(1);
    findManyMock.mockResolvedValueOnce([productRow({ media: [], categories: [] })]);

    const [card] = (await getProductCards()).items;

    expect(card.image).toBeNull();
    expect(card.categoryName).toBeNull();
    expect(card.categorySlug).toBeNull();
  });

  it("queries with a total order and the fixed page size", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await getProductCards();

    const args = lastFindManyArgs();

    expect(args.orderBy).toEqual([{ name: "asc" }, { slug: "asc" }]);
    expect(args.take).toBe(24);
    expect(args.skip).toBe(0);
    expect(args.where).toEqual({});
  });

  it("skips whole pages for a valid page number", async () => {
    countMock.mockResolvedValueOnce(60);
    findManyMock.mockResolvedValueOnce([]);

    const result = await getProductCards({ page: 3 });

    expect(lastFindManyArgs().skip).toBe(48);
    expect(result).toMatchObject({ page: 3, total: 60, totalPages: 3 });
  });

  it("clamps an out-of-range page instead of throwing or 404-ing", async () => {
    countMock.mockResolvedValueOnce(30);
    findManyMock.mockResolvedValueOnce([]);

    const result = await getProductCards({ page: 99 });

    expect(result.page).toBe(2);
    expect(lastFindManyArgs().skip).toBe(24);
  });

  it.each([
    ["zero", 0],
    ["negative", -5],
    ["fractional", 1.9],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("clamps a %s page to 1", async (_label, page) => {
    countMock.mockResolvedValueOnce(30);
    findManyMock.mockResolvedValueOnce([]);

    const result = await getProductCards({ page });

    expect(result.page).toBe(1);
    expect(lastFindManyArgs().skip).toBe(0);
  });

  it("returns an empty page for an empty catalog, not an error", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await expect(getProductCards({ page: 4 })).resolves.toEqual({
      items: [],
      page: 1,
      pageSize: 24,
      total: 0,
      totalPages: 0,
    });
  });

  it("propagates a thrown Prisma error instead of returning an empty page", async () => {
    countMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getProductCards()).rejects.toThrow("connection refused");
  });
});

describe("getProductCardsByCategory", () => {
  it("filters by category slug and keeps the same order and page size", async () => {
    countMock.mockResolvedValueOnce(2);
    findManyMock.mockResolvedValueOnce([productRow()]);

    const result = await getProductCardsByCategory("mesas");

    const args = lastFindManyArgs();

    expect(args.where).toEqual({ categories: { some: { slug: "mesas" } } });
    expect(args.orderBy).toEqual([{ name: "asc" }, { slug: "asc" }]);
    expect(countMock).toHaveBeenCalledWith({ where: { categories: { some: { slug: "mesas" } } } });
    expect(result.items).toHaveLength(1);
  });

  it("returns an empty page for a category with no products", async () => {
    countMock.mockResolvedValueOnce(0);
    findManyMock.mockResolvedValueOnce([]);

    await expect(getProductCardsByCategory("vacia")).resolves.toMatchObject({
      items: [],
      total: 0,
      totalPages: 0,
    });
  });
});

describe("getProductBySlug", () => {
  it("maps a Prisma row to a flat detail DTO without stock [INV-2, INV-9]", async () => {
    findUniqueMock.mockResolvedValueOnce(
      productRow({
        media: [
          { url: "https://cdn.example/1.jpg", alt: "Frente" },
          { url: "https://cdn.example/2.jpg", alt: null },
        ],
        variants: [variantRow({ sku: "RODAK-MESA-1", stock: 7, inStock: true })],
      }),
    );

    const detail = await getProductBySlug("mesa-kendall");

    expect(detail).toEqual({
      slug: "mesa-kendall",
      name: "Mesa Kendall",
      description: "Mesa de roble macizo.",
      categoryName: "Mesas",
      categorySlug: "mesas",
      media: [
        { url: "https://cdn.example/1.jpg", alt: "Frente" },
        { url: "https://cdn.example/2.jpg", alt: "Mesa Kendall" },
      ],
      variants: [
        {
          sku: "RODAK-MESA-1",
          material: "Roble",
          sizeMm: "1200x800",
          priceCents: 38990000,
          salePriceCents: null,
          inStock: true,
        },
      ],
      tag: null,
    });
    expect("stock" in detail!.variants[0]).toBe(false);
  });

  it("keeps inStock:true even when stock is 0 [INV-2]", async () => {
    findUniqueMock.mockResolvedValueOnce(
      productRow({ variants: [variantRow({ stock: 0, inStock: true })] }),
    );

    const detail = await getProductBySlug("mesa-kendall");

    expect(detail!.variants[0].inStock).toBe(true);
    expect("stock" in detail!.variants[0]).toBe(false);
  });

  it("keeps inStock:false when stock is 0 [INV-2]", async () => {
    findUniqueMock.mockResolvedValueOnce(
      productRow({ variants: [variantRow({ stock: 0, inStock: false })] }),
    );

    expect((await getProductBySlug("mesa-kendall"))!.variants[0].inStock).toBe(false);
  });

  it("keeps a real sale price and nulls a non-discount one", async () => {
    findUniqueMock.mockResolvedValueOnce(
      productRow({
        variants: [
          variantRow({ sku: "A", priceCents: 50000, salePriceCents: 40000 }),
          variantRow({ sku: "B", priceCents: 50000, salePriceCents: 60000 }),
        ],
      }),
    );

    const detail = await getProductBySlug("mesa-kendall");

    expect(detail!.variants[0].salePriceCents).toBe(40000);
    expect(detail!.variants[1].salePriceCents).toBeNull();
  });

  it("keeps priceCents=0 as-is so the PDP can render consultar precio [INV-1]", async () => {
    findUniqueMock.mockResolvedValueOnce(
      productRow({ variants: [variantRow({ priceCents: 0 })] }),
    );

    expect((await getProductBySlug("mesa-kendall"))!.variants[0].priceCents).toBe(0);
  });

  it("does not select the stock column and orders media and variants deterministically", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await getProductBySlug("mesa-kendall");

    const args = findUniqueMock.mock.calls.at(-1)?.[0] as Record<string, any>;

    expect(args.where).toEqual({ slug: "mesa-kendall" });
    expect("stock" in args.select.variants.select).toBe(false);
    expect(args.select.variants.orderBy).toEqual({ sku: "asc" });
    expect(args.select.media.orderBy).toEqual([{ position: "asc" }, { url: "asc" }]);
  });

  it("returns null when the slug does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(getProductBySlug("no-existe")).resolves.toBeNull();
  });

  it("propagates a thrown Prisma error instead of converting it to null", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getProductBySlug("mesa-kendall")).rejects.toThrow("connection refused");
  });
});
