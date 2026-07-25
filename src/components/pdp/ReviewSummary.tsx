import type { ReviewSummaryDTO } from "@/lib/data/reviews";

import { StarRating } from "./StarRating";
import styles from "./ReviewSummary.module.css";

export interface ReviewSummaryProps {
  summary: ReviewSummaryDTO;
}

const RATINGS = [5, 4, 3, 2, 1] as const;

/**
 * Aggregate header for the Reseñas tab: average, count and a 5..1 histogram
 * bar. Only ever rendered by `ReviewsTab` when `summary.count > 0` —
 * `count === 0` is the shared `EmptyState`, not this component with every
 * number zeroed out, so there is no "0.0 de 5 (0 reseñas)" state to design
 * around here.
 */
export function ReviewSummary({ summary }: ReviewSummaryProps) {
  const averageLabel = `Promedio ${summary.average.toFixed(1)} de 5`;

  return (
    <div className={styles.wrap}>
      <div className={styles.headline}>
        <StarRating value={summary.average} label={averageLabel} />
        <span className={styles.average}>{summary.average.toFixed(1)}</span>
        <span className={styles.count}>
          {summary.count} {summary.count === 1 ? "reseña" : "reseñas"}
        </span>
      </div>
      <ul className={styles.histogram}>
        {RATINGS.map((rating) => {
          const count = summary.histogram[rating];
          const pct = summary.count === 0 ? 0 : Math.round((count / summary.count) * 100);

          return (
            <li key={rating} className={styles.histogramRow}>
              <span className={styles.histogramLabel}>{rating}</span>
              <span className={styles.histogramTrack} aria-hidden="true">
                <span className={styles.histogramFill} style={{ width: `${pct}%` }} />
              </span>
              <span className={styles.histogramCount}>{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
