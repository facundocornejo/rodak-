import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Pass it inline when running the seed, e.g.\n" +
      '  DATABASE_URL="postgresql://..." npx tsx prisma/seed.ts',
  );
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

interface SeedVariant {
  sku: string;
  material?: string;
  sizeMm?: string;
  priceCents: number;
  stock: number;
}

interface SeedProduct {
  slug: string;
  name: string;
  categorySlug: string;
  categoryName: string;
  variant: SeedVariant;
}

// Real Rodak catalog subset (see AUDITORIA.md and spec "Realistic Seed
// Data"). Slugs follow the existing WooCommerce URL pattern
// (/producto/{slug}/, see design D4), derived from each product's name.
// Prices are integer cents, never floats (see spec "Money and Date
// Invariants"): e.g. "Escritorio Brent Paraíso" at ARS 1.112.713 is stored
// as 111271300.
const SEED_PRODUCTS: SeedProduct[] = [
  {
    slug: "escritorio-brent-paraiso",
    name: "Escritorio Brent Paraíso",
    categorySlug: "escritorios",
    categoryName: "Escritorios",
    variant: { sku: "RODAK-ESCRITORIO-BRENT-PARAISO", priceCents: 111271300, stock: 5 },
  },
  {
    slug: "escritorio-vancouver",
    name: "Escritorio Vancouver",
    categorySlug: "escritorios",
    categoryName: "Escritorios",
    variant: { sku: "RODAK-ESCRITORIO-VANCOUVER", priceCents: 52764000, stock: 5 },
  },
  {
    slug: "estanteria-franklin",
    name: "Estantería Franklin",
    categorySlug: "estanterias",
    categoryName: "Estanterías",
    variant: { sku: "RODAK-ESTANTERIA-FRANKLIN", priceCents: 144972600, stock: 5 },
  },
  {
    slug: "cajonera-kendall",
    name: "Cajonera Kendall",
    categorySlug: "cajoneras",
    categoryName: "Cajoneras",
    variant: { sku: "RODAK-CAJONERA-KENDALL", priceCents: 38990000, stock: 5 },
  },
  {
    slug: "soporte-auricular",
    name: "Soporte auricular",
    categorySlug: "accesorios",
    categoryName: "Accesorios",
    variant: { sku: "RODAK-SOPORTE-AURICULAR", priceCents: 2911700, stock: 20 },
  },
  {
    slug: "soporte-celular",
    name: "Soporte celular",
    categorySlug: "accesorios",
    categoryName: "Accesorios",
    variant: { sku: "RODAK-SOPORTE-CELULAR", priceCents: 613500, stock: 20 },
  },
];

async function main() {
  for (const item of SEED_PRODUCTS) {
    const category = await prisma.category.upsert({
      where: { slug: item.categorySlug },
      update: { name: item.categoryName },
      create: { slug: item.categorySlug, name: item.categoryName },
    });

    const product = await prisma.product.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        categories: { connect: { id: category.id } },
      },
      create: {
        slug: item.slug,
        name: item.name,
        categories: { connect: { id: category.id } },
      },
    });

    await prisma.productVariant.upsert({
      where: { sku: item.variant.sku },
      update: {
        productId: product.id,
        material: item.variant.material,
        sizeMm: item.variant.sizeMm,
        priceCents: item.variant.priceCents,
        stock: item.variant.stock,
      },
      create: {
        sku: item.variant.sku,
        productId: product.id,
        material: item.variant.material,
        sizeMm: item.variant.sizeMm,
        priceCents: item.variant.priceCents,
        stock: item.variant.stock,
      },
    });
  }

  const productCount = await prisma.product.count();
  console.log(`Seed complete. ${productCount} products in the database.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
