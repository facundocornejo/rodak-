import Link from "next/link";

import { home } from "@/lib/routes";

import styles from "./EmptyState.module.css";

export interface EmptyStateProps {
  /**
   * Required, not defaulted: an honest empty-state line is specific to WHERE
   * it renders (the whole catalog vs. one category vs., later, a search with
   * no matches), so each call site supplies its own factual sentence instead
   * of this component guessing a generic one.
   */
  message: string;
}

/**
 * Shared empty state (design "states" rule): an honest line plus one link
 * back to the catalog, built with `routes.ts` [INV-5]. Lives under
 * `src/components/category/` because PR5 is the first slice to need it as a
 * real component, but it is reused as-is by `(shop)/page.tsx` (home) and,
 * later, PR7's search results — there is exactly one empty state, not one per
 * surface.
 *
 * No invented copy: no delivery promise, no ETA, no contact channel — just
 * the fact (via `message`) and a real, working navigation target.
 */
export function EmptyState({ message }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <p className={styles.message}>{message}</p>
      <Link href={home()} className={styles.link}>
        Ver el catálogo
      </Link>
    </div>
  );
}
