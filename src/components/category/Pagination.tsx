import Link from "next/link";

import styles from "./Pagination.module.css";

export interface PaginationProps {
  /** Already clamped by the DAL (`clampPage` in `src/lib/data/products.ts`) —
   * this component trusts it and does not re-validate it. */
  page: number;
  /** `0` for an empty result (design D12); treated as 1 page for display. */
  totalPages: number;
  /**
   * Builds the href for an arbitrary page number. Kept generic (not importing
   * `routes.ts` itself) so this one component serves both the category page
   * (`routes.category(slug)` + a hand-appended `?page=`, mirroring
   * `routes.search()`'s own page-1-omission shape) and PR7's search page
   * (`routes.search({q, page})`, which already omits `page=1`) without this
   * file needing to know which surface called it.
   */
  hrefForPage: (page: number) => string;
}

/**
 * Prev/current/next pagination. Real disabled states at the edges — a
 * `<span aria-disabled="true">` at the first/last page, never a hidden
 * control — because a control that silently vanishes at the boundary is
 * harder to reason about than one that is visibly inert (design rule:
 * "design every state ... disabled").
 *
 * Renders whenever the caller has at least one page of items (the category
 * page only mounts this when `items.length > 0`); a single-page category
 * still renders it with BOTH controls disabled, which is the honest state,
 * not a reason to hide the control.
 */
export function Pagination({ page, totalPages, hrefForPage }: PaginationProps) {
  const lastPage = Math.max(totalPages, 1);
  const isFirst = page <= 1;
  const isLast = page >= lastPage;

  return (
    <nav className={styles.nav} aria-label="Paginación">
      {isFirst ? (
        <span className={styles.control} aria-disabled="true">
          Anterior
        </span>
      ) : (
        <Link href={hrefForPage(page - 1)} className={styles.control}>
          Anterior
        </Link>
      )}
      <span className={styles.status}>
        Página {page} de {lastPage}
      </span>
      {isLast ? (
        <span className={styles.control} aria-disabled="true">
          Siguiente
        </span>
      ) : (
        <Link href={hrefForPage(page + 1)} className={styles.control}>
          Siguiente
        </Link>
      )}
    </nav>
  );
}
