/**
 * Single source of truth for every internal href.
 *
 * `next.config.ts` sets `trailingSlash: true`, so the canonical form of every
 * route ends with a slash and the slashless form 308-redirects. Hardcoding
 * hrefs in components is how that invariant rots one link at a time, so every
 * internal link is built here instead [INV-5].
 *
 * The module is pure (no `server-only`, no imports): it is unit-tested in the
 * node project and is safe to import from Client Components.
 */

/** Query parameter name for the search term, shared with `/buscar/`. */
export const SEARCH_QUERY_PARAM = "q";

/** Query parameter name for pagination, shared by every paginated surface. */
export const PAGE_QUERY_PARAM = "page";

/**
 * A slug is one path segment coming from the database (`Product.slug` and
 * `Category.slug` are both `NOT NULL UNIQUE`). A blank slug would silently
 * produce `/categoria//`, a link that looks fine in JSX and 404s in the
 * browser, so it throws instead of being papered over with a neutral fallback.
 */
function requireSlug(slug: string, kind: string): string {
  if (slug.trim() === "") {
    throw new Error(`routes.${kind}() was called with an empty slug.`);
  }

  // Encoded so a slug carrying `/`, `?` or `#` cannot break out of its segment.
  // Real slugs are already URL-safe, in which case this is the identity.
  return encodeURIComponent(slug);
}

/** `/` — catalog home. */
export function home(): string {
  return "/";
}

/** `/categoria/{slug}/` — one category grid. */
export function category(slug: string): string {
  return `/categoria/${requireSlug(slug, "category")}/`;
}

/** `/producto/{slug}/` — one product detail page. */
export function product(slug: string): string {
  return `/producto/${requireSlug(slug, "product")}/`;
}

export interface SearchParams {
  /** Raw user query. Blank (or absent) means "the bare search page". */
  q?: string;
  /** 1-based page number. Page 1 is left implicit. */
  page?: number;
}

/**
 * `/buscar/` with an optional `?q=` and `?page=`.
 *
 * The trailing slash sits on the path, before the query string, because that
 * is the form `trailingSlash: true` serves without a redirect.
 *
 * Both parameters are omitted when they carry no information: a blank query and
 * `page=1` are the defaults, so emitting them would create a second URL for a
 * page that already has one. A non-integer or out-of-range page is dropped
 * rather than forwarded — the DAL clamps pages anyway, and a link that reads
 * `?page=NaN` is never what the caller meant.
 */
export function search({ q, page }: SearchParams = {}): string {
  const params = new URLSearchParams();
  const query = q?.trim() ?? "";

  if (query !== "") {
    params.set(SEARCH_QUERY_PARAM, query);
  }

  if (typeof page === "number" && Number.isInteger(page) && page > 1) {
    params.set(PAGE_QUERY_PARAM, String(page));
  }

  // Insertion order above fixes the parameter order, so the same inputs always
  // yield byte-identical hrefs.
  const queryString = params.toString();

  return queryString === "" ? "/buscar/" : `/buscar/?${queryString}`;
}
