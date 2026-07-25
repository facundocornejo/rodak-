import { Suspense } from "react";

import { notFound } from "next/navigation";

import { CategoryGridSkeleton } from "@/components/category/CategoryGridSkeleton";
import { CategoryHeader } from "@/components/category/CategoryHeader";
import { EmptyState } from "@/components/category/EmptyState";
import { Pagination } from "@/components/category/Pagination";
import { ProductGrid } from "@/components/home/ProductGrid";
import { getCategoryBySlug } from "@/lib/data/categories";
import { getProductCardsByCategory } from "@/lib/data/products";
import { PAGE_QUERY_PARAM, category as categoryHref } from "@/lib/routes";

import styles from "./page.module.css";

// No DB is reachable during `next build` in CI (design D1); force this route
// to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * `/categoria/{slug}/`. Unlike `/`, this route MAY stream (design D1b
 * constrains `/` only — it is Coolify's healthcheck target until PR8/PR9,
 * this route never is): the paginated grid renders inside `<Suspense>`.
 *
 * The category lookup that decides 404-vs-render stays AWAITED in the page
 * body, outside the boundary — a 404 must be a real 404, never a skeleton
 * that quietly resolves into nothing.
 *
 * Renders its own `<main>` — `(shop)/layout.tsx` deliberately renders none.
 */
export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);

  if (category === null) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const page = parsePageParam(resolvedSearchParams[PAGE_QUERY_PARAM]);

  return (
    <main>
      <div className={styles.wrap}>
        <CategoryHeader name={category.name} productCount={category.productCount} />
        <Suspense fallback={<CategoryGridSkeleton />}>
          <CategoryGrid slug={slug} page={page} />
        </Suspense>
      </div>
    </main>
  );
}

/**
 * `undefined` for an absent, repeated or non-numeric `?page=` — the DAL's own
 * `clampPage` (`src/lib/data/products.ts`) already treats `undefined` as
 * "page 1" and clamps any out-of-range or non-finite number into
 * `[1, totalPages]` (design D12), so this only has to produce a plausible
 * `number | undefined` input, not re-implement that clamp here.
 */
function parsePageParam(raw: string | string[] | undefined): number | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;

  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Separated from the page body so it — and only it — sits inside
 * `<Suspense>`. Exported (not a page-local closure) so the zero-product
 * branch can be rendered directly in a test, without a real Suspense tree or
 * database: `await CategoryGrid({ slug, page })` is a plain async function
 * call, and its result is a React element `render()` can mount as-is.
 */
export async function CategoryGrid({
  slug,
  page,
}: {
  slug: string;
  page: number | undefined;
}) {
  const result = await getProductCardsByCategory(slug, { page });

  if (result.items.length === 0) {
    return <EmptyState message="Todavía no hay productos publicados en esta categoría." />;
  }

  return (
    <>
      <ProductGrid products={result.items} />
      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        hrefForPage={(p) =>
          p <= 1 ? categoryHref(slug) : `${categoryHref(slug)}?${PAGE_QUERY_PARAM}=${p}`
        }
      />
    </>
  );
}
