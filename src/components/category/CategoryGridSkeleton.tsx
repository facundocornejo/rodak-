import styles from "./CategoryGridSkeleton.module.css";

/**
 * `<Suspense>` fallback for the category grid. Reserves the SAME grid
 * geometry as `ProductGrid`/`ProductCard` (identical `grid-template-columns`
 * and the `4/5` stage aspect-ratio) so the real content swapping in produces
 * no layout shift (design "states" rule: "Loading = Suspense skeletons that
 * reserve the same geometry as the content").
 *
 * A fixed placeholder count is fine here — it only has to fill the viewport
 * plausibly while the request is in flight, not match the real page size.
 */
const PLACEHOLDER_COUNT = 8;

export function CategoryGridSkeleton() {
  return (
    <ul className={styles.grid} aria-hidden="true">
      {Array.from({ length: PLACEHOLDER_COUNT }, (_, index) => (
        <li key={index} className={styles.card}>
          <div className={styles.stage} />
          <div className={styles.line} />
          <div className={styles.lineShort} />
        </li>
      ))}
    </ul>
  );
}
