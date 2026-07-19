import { describe, expect, it, vi } from "vitest";

// `server-only` throws unconditionally outside Next's RSC bundler (it relies
// on a webpack alias Next provides at build time to swap it for a no-op).
// Vitest runs in plain Node, so it must be stubbed for this DAL module to
// load at all.
vi.mock("server-only", () => ({}));

const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    product: {
      findMany: findManyMock,
    },
  },
}));

const { getProductsForListing } = await import("./products");

describe("getProductsForListing", () => {
  it("maps Prisma rows to minimal plain DTOs, preserving cents as integers", async () => {
    findManyMock.mockResolvedValueOnce([
      {
        id: "prod_1",
        slug: "cajonera-kendall",
        name: "Cajonera Kendall",
        description: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        variants: [
          {
            id: "var_1",
            productId: "prod_1",
            sku: "RODAK-CAJONERA-KENDALL",
            material: null,
            sizeMm: null,
            priceCents: 38990000,
            stock: 5,
            createdAt: new Date("2026-01-01T00:00:00Z"),
            updatedAt: new Date("2026-01-01T00:00:00Z"),
          },
        ],
      },
    ]);

    const result = await getProductsForListing();

    expect(result).toEqual([
      {
        slug: "cajonera-kendall",
        name: "Cajonera Kendall",
        variants: [
          {
            sku: "RODAK-CAJONERA-KENDALL",
            material: null,
            sizeMm: null,
            priceCents: 38990000,
            stock: 5,
          },
        ],
      },
    ]);
  });

  it("queries with a deterministic order and includes variants", async () => {
    findManyMock.mockResolvedValueOnce([]);

    await getProductsForListing();

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: { name: "asc" },
      include: { variants: { orderBy: { sku: "asc" } } },
    });
  });

  it("returns an empty array when the catalog has no products, not a raw Prisma object", async () => {
    findManyMock.mockResolvedValueOnce([]);

    const result = await getProductsForListing();

    expect(result).toEqual([]);
  });
});
