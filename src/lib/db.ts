import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires a driver adapter at runtime (schema.prisma no longer
// carries a connection URL — see prisma.config.ts and design D2/D5).
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getPrismaClient(): PrismaClient {
  if (globalForPrisma.prisma) {
    return globalForPrisma.prisma;
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Local dev: pass it inline (see README). Staging: set it in Coolify env vars.",
    );
  }

  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  // Cache unconditionally: the exported Proxy calls getPrismaClient() on
  // EVERY property access, so without this cache each query would build a
  // new client + pg pool (connection exhaustion under real traffic). The
  // global also survives Next.js dev hot-reloads.
  globalForPrisma.prisma = client;

  return client;
}

// Lazily create the real client on first use. Importing this module must
// stay side-effect-free: Next's build-time page-data collection loads every
// route module — even `dynamic = "force-dynamic"` ones — just to read its
// static exports, without executing any handler (see design "CI builds
// without DB"). A Proxy defers the DATABASE_URL check to the first actual
// query instead of module load, so `next build` succeeds with no database.
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getPrismaClient() as object, prop, receiver);
  },
});
