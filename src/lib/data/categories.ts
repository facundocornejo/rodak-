import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export interface CategoryDTO {
  slug: string;
  name: string;
  /** Number of products linked to the category. */
  productCount: number;
}

const categorySelect = {
  slug: true,
  name: true,
  _count: { select: { products: true } },
} satisfies Prisma.CategorySelect;

type CategoryRow = Prisma.CategoryGetPayload<{ select: typeof categorySelect }>;

function toCategory(row: CategoryRow): CategoryDTO {
  return {
    slug: row.slug,
    name: row.name,
    productCount: row._count.products,
  };
}

/**
 * All categories in `name asc, slug asc` order — `slug` is unique, so the pair
 * is a total order and the list is stable across requests (design D12).
 */
export async function getCategories(): Promise<CategoryDTO[]> {
  const rows = await prisma.category.findMany({
    orderBy: [{ name: "asc" }, { slug: "asc" }],
    select: categorySelect,
  });

  return rows.map(toCategory);
}

/**
 * `null` means "no such category" and nothing else. A Prisma/connection failure
 * is deliberately NOT caught: a database outage must surface as an error, not
 * be laundered into a 404 (same contract as `getProductBySlug`).
 */
export async function getCategoryBySlug(slug: string): Promise<CategoryDTO | null> {
  const row = await prisma.category.findUnique({
    where: { slug },
    select: categorySelect,
  });

  return row === null ? null : toCategory(row);
}
