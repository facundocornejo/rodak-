import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

// The prisma singleton suite lives here (not in db.test.ts) because the
// review correction that introduced it was bounded to already-reviewed
// files; products.test.ts is unsuitable — its vi.mock of @/lib/db would
// intercept the real module under test.
const prismaPgInstances = vi.hoisted(() => ({ count: 0 }));

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: class {
    constructor() {
      prismaPgInstances.count += 1;
    }
  },
}));

vi.mock("@prisma/client", () => ({
  PrismaClient: class {
    product = { findMany: async () => [] };
  },
}));

describe("prisma client singleton", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    (globalThis as { prisma?: unknown }).prisma = undefined;
    prismaPgInstances.count = 0;
    vi.resetModules();
  });

  it("throws a clear error when DATABASE_URL is missing", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { prisma } = await import("./db");
    expect(() => prisma.product).toThrowError(/DATABASE_URL is not set/);
  });

  it("constructs the underlying client exactly once across repeated access in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "postgresql://user:pass@localhost:5434/db");
    const { prisma } = await import("./db");

    void prisma.product;
    void prisma.product;
    void prisma.product;

    expect(prismaPgInstances.count).toBe(1);
  });
});

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost when neither SITE_URL nor STAGING_HOST is set", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("STAGING_HOST", "");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("derives an https URL from STAGING_HOST when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("STAGING_HOST", "rodak.fromdevdiego.com");

    expect(getSiteUrl()).toBe("https://rodak.fromdevdiego.com");
  });

  it("prefers SITE_URL over a STAGING_HOST-derived URL", () => {
    vi.stubEnv("SITE_URL", "https://rodak.com.ar");
    vi.stubEnv("STAGING_HOST", "rodak.fromdevdiego.com");

    expect(getSiteUrl()).toBe("https://rodak.com.ar");
  });

  it("never falls back to localhost once SITE_URL is set, even without STAGING_HOST", () => {
    vi.stubEnv("SITE_URL", "https://rodak.com.ar");
    vi.stubEnv("STAGING_HOST", "");

    expect(getSiteUrl()).toBe("https://rodak.com.ar");
  });
});
