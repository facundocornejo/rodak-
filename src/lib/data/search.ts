import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isQueryValid, rankRows } from "@/lib/search/rank";

import { PRODUCT_PAGE_SIZE, type PageResult, type ProductCardDTO, type ProductTag } from "./products";

/**
 * In-memory search (design D3). `getSearchIndexRows()` is the ONE query this
 * module ever issues — a flat projection over every product, no `LIKE`/
 * `ILIKE` and no interpolation of the user's query into SQL anywhere. The
 * query string only ever reaches `rank.ts`'s pure functions, in memory, after
 * the rows are already loaded — there is no injection surface because there
 * is no SQL surface at all.
 *
 * The select shape below intentionally duplicates most of `products.ts`'s
 * `productCardSelect` (same category/media/variant fields) plus `description`
 * (which the card select omits — cards never render it, ranking needs it).
 * `products.ts`'s own mapping helpers (`toProductCard`, `cheapestPricedVariant`,
 * `saleOf`, `mediaAlt`, `pickTag`, `distinctMaterials`) are module-private and
 * this task's file scope does not include editing `products.ts`, so the
 * mapping is re-implemented here rather than exported-and-shared — the same
 * choice `reviews.ts` already made for its own `clampPage` duplicate, and for
 * the same reason (one small pure function is not worth coupling two DAL
 * modules' file scopes across separate PRs).
 */

const singleCategorySelect = {
  select: { name: true, slug: true },
  orderBy: { slug: "asc" },
  take: 1,
} satisfies Prisma.Product$categoriesArgs;

const mediaOrderBy: Prisma.ProductMediaOrderByWithRelationInput[] = [
  { position: "asc" },
  { url: "asc" },
];

const searchIndexSelect = {
  slug: true,
  name: true,
  // The one field this projection carries beyond the card select: ranking
  // needs it (`RankableRow`), the card DTO never renders it.
  description: true,
  tags: true,
  categories: singleCategorySelect,
  media: {
    select: { url: true, alt: true },
    orderBy: mediaOrderBy,
    take: 1,
  },
  variants: {
    // `stock` is deliberately absent [INV-2], same as `products.ts`.
    select: { material: true, priceCents: true, salePriceCents: true, inStock: true },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductSelect;

/**
 * One row of the search index. Satisfies `rank.ts`'s `RankableRow` (`slug`,
 * `name`, `description`) structurally, so `rankRows` can be handed this exact
 * type and hand back these exact objects, ranked — no re-query by slug, no
 * intermediate DTO.
 */
export type SearchIndexRow = Prisma.ProductGetPayload<{ select: typeof searchIndexSelect }>;

/**
 * The whole catalog's search projection, ONE query, no filter. Ordered by
 * `slug asc` only so repeated calls are stable before ranking touches
 * anything — `rank.ts`'s own tie-break (name, then slug) is what actually
 * decides same-score order, this is not a substitute for that.
 */
export function getSearchIndexRows(): Promise<SearchIndexRow[]> {
  return prisma.product.findMany({
    select: searchIndexSelect,
    orderBy: { slug: "asc" },
  });
}

type PricedRow = { priceCents: number; salePriceCents: number | null };

/** Duplicated from `products.ts`'s `saleOf` — see the module docblock above. */
function saleOf(variant: PricedRow): number | null {
  const { salePriceCents, priceCents } = variant;

  if (salePriceCents === null || salePriceCents <= 0 || salePriceCents >= priceCents) {
    return null;
  }

  return salePriceCents;
}

function effectivePriceCents(variant: PricedRow): number {
  return saleOf(variant) ?? variant.priceCents;
}

/** Duplicated from `products.ts`'s `cheapestPricedVariant` [INV-1]. */
function cheapestPricedVariant<T extends PricedRow>(variants: T[]): T | null {
  let cheapest: T | null = null;

  for (const variant of variants) {
    if (variant.priceCents <= 0) {
      continue;
    }

    if (cheapest === null || effectivePriceCents(variant) < effectivePriceCents(cheapest)) {
      cheapest = variant;
    }
  }

  return cheapest;
}

function mediaAlt(alt: string | null, productName: string): string {
  return alt !== null && alt.trim() !== "" ? alt : productName;
}

function pickTag(tags: ProductTag[] | null | undefined): ProductTag | null {
  if (!tags) return null;
  if (tags.includes("BEST_SELLER")) return "BEST_SELLER";
  if (tags.includes("NEW")) return "NEW";
  return null;
}

function distinctMaterials(variants: { material: string | null }[]): string[] {
  const materials: string[] = [];

  for (const { material } of variants) {
    if (material !== null && material.trim() !== "" && !materials.includes(material)) {
      materials.push(material);
    }
  }

  return materials;
}

/** Duplicated from `products.ts`'s `toProductCard` — see the module docblock above. */
function toSearchCard(row: SearchIndexRow): ProductCardDTO {
  const cheapest = cheapestPricedVariant(row.variants);
  const category = row.categories[0] ?? null;
  const image = row.media[0] ?? null;

  return {
    slug: row.slug,
    name: row.name,
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
    image: image === null ? null : { url: image.url, alt: mediaAlt(image.alt, row.name) },
    fromPriceCents: cheapest?.priceCents ?? null,
    fromSalePriceCents: cheapest === null ? null : saleOf(cheapest),
    hasConsultPrice: row.variants.some((variant) => variant.priceCents === 0),
    inStock: row.variants.some((variant) => variant.inStock),
    materials: distinctMaterials(row.variants),
    tag: pickTag(row.tags),
  };
}

/** Same clamp contract as `products.ts`'s private `clampPage` (design D12). */
function clampPage(page: number | undefined, totalPages: number): number {
  const lastPage = Math.max(totalPages, 1);

  if (typeof page !== "number" || !Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(page), 1), lastPage);
}

function paginateRanked(
  rows: SearchIndexRow[],
  page: number | undefined,
): PageResult<ProductCardDTO> {
  const total = rows.length;
  const totalPages = Math.ceil(total / PRODUCT_PAGE_SIZE);
  const clampedPage = clampPage(page, totalPages);
  const start = (clampedPage - 1) * PRODUCT_PAGE_SIZE;

  return {
    // Map to the DTO only for the current page's slice — ranking already
    // produced the caller's own row objects (`rank.test.ts`: "hands back the
    // caller's own row objects"), so there is nothing to re-query by slug.
    items: rows.slice(start, start + PRODUCT_PAGE_SIZE).map(toSearchCard),
    page: clampedPage,
    pageSize: PRODUCT_PAGE_SIZE,
    total,
    totalPages,
  };
}

export interface SearchOptions {
  page?: number;
}

/**
 * Discriminated on `validQuery` so a caller (the `/buscar/` page) is forced
 * by the type system to check it before touching `result` — `validQuery:
 * false` is a distinct state from "valid query, zero matches"
 * (`validQuery: true` with an empty `items`), and the page renders a
 * different component for each (`QueryTooShort` vs `EmptyState`).
 */
export type SearchProductsResult =
  | { validQuery: false }
  | { validQuery: true; result: PageResult<ProductCardDTO> };

/**
 * Validate first, load second. An invalid-length query (design D3: below
 * `MIN_QUERY_LENGTH` or above `MAX_QUERY_LENGTH`, both from `rank.ts`) returns
 * `{ validQuery: false }` WITHOUT calling `getSearchIndexRows()` at all — the
 * whole point of the guard is to skip the database round trip for a query
 * that cannot possibly run, not just to skip ranking it.
 */
export async function searchProducts(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchProductsResult> {
  if (!isQueryValid(query)) {
    return { validQuery: false };
  }

  const rows = await getSearchIndexRows();
  const ranked = rankRows(rows, query);

  return { validQuery: true, result: paginateRanked(ranked, opts.page) };
}
