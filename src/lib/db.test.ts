import { afterEach, describe, expect, it, vi } from "vitest";

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
