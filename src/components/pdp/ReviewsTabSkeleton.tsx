import styles from "./ReviewsTabSkeleton.module.css";

/**
 * `<Suspense>` fallback for `ReviewsTab` (design "states: loading" rule —
 * reserves roughly the same block height as the empty state / a short
 * review list so the panel does not visibly grow once the query resolves).
 * In practice this is rarely seen: Reseñas is never the tab open on first
 * paint, and RSC streaming usually resolves before a visitor switches to it.
 */
export function ReviewsTabSkeleton() {
  return (
    <div className={styles.wrap} aria-hidden="true">
      <div className={styles.line} />
      <div className={styles.lineShort} />
    </div>
  );
}
