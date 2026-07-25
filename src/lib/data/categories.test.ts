import { beforeEach, describe, expect, it, vi } from "vitest";

// See products.test.ts: `server-only` only resolves inside Next's RSC bundler.
vi.mock("server-only", () => ({}));

const findManyMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    category: {
      findMany: findManyMock,
      findUnique: findUniqueMock,
    },
  },
}));

const { getCategories, getCategoryBySlug } = await import("./categories");

function categoryRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    slug: "mesas",
    name: "Mesas",
    _count: { products: 12 },
    ...overrides,
  };
}

beforeEach(() => {
  findManyMock.mockReset();
  findUniqueMock.mockReset();
});

describe("getCategories", () => {
  it("maps Prisma rows to flat DTOs with the product count", async () => {
    findManyMock.mockResolvedValueOnce([
      categoryRow(),
      categoryRow({ slug: "sillas", name: "Sillas", _count: { products: 0 } }),
    ]);

    await expect(getCategories()).resolves.toEqual([
      { slug: "mesas", name: "Mesas", productCount: 12 },
      { slug: "sillas", name: "Sillas", productCount: 0 },
    ]);
  });

  it("queries with a total order", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await getCategories();

    expect(findManyMock.mock.calls.at(-1)?.[0]).toMatchObject({
      orderBy: [{ name: "asc" }, { slug: "asc" }],
    });
  });

  it("returns an empty array when there are no categories", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await expect(getCategories()).resolves.toEqual([]);
  });

  it("propagates a thrown Prisma error", async () => {
    findManyMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getCategories()).rejects.toThrow("connection refused");
  });
});

describe("getCategoryBySlug", () => {
  it("maps a single row and queries by slug", async () => {
    findUniqueMock.mockResolvedValueOnce(categoryRow());

    await expect(getCategoryBySlug("mesas")).resolves.toEqual({
      slug: "mesas",
      name: "Mesas",
      productCount: 12,
    });
    expect(findUniqueMock.mock.calls.at(-1)?.[0]).toMatchObject({ where: { slug: "mesas" } });
  });

  it("returns null when the slug does not exist", async () => {
    findUniqueMock.mockResolvedValueOnce(null);

    await expect(getCategoryBySlug("no-existe")).resolves.toBeNull();
  });

  it("propagates a thrown Prisma error instead of converting it to null", async () => {
    findUniqueMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getCategoryBySlug("mesas")).rejects.toThrow("connection refused");
  });
});
