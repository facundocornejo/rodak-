import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { isQueryValid, rankRows } from "@/lib/search/rank";

import {
  clampPage,
  PRODUCT_PAGE_SIZE,
  toProductCard,
  type PageResult,
  type ProductCardDTO,
} from "./products";

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
 *
 * PR8 review-follow-up: the mapping helpers themselves (`toProductCard`,
 * `cheapestPricedVariant`, `saleOf`, `mediaAlt`, `pickTag`, `distinctMaterials`,
 * `clampPage`) used to be re-implemented here byte-for-byte, because they were
 * module-private in `products.ts` and this file's original task scope did not
 * include editing that module. That duplication is exactly what this review
 * follow-up closes: `products.ts` now exports those helpers (generalized where
 * needed — see its `ProductCardRowLike`) and this module imports them
 * instead of re-defining them, so the two DAL modules cannot silently drift
 * on what counts as, say, a valid sale price. `reviews.ts`'s own separate
 * `clampPage` duplicate was NOT touched here (out of this task's file scope)
 * and remains a documented exception.
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
    // `toProductCard` (imported from `products.ts`) is the SAME function the
    // category grid uses (PR8 review-follow-up) — no second implementation.
    items: rows.slice(start, start + PRODUCT_PAGE_SIZE).map(toProductCard),
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
