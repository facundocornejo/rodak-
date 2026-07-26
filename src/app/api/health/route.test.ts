import { beforeEach, describe, expect, it, vi } from "vitest";

// `server-only` throws unconditionally outside Next's RSC bundler — same
// stubbing pattern as `products.test.ts`/`search.test.ts`.
vi.mock("server-only", () => ({}));

const queryRawMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: queryRawMock,
  },
}));

const { GET } = await import("./route");

beforeEach(() => {
  // `mockResolvedValueOnce`/`mockRejectedValueOnce`/`mockReturnValueOnce`
  // queues leak across tests if not reset here (house gotcha, see
  // `products.test.ts`/`search.test.ts`).
  queryRawMock.mockReset();
});

describe("GET /api/health — success", () => {
  it("returns exactly {status:\"ok\"} with a 200 and Cache-Control: no-store", async () => {
    queryRawMock.mockResolvedValueOnce([{ "?column?": 1 }]);

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ status: "ok" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/health — DB query rejects", () => {
  it("returns exactly {status:\"error\"} with a 503 and Cache-Control: no-store", async () => {
    queryRawMock.mockRejectedValueOnce(new Error("connection terminated unexpectedly"));

    const response = await GET();
    const body: unknown = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ status: "error" });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never leaks the underlying error message, a Prisma error code, or anything resembling a connection string into the body", async () => {
    const secretLookingUrl = "postgresql://rodak:s3cr3t-dev-only@db.internal:5432/rodak?sslmode=require";
    const prismaLikeError = Object.assign(
      new Error(`P1001: Can't reach database server at db.internal:5432 (${secretLookingUrl})`),
      { code: "P1001" },
    );
    queryRawMock.mockRejectedValueOnce(prismaLikeError);

    const response = await GET();
    const text = await response.text();

    expect(text).not.toContain(secretLookingUrl);
    expect(text).not.toContain("s3cr3t-dev-only");
    expect(text).not.toContain("P1001");
    expect(text).not.toContain("Can't reach database server");
    // The only two words this endpoint is allowed to say about the failure.
    expect(text).toBe(JSON.stringify({ status: "error" }));
  });
});

describe("GET /api/health — timeout", () => {
  it("resolves 503 once the 2s budget elapses, without ever waiting 2 real seconds", async () => {
    vi.useFakeTimers();

    try {
      // A query that never settles within the test's lifetime — the route
      // must resolve from the timeout branch, not by waiting on this forever.
      queryRawMock.mockReturnValueOnce(new Promise<never>(() => {}));

      const responsePromise = GET();

      // Advances virtual time past the 2s budget and flushes the resulting
      // microtasks — no real 2000ms elapses in this test.
      await vi.advanceTimersByTimeAsync(2000);

      const response = await responsePromise;
      const body: unknown = await response.json();

      expect(response.status).toBe(503);
      expect(body).toEqual({ status: "error" });
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not throw an unhandled rejection when the query eventually settles after the timeout already won", async () => {
    vi.useFakeTimers();
    const unhandledRejections: unknown[] = [];
    const onUnhandledRejection = (reason: unknown) => unhandledRejections.push(reason);
    process.on("unhandledRejection", onUnhandledRejection);

    try {
      let rejectQuery: (reason: unknown) => void = () => {};
      queryRawMock.mockReturnValueOnce(
        new Promise<never>((_resolve, reject) => {
          rejectQuery = reject;
        }),
      );

      const responsePromise = GET();
      await vi.advanceTimersByTimeAsync(2000);
      const response = await responsePromise;
      expect(response.status).toBe(503);

      // The loser of the race rejects AFTER the response was already sent —
      // this must not surface as an unhandled rejection (see route.ts's
      // inline `.then(ok, error)` on the query promise).
      rejectQuery(new Error("late rejection, after the timeout already answered"));
      await vi.advanceTimersByTimeAsync(0);
      await Promise.resolve();

      expect(unhandledRejections).toEqual([]);
    } finally {
      process.off("unhandledRejection", onUnhandledRejection);
      vi.useRealTimers();
    }
  });
});
