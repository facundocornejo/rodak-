import styles from "./CrossSellSkeleton.module.css";

/** `<Suspense>` fallback for `CrossSell` — reserves one row of card-shaped blocks. */
export function CrossSellSkeleton() {
  return (
    <div className={styles.grid} aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className={styles.card} />
      ))}
    </div>
  );
}
