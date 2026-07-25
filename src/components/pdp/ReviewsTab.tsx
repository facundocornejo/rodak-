import { EmptyState } from "@/components/category/EmptyState";
import { getApprovedReviews, getReviewSummary } from "@/lib/data/reviews";

import { ReviewCard } from "./ReviewCard";
import { ReviewSummary } from "./ReviewSummary";
import styles from "./ReviewsTab.module.css";

export interface ReviewsTabProps {
  productSlug: string;
}

/**
 * Reads `getApprovedReviews`/`getReviewSummary` (PR3's DAL, `src/lib/data/reviews.ts`)
 * for one product. Server Component — the async leaf `<Suspense>` wraps in
 * `producto/[slug]/page.tsx` (design D1b: the PDP MAY stream; the
 * no-streaming rule is `/`-only, pre-cutover).
 *
 * **Real-catalog note**: zero rows exist in the `Review` table today (design
 * D10 — reviews are read-only, seeded manually via `REVIEWS.md`), so the
 * `count === 0` branch below is the ONLY path this component exercises in
 * production. It is still a defined, tested state (the same shared
 * `EmptyState` PR5 built and PR7 will reuse again), never a blank panel.
 */
export async function ReviewsTab({ productSlug }: ReviewsTabProps) {
  const [summary, reviews] = await Promise.all([
    getReviewSummary(productSlug),
    getApprovedReviews(productSlug),
  ]);

  if (summary.count === 0) {
    return <EmptyState message="Todavía no hay reseñas para este producto." />;
  }

  return (
    <div className={styles.wrap}>
      <ReviewSummary summary={summary} />
      <ul className={styles.list}>
        {reviews.items.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </ul>
    </div>
  );
}
