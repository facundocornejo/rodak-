import "server-only";

import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

/**
 * Fixed page size for every catalog listing (design D12). Exported so the
 * surfaces can reason about page counts without re-deriving the constant.
 */
export const PRODUCT_PAGE_SIZE = 24;

/**
 * Highlight tag. Owner-curated via `Product.tags` (design D11); at most one
 * renders per card/PDP, BEST_SELLER winning over NEW when a product carries
 * both.
 */
export type ProductTag = "BEST_SELLER" | "NEW";

export interface ProductCardDTO {
  slug: string;
  name: string;
  categoryName: string | null;
  categorySlug: string | null;
  image: { url: string; alt: string } | null;
  /** List price of the cheapest variant; `null` when no variant is priced. */
  fromPriceCents: number | null;
  /** Sale price of that same variant; `null` when it is not on sale. */
  fromSalePriceCents: number | null;
  /** At least one variant has `priceCents === 0` ("consultar precio"). */
  hasConsultPrice: boolean;
  /** OR over the variants' `inStock`. Never derived from `stock` [INV-2]. */
  inStock: boolean;
  materials: string[];
  tag: ProductTag | null;
}

/**
 * NOTE: no `stock`. Availability is `inStock` and nothing else [INV-2]; the
 * Prisma `select` below does not even read the `stock` column.
 */
export interface ProductVariantDTO {
  sku: string;
  material: string | null;
  sizeMm: string | null;
  priceCents: number;
  salePriceCents: number | null;
  inStock: boolean;
}

export interface ProductDetailDTO {
  slug: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  categorySlug: string | null;
  media: { url: string; alt: string }[];
  variants: ProductVariantDTO[];
  tag: ProductTag | null;
}

export interface PageResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ListOptions {
  /**
   * 1-based page number. Anything out of range is clamped to
   * `[1, max(totalPages, 1)]` — an out-of-range page is never an error and
   * never a 404 (design D12). The clamped value is echoed back in
   * `PageResult.page` so pagination controls stay consistent.
   */
  page?: number;
}

// A product's category set is many-to-many, but cards and the PDP header show
// a single category. `slug asc` + `take: 1` makes that choice deterministic
// instead of dependent on insertion order.
const singleCategorySelect = {
  select: { name: true, slug: true },
  orderBy: { slug: "asc" },
  take: 1,
} satisfies Prisma.Product$categoriesArgs;

// `position asc` is the authored gallery order; `url asc` breaks ties so two
// media rows sharing a position never swap between requests.
const mediaOrderBy: Prisma.ProductMediaOrderByWithRelationInput[] = [
  { position: "asc" },
  { url: "asc" },
];

const productCardSelect = {
  slug: true,
  name: true,
  tags: true,
  categories: singleCategorySelect,
  media: {
    select: { url: true, alt: true },
    orderBy: mediaOrderBy,
    take: 1,
  },
  variants: {
    // `stock` is deliberately absent [INV-2].
    select: { material: true, priceCents: true, salePriceCents: true, inStock: true },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductSelect;

const productDetailSelect = {
  slug: true,
  name: true,
  description: true,
  tags: true,
  categories: singleCategorySelect,
  media: {
    select: { url: true, alt: true },
    orderBy: mediaOrderBy,
  },
  variants: {
    // `stock` is deliberately absent [INV-2].
    select: {
      sku: true,
      material: true,
      sizeMm: true,
      priceCents: true,
      salePriceCents: true,
      inStock: true,
    },
    orderBy: { sku: "asc" },
  },
} satisfies Prisma.ProductSelect;

type ProductCardRow = Prisma.ProductGetPayload<{ select: typeof productCardSelect }>;
type ProductDetailRow = Prisma.ProductGetPayload<{ select: typeof productDetailSelect }>;
type PricedRow = { priceCents: number; salePriceCents: number | null };

/**
 * A sale price only counts when it is a real discount over the list price.
 * `0`, negatives and values at or above `priceCents` would render as
 * "was $100 / now $120" or a 0% saving, so they are reported as "not on sale"
 * rather than passed through raw.
 */
function saleOf(variant: PricedRow): number | null {
  const { salePriceCents, priceCents } = variant;

  if (salePriceCents === null || salePriceCents <= 0 || salePriceCents >= priceCents) {
    return null;
  }

  return salePriceCents;
}

/** Price a customer would actually pay for this variant, in integer cents. */
function effectivePriceCents(variant: PricedRow): number {
  return saleOf(variant) ?? variant.priceCents;
}

/**
 * `priceCents === 0` means "consultar precio" [INV-1], not "free", so those
 * variants are excluded from the "from" price entirely. Both card price fields
 * are read off the SAME cheapest variant: mixing a list price from one variant
 * with a sale price from another can produce a nonsensical was/now pair.
 */
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

/**
 * `ProductMedia.alt` is nullable, but the DTO promises a string: an image
 * without alt text is not decorative, so it falls back to the product name
 * (a description of what the image actually shows, not invented copy).
 */
function mediaAlt(alt: string | null, productName: string): string {
  return alt !== null && alt.trim() !== "" ? alt : productName;
}

/**
 * At most one badge renders (design D11): BEST_SELLER wins over NEW when a
 * product carries both, and an empty array (the default, no owner curation
 * yet) maps to `null` rather than a fabricated tag.
 *
 * The parameter is typed nullable even though Prisma types the field as a
 * required list. Prisma has no "optional list" in its schema language, so it
 * generates the Postgres column as NULLABLE with a default (`"tags"
 * "ProductTag"[] DEFAULT ARRAY[]::"ProductTag"[]`, no NOT NULL) — that is
 * Prisma's own output, not an omission, and `db:check-drift` is green with it.
 * Do NOT hand-add NOT NULL to the migration: it would diverge from what Prisma
 * regenerates. A NULL can therefore reach the column through hand-run SQL, and
 * while the driver was measured to hand such a row back as `[]`, that coercion
 * is the driver's behaviour and not a contract we control. Tolerating it here
 * costs one guard and removes the question entirely.
 */
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

function toProductCard(row: ProductCardRow): ProductCardDTO {
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

function toProductDetail(row: ProductDetailRow): ProductDetailDTO {
  const category = row.categories[0] ?? null;

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    categoryName: category?.name ?? null,
    categorySlug: category?.slug ?? null,
    media: row.media.map((item) => ({ url: item.url, alt: mediaAlt(item.alt, row.name) })),
    variants: row.variants.map((variant) => ({
      sku: variant.sku,
      material: variant.material,
      sizeMm: variant.sizeMm,
      priceCents: variant.priceCents,
      salePriceCents: saleOf(variant),
      inStock: variant.inStock,
    })),
    tag: pickTag(row.tags),
  };
}

function clampPage(page: number | undefined, totalPages: number): number {
  const lastPage = Math.max(totalPages, 1);

  if (typeof page !== "number" || !Number.isFinite(page)) {
    return 1;
  }

  return Math.min(Math.max(Math.floor(page), 1), lastPage);
}

/**
 * Shared listing query. Order is `name asc, slug asc`: `slug` is unique, so the
 * pair is a total order and a row can never appear on two pages (design D12).
 */
async function getCardPage(
  where: Prisma.ProductWhereInput,
  opts: ListOptions,
): Promise<PageResult<ProductCardDTO>> {
  const total = await prisma.product.count({ where });
  const totalPages = Math.ceil(total / PRODUCT_PAGE_SIZE);
  const page = clampPage(opts.page, totalPages);

  const rows = await prisma.product.findMany({
    where,
    orderBy: [{ name: "asc" }, { slug: "asc" }],
    skip: (page - 1) * PRODUCT_PAGE_SIZE,
    take: PRODUCT_PAGE_SIZE,
    select: productCardSelect,
  });

  return {
    items: rows.map(toProductCard),
    page,
    pageSize: PRODUCT_PAGE_SIZE,
    total,
    totalPages,
  };
}

/** Paginated catalog listing for the home grid and any unfiltered surface. */
export function getProductCards(opts: ListOptions = {}): Promise<PageResult<ProductCardDTO>> {
  return getCardPage({}, opts);
}

/**
 * Same listing, restricted to one category slug. An unknown slug is not an
 * error here: it simply yields an empty page. Callers that need a 404 resolve
 * the category itself via `getCategoryBySlug`.
 */
export function getProductCardsByCategory(
  slug: string,
  opts: ListOptions = {},
): Promise<PageResult<ProductCardDTO>> {
  return getCardPage({ categories: { some: { slug } } }, opts);
}

/**
 * `null` means "no such product" and nothing else. A Prisma/connection failure
 * is deliberately NOT caught: a database outage must surface as an error, not
 * be laundered into a 404 (design D12).
 */
export async function getProductBySlug(slug: string): Promise<ProductDetailDTO | null> {
  const row = await prisma.product.findUnique({
    where: { slug },
    select: productDetailSelect,
  });

  return row === null ? null : toProductDetail(row);
}
