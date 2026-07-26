import { Suspense } from "react";

import { CategoryGridSkeleton } from "@/components/category/CategoryGridSkeleton";
import { EmptyState } from "@/components/category/EmptyState";
import { Pagination } from "@/components/category/Pagination";
import { ProductGrid } from "@/components/home/ProductGrid";
import { QueryTooShort } from "@/components/search/QueryTooShort";
import { SearchForm } from "@/components/search/SearchForm";
import { searchProducts } from "@/lib/data/search";
import { PAGE_QUERY_PARAM, SEARCH_QUERY_PARAM, search as searchHref } from "@/lib/routes";

import styles from "./page.module.css";

// No DB is reachable during `next build` in CI (design D1); force this route
// to render per-request instead of being statically prerendered.
export const dynamic = "force-dynamic";

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

/**
 * `/buscar/`. Unlike `/`, this route MAY stream (design D1b constrains `/`
 * only — it is Coolify's healthcheck target until PR8/PR9, this route never
 * is): the ranked results render inside `<Suspense>`. The form above it does
 * not need one — it reads no data.
 *
 * Five states, each with its own honest copy (design "states" rule): no
 * query at all (a bare `/buscar/`), a too-short/too-long query, zero
 * matches, one page of results, many pages. The first two collapse into the
 * SAME validation branch at the DAL (`searchProducts`'s `validQuery: false`,
 * design D3) and are told apart only by `QueryTooShort`'s own copy, which
 * reads the raw query text back to distinguish "typed nothing" from "typed
 * too little".
 *
 * Hierarchy: the results grid is the focal element; the form and the result
 * count above it support it, not compete with it.
 *
 * Renders its own `<main>` — `(shop)/layout.tsx` deliberately renders none.
 */
export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = parseQueryParam(resolved[SEARCH_QUERY_PARAM]);
  const page = parsePageParam(resolved[PAGE_QUERY_PARAM]);

  return (
    <main>
      <div className={styles.wrap}>
        <header className={styles.head}>
          <span className={styles.eyebrow}>Buscar</span>
          <h1 className={styles.title}>Buscar en el catálogo</h1>
          <SearchForm initialQuery={query} />
        </header>
        <Suspense fallback={<CategoryGridSkeleton />}>
          <SearchResults query={query} page={page} />
        </Suspense>
      </div>
    </main>
  );
}

/** `""` for an absent or repeated `?q=` — `searchProducts` treats that the
 * same as any other invalid-length query (design D3). */
function parseQueryParam(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;

  return value ?? "";
}

/**
 * Same shape as `/categoria/[slug]/page.tsx`'s `parsePageParam`: `undefined`
 * for an absent, repeated or non-numeric `?page=` — `searchProducts`'s own
 * clamp (mirroring the DAL's `clampPage`, design D12) treats `undefined` as
 * "page 1" and clamps any out-of-range or non-finite number into
 * `[1, totalPages]`.
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
 * `<Suspense>`, same reasoning as `/categoria/[slug]/page.tsx`'s exported
 * `CategoryGrid`: exported so `page.test.tsx` can `await` it directly and
 * render the result, without a live `<Suspense>` tree or a real database.
 */
export async function SearchResults({
  query,
  page,
}: {
  query: string;
  page: number | undefined;
}) {
  const result = await searchProducts(query, { page });

  if (!result.validQuery) {
    return <QueryTooShort query={query} />;
  }

  if (result.result.items.length === 0) {
    return (
      <EmptyState
        message={`No encontramos resultados para "${query.trim()}". Probá con otra palabra.`}
      />
    );
  }

  return (
    <>
      <p className={styles.count}>
        {result.result.total} {result.result.total === 1 ? "resultado" : "resultados"} para “
        {query.trim()}”
      </p>
      <ProductGrid products={result.result.items} />
      <Pagination
        page={result.result.page}
        totalPages={result.result.totalPages}
        hrefForPage={(p) => searchHref({ q: query, page: p })}
      />
    </>
  );
}
