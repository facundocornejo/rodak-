import type { ReviewDTO } from "@/lib/data/reviews";

import { StarRating } from "./StarRating";
import styles from "./ReviewCard.module.css";

export interface ReviewCardProps {
  review: ReviewDTO;
}

/**
 * PR7 review WARNING, fixed here: without an explicit `timeZone`,
 * `Intl.DateTimeFormat` formats in the HOST's local timezone, so the exact
 * same stored UTC instant (`createdAtISO`) renders on a different calendar
 * day depending on where the process happens to run — a review created in
 * the first hours of the UTC day reads as the PREVIOUS day once the
 * container's local clock is Argentina's (UTC-3), so CI (commonly UTC) and
 * production disagree about the same instant. This is the same class of
 * environment dependence `rank.ts` already rejected `localeCompare` over
 * (that module's own docblock). Pinned to Buenos Aires explicitly — the
 * storefront's own locale — rather than to UTC, so the calendar day shown
 * matches what an Argentine visitor actually experienced; Argentina has no
 * DST, so this is a fixed UTC-3 offset year-round, not a moving target.
 */
const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

/**
 * One approved review. Renders exactly `authorName`, `rating`, `title`,
 * `body`, `createdAtISO` — and NEVER `authorEmail` [INV-3]. `ReviewDTO`
 * (`src/lib/data/reviews.ts`, design D10) does not even carry that field —
 * the DAL's own `select` omits the column — so there is nothing here that
 * could accidentally print it; `ReviewCard.test.tsx` still asserts the
 * rendered text contains no email-shaped string, as a second, independent
 * check at the render boundary.
 */
export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <li className={styles.card}>
      <div className={styles.head}>
        <StarRating value={review.rating} label={`${review.rating} de 5 estrellas`} />
        <time className={styles.date} dateTime={review.createdAtISO}>
          {dateFormatter.format(new Date(review.createdAtISO))}
        </time>
      </div>
      {review.title !== null && review.title.trim() !== "" && (
        <p className={styles.title}>{review.title}</p>
      )}
      <p className={styles.body}>{review.body}</p>
      <p className={styles.author}>{review.authorName}</p>
    </li>
  );
}
