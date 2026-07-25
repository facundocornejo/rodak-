import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import type { PageResult } from "./products";

/**
 * Fixed page size for a product's review list. Not specified by the design's
 * DTO table (only `getApprovedReviews(productSlug, opts): Promise<PageResult<ReviewDTO>>`
 * is fixed); reviews are far sparser than the 88-product catalog, so 10 keeps
 * a single page readable without a component ever needing to page through it
 * in Fase 2's data.
 */
export const REVIEW_PAGE_SIZE = 10;

/**
 * NOTE: no `authorEmail` [INV-3]. `authorEmail` is optional, collected for the
 * owner's own follow-up only (see REVIEWS.md) and must never reach a public
 * DTO or HTML.
 */
export interface ReviewDTO {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  authorName: string;
  createdAtISO: string;
}

export interface ReviewSummaryDTO {
  count: number;
  average: number;
  histogram: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface ReviewListOptions {
  /** Same clamp contract as `ListOptions.page` in products.ts (design D12). */
  page?: number;
}

// Explicit select — deliberately NO `authorEmail` [INV-3]. This is the
// enforcement point: the column is simply never read, not filtered out after
// the fact from a wider row.
const reviewSelect = {
  id: true,
  rating: true,
  title: true,
  body: true,
  authorName: true,
  createdAt: true,
} satisfies Prisma.ReviewSelect;

type ReviewRow = Prisma.ReviewGetPayload<{ select: typeof reviewSelect }>;

function toReview(row: ReviewRow): ReviewDTO {
  return {
    id: row.id,
    rating: row.rating,
    title: row.title,
    body: row.body,
    authorName: row.authorName,
    createdAtISO: row.createdAt.toISOString(),
  };
}

/**
 * Duplicated from `products.ts`'s `clampPage` on purpose: that function is
 * not exported (products.ts is a separate, already-shipped PR's file scope)
 * and this is a five-line pure function — not worth coupling two DAL modules
 * over. Same contract: out-of-range clamps into `[1, max(totalPages, 1)]`,
 * never an error.
 */
function clampPage(page: number | undefined, totalPages: number): number {
  const lastPage = Math.max(totalPages, 1);

  if (typeof page !== "number" || !Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(page), 1), lastPage);
}

function approvedWhere(productSlug: string): Prisma.ReviewWhereInput {
  // `status: "APPROVED"` only — PENDING/REJECTED must never reach a caller
  // (spec product-reviews, design D10). Filtered by the product's slug via
  // the relation rather than a pre-resolved id, so a bad slug is simply an
  // empty result, matching the DAL's other "not found → empty, not error"
  // list contracts.
  return { status: "APPROVED", product: { slug: productSlug } };
}

/**
 * Paginated APPROVED reviews for one product, newest first (ties broken by
 * `id asc` for a total order across pages, same reasoning as `slug` in
 * products.ts). A Prisma/connection failure propagates — never laundered
 * into an empty page.
 */
export async function getApprovedReviews(
  productSlug: string,
  opts: ReviewListOptions = {},
): Promise<PageResult<ReviewDTO>> {
  const where = approvedWhere(productSlug);

  const total = await prisma.review.count({ where });
  const totalPages = Math.ceil(total / REVIEW_PAGE_SIZE);
  const page = clampPage(opts.page, totalPages);

  const rows = await prisma.review.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    skip: (page - 1) * REVIEW_PAGE_SIZE,
    take: REVIEW_PAGE_SIZE,
    select: reviewSelect,
  });

  return {
    items: rows.map(toReview),
    page,
    pageSize: REVIEW_PAGE_SIZE,
    total,
    totalPages,
  };
}

function emptyHistogram(): Record<1 | 2 | 3 | 4 | 5, number> {
  return { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
}

/**
 * Aggregate over the same APPROVED-only set as `getApprovedReviews`. `rating`
 * is DB-constrained to `1..5` (`Review_rating_range`), so the histogram keys
 * are exhaustive; `average` is `0` (never `NaN`) for zero approved reviews —
 * the caller renders the defined empty state instead of dividing by zero.
 */
export async function getReviewSummary(productSlug: string): Promise<ReviewSummaryDTO> {
  const rows = await prisma.review.findMany({
    where: approvedWhere(productSlug),
    select: { rating: true },
  });

  const histogram = emptyHistogram();
  let sum = 0;

  for (const { rating } of rows) {
    sum += rating;
    if (rating >= 1 && rating <= 5) {
      histogram[rating as 1 | 2 | 3 | 4 | 5] += 1;
    }
  }

  return {
    count: rows.length,
    average: rows.length === 0 ? 0 : sum / rows.length,
    histogram,
  };
}
