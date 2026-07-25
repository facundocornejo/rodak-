import { beforeEach, describe, expect, it, vi } from "vitest";

// Same reason as products.test.ts: `server-only` throws outside Next's RSC
// bundler, so it must be stubbed for this module to load under plain Node.
vi.mock("server-only", () => ({}));

const countMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    review: {
      count: countMock,
      findMany: findManyMock,
    },
  },
}));

const { REVIEW_PAGE_SIZE, getApprovedReviews, getReviewSummary } = await import("./reviews");

interface FixtureRow {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  authorEmail: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: Date;
  productSlug: string;
}

// A small in-memory "database": mixed statuses and two products, so the
// mock's own findMany/count implementation has to honour the `where` clause
// the DAL sends — exactly the way a real Prisma query would. This is what
// makes "PENDING/REJECTED never appear in the output" an assertion about the
// DAL's query, not a coincidence of the fixture.
function fixtureRows(): FixtureRow[] {
  return [
    {
      id: "rev-approved-1",
      rating: 5,
      title: "Excelente",
      body: "Muy buena terminación.",
      authorName: "María G.",
      authorEmail: "maria@example.com",
      status: "APPROVED",
      createdAt: new Date("2026-06-01T12:00:00.000Z"),
      productSlug: "mesa-kendall",
    },
    {
      id: "rev-approved-2",
      rating: 4,
      title: null,
      body: "Buena calidad, tardó un poco.",
      authorName: "Juan P.",
      authorEmail: null,
      status: "APPROVED",
      createdAt: new Date("2026-06-05T12:00:00.000Z"),
      productSlug: "mesa-kendall",
    },
    {
      id: "rev-pending",
      rating: 1,
      title: "Sin revisar",
      body: "Todavía no fue aprobada.",
      authorName: "Pendiente Autor",
      authorEmail: "pending@example.com",
      status: "PENDING",
      createdAt: new Date("2026-06-06T12:00:00.000Z"),
      productSlug: "mesa-kendall",
    },
    {
      id: "rev-rejected",
      rating: 1,
      title: "Spam",
      body: "Rechazada por el dueño.",
      authorName: "Rechazado Autor",
      authorEmail: "rejected@example.com",
      status: "REJECTED",
      createdAt: new Date("2026-06-07T12:00:00.000Z"),
      productSlug: "mesa-kendall",
    },
    {
      id: "rev-other-product",
      rating: 5,
      title: "Otro producto",
      body: "Esta reseña es de otro producto.",
      authorName: "Otro Autor",
      authorEmail: null,
      status: "APPROVED",
      createdAt: new Date("2026-06-08T12:00:00.000Z"),
      productSlug: "silla-otra",
    },
  ];
}

/**
 * Mimics Prisma's own filtering + `select` projection so the mocks exercise
 * the real contract: the code under test builds `where`/`select`, and this
 * fake "database" is what proves those arguments actually restrict which
 * rows reach the DTO mapper — a fixture alone could not prove that.
 */
function applyWhere(rows: FixtureRow[], where: any): FixtureRow[] {
  return rows.filter(
    (row) => row.status === where.status && row.productSlug === where.product.slug,
  );
}

function project(row: FixtureRow, select: Record<string, boolean>): Record<string, unknown> {
  const projected: Record<string, unknown> = {};
  for (const key of Object.keys(select)) {
    if (select[key]) {
      projected[key] = (row as unknown as Record<string, unknown>)[key];
    }
  }
  return projected;
}

function wireMocks(rows: FixtureRow[]): void {
  countMock.mockImplementation(async ({ where }: any) => applyWhere(rows, where).length);
  findManyMock.mockImplementation(async (args: any) => {
    const matched = applyWhere(rows, args.where);
    const ordered = [...matched].sort((a, b) => {
      const byDate = b.createdAt.getTime() - a.createdAt.getTime();
      return byDate !== 0 ? byDate : a.id.localeCompare(b.id);
    });
    const page =
      typeof args.skip === "number" && typeof args.take === "number"
        ? ordered.slice(args.skip, args.skip + args.take)
        : ordered;

    return page.map((row) => project(row, args.select));
  });
}

function lastFindManyArgs(): Record<string, any> {
  return findManyMock.mock.calls.at(-1)?.[0] as Record<string, any>;
}

beforeEach(() => {
  countMock.mockReset();
  findManyMock.mockReset();
});

describe("getApprovedReviews", () => {
  it("maps an approved row to a flat DTO without authorEmail [INV-3]", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall");

    expect(result.items[0]).toEqual({
      id: "rev-approved-2",
      rating: 4,
      title: null,
      body: "Buena calidad, tardó un poco.",
      authorName: "Juan P.",
      createdAtISO: "2026-06-05T12:00:00.000Z",
    });
    expect(result.pageSize).toBe(REVIEW_PAGE_SIZE);
    expect(REVIEW_PAGE_SIZE).toBe(10);
  });

  it("never selects authorEmail [INV-3]: the select object has no such key", async () => {
    wireMocks(fixtureRows());

    await getApprovedReviews("mesa-kendall");

    expect("authorEmail" in lastFindManyArgs().select).toBe(false);
  });

  it("the returned DTOs carry no authorEmail field at all [INV-3]", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall");

    for (const review of result.items) {
      expect("authorEmail" in review).toBe(false);
    }
    expect(JSON.stringify(result.items)).not.toContain("authorEmail");
    expect(JSON.stringify(result.items)).not.toContain("@example.com");
  });

  it("only queries status=APPROVED for the requested product slug", async () => {
    wireMocks(fixtureRows());

    await getApprovedReviews("mesa-kendall");

    expect(lastFindManyArgs().where).toEqual({
      status: "APPROVED",
      product: { slug: "mesa-kendall" },
    });
  });

  it("never returns PENDING or REJECTED reviews, even though the fixture mixes statuses", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall");
    const ids = result.items.map((review) => review.id);

    expect(ids).not.toContain("rev-pending");
    expect(ids).not.toContain("rev-rejected");
    expect(ids.sort()).toEqual(["rev-approved-1", "rev-approved-2"]);
    expect(result.total).toBe(2);
  });

  it("never returns another product's approved review", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall");
    const ids = result.items.map((review) => review.id);

    expect(ids).not.toContain("rev-other-product");
  });

  it("returns an empty page for a product with zero approved reviews, not an error", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("producto-sin-resenas");

    expect(result).toEqual({
      items: [],
      page: 1,
      pageSize: REVIEW_PAGE_SIZE,
      total: 0,
      totalPages: 0,
    });
  });

  it("propagates a thrown Prisma error instead of returning an empty page", async () => {
    countMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getApprovedReviews("mesa-kendall")).rejects.toThrow("connection refused");
  });

  it("clamps an out-of-range page instead of throwing or 404-ing", async () => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall", { page: 99 });

    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  // The clamp helper is duplicated from products.ts, so it gets the same
  // edge-case matrix that module uses. A copy that is only spot-checked is how
  // two copies quietly stop agreeing.
  it.each([
    ["zero", 0],
    ["negative", -3],
    ["fractional", 1.7],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
  ])("clamps a %s page to 1", async (_label, page) => {
    wireMocks(fixtureRows());

    const result = await getApprovedReviews("mesa-kendall", { page });

    expect(result.page).toBe(1);
  });

  // Ordering is a CONTRACT, not a mock artifact: the fake database below sorts
  // rows itself, so without this assertion the DAL could drop the `id` tie-break
  // (or reverse the direction) and every other test here would stay green while
  // two reviews created in the same millisecond swapped between pages.
  it("asks Prisma for newest-first with a total order, so paging is stable", async () => {
    wireMocks(fixtureRows());

    await getApprovedReviews("mesa-kendall");

    expect(lastFindManyArgs().orderBy).toEqual([{ createdAt: "desc" }, { id: "asc" }]);
  });
});

describe("getReviewSummary", () => {
  it("aggregates count/average/histogram over APPROVED reviews only", async () => {
    wireMocks(fixtureRows());
    // getReviewSummary does not paginate, so skip/take are absent in its call.
    findManyMock.mockImplementation(async (args: any) =>
      applyWhere(fixtureRows(), args.where).map((row) => project(row, args.select)),
    );

    const summary = await getReviewSummary("mesa-kendall");

    expect(summary.count).toBe(2);
    expect(summary.average).toBe(4.5); // (5 + 4) / 2, PENDING/REJECTED excluded
    expect(summary.histogram).toEqual({ 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 });
  });

  it("never lets a PENDING or REJECTED rating leak into the histogram", async () => {
    wireMocks(fixtureRows());
    findManyMock.mockImplementation(async (args: any) =>
      applyWhere(fixtureRows(), args.where).map((row) => project(row, args.select)),
    );

    const summary = await getReviewSummary("mesa-kendall");

    // Both the pending and rejected fixtures carry rating=1; if they leaked
    // in, histogram[1] would be 2 instead of 0.
    expect(summary.histogram[1]).toBe(0);
  });

  it("returns count:0 and average:0 (never NaN) when there are no approved reviews", async () => {
    wireMocks(fixtureRows());
    findManyMock.mockImplementation(async (args: any) =>
      applyWhere(fixtureRows(), args.where).map((row) => project(row, args.select)),
    );

    const summary = await getReviewSummary("producto-sin-resenas");

    expect(summary).toEqual({
      count: 0,
      average: 0,
      histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    });
  });

  it("never selects authorEmail for the summary query either [INV-3]", async () => {
    wireMocks(fixtureRows());
    findManyMock.mockImplementation(async (args: any) =>
      applyWhere(fixtureRows(), args.where).map((row) => project(row, args.select)),
    );

    await getReviewSummary("mesa-kendall");

    expect("authorEmail" in findManyMock.mock.calls.at(-1)![0].select).toBe(false);
  });

  it("propagates a thrown Prisma error", async () => {
    findManyMock.mockRejectedValueOnce(new Error("connection refused"));

    await expect(getReviewSummary("mesa-kendall")).rejects.toThrow("connection refused");
  });
});
