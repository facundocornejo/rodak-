import styles from "./CategoryGridSkeleton.module.css";

/**
 * `<Suspense>` fallback for the category grid. Reserves the SAME grid
 * geometry as `ProductGrid`/`ProductCard` (identical `grid-template-columns`
 * and the `4/5` stage aspect-ratio) AND the maximum row count a real page can
 * hold, so the real content swapping in can never grow taller than the
 * skeleton it replaces (PR5 review WARNING: the previous fixed count of 8
 * under-reserved on almost every category — most hold more than 8 products —
 * so the footer/pagination visibly jumped DOWN when the stream resolved,
 * directly contradicting this docblock's old claim of "no layout shift").
 *
 * `PLACEHOLDER_COUNT` mirrors `PRODUCT_PAGE_SIZE` (`src/lib/data/products.ts`,
 * currently 24) as a literal rather than an import: that module starts with
 * `import "server-only"`, and this is a presentational leaf with no DAL
 * dependency otherwise — importing it here would mean any future component
 * test for this skeleton has to mock the database just to read a number. If
 * `PRODUCT_PAGE_SIZE` ever changes, update this literal by hand.
 *
 * This does NOT eliminate all layout shift, and the claim above is scoped
 * precisely to what is true: a category with FEWER than `PLACEHOLDER_COUNT`
 * products (the common case — most categories are smaller than a full page)
 * still shrinks when the real grid replaces the skeleton, because the real
 * item count is unknown until the query resolves and no fixed skeleton size
 * can match every category exactly. Over-reserving is the direction that
 * fixes the reported bug (growth) without pretending the opposite direction
 * (shrink) is also solved.
 */
const PLACEHOLDER_COUNT = 24;

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
