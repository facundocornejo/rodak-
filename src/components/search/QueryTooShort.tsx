import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/lib/search/rank";

import styles from "./QueryTooShort.module.css";

export interface QueryTooShortProps {
  /** The raw, un-trimmed `?q=` value as read by the page (`""` when absent). */
  query: string;
}

/**
 * Validation-state block for `/buscar/` (design D3: an invalid-length query
 * never reaches the DAL — `searchProducts` returns `{ validQuery: false }`
 * before calling anything, see `src/lib/data/search.ts`).
 *
 * Three honest messages, not one generic line, because "you typed nothing
 * yet" and "you typed too much" are different facts and the wrong one reads
 * as a bug report to the visitor:
 *  - no query at all (a bare `/buscar/`) — an invitation, not an error;
 *  - 1..`MIN_QUERY_LENGTH - 1` characters — the actual too-short case;
 *  - more than `MAX_QUERY_LENGTH` characters — the same validation branch in
 *    `rank.ts`'s `isQueryValid`, worded for the opposite problem instead of
 *    reusing the "too short" copy for it.
 *
 * No invented copy: nothing here promises a result count, an ETA or a
 * contact channel — just what happened. The fix is implicit: the
 * `SearchForm` that renders above this block on the same page.
 */
export function QueryTooShort({ query }: QueryTooShortProps) {
  const trimmed = query.trim();
  const length = [...trimmed].length;

  let message: string;

  if (trimmed === "") {
    message = "Escribí qué estás buscando.";
  } else if (length > MAX_QUERY_LENGTH) {
    message = `Escribí como máximo ${String(MAX_QUERY_LENGTH)} caracteres.`;
  } else {
    message = `Escribí al menos ${String(MIN_QUERY_LENGTH)} caracteres para buscar.`;
  }

  return (
    <div className={styles.wrap}>
      <p className={styles.message}>{message}</p>
    </div>
  );
}
