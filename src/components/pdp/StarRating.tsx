import styles from "./StarRating.module.css";

export interface StarRatingProps {
  /** 1-5, DB-constrained (`Review_rating_range`); may be a non-integer average. */
  value: number;
  /** Full text alternative for the whole row, e.g. "4 de 5 estrellas". */
  label: string;
}

const STAR_PATH =
  "M12 2.5l2.9 6.06 6.6.79-4.86 4.53 1.29 6.52L12 17.5l-5.93 3.4 1.29-6.52-4.86-4.53 6.6-.79z";

/**
 * Inline SVG star row — `★` as a text glyph is forbidden (design rule): the
 * self-hosted font subsets (`next/font/local`, design D6) are latin-only and
 * would silently fall back to a system font for that character. Rounds a
 * fractional average to the nearest whole star rather than rendering partial
 * fills, which keeps this component a single reusable icon-row shape for
 * both `ReviewCard` (always an integer 1-5) and `ReviewSummary` (a possibly
 * fractional average).
 *
 * Every icon is `aria-hidden`; the row's one real text alternative is
 * `label`, exposed via `role="img"` on the wrapper — screen readers get one
 * sentence, not five unlabeled icons.
 */
export function StarRating({ value, label }: StarRatingProps) {
  const filled = Math.round(Math.min(5, Math.max(0, value)));

  return (
    <span className={styles.row} role="img" aria-label={label}>
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          className={index < filled ? styles.starFilled : styles.starEmpty}
          viewBox="0 0 24 24"
          aria-hidden="true"
          focusable="false"
        >
          <path d={STAR_PATH} fill="currentColor" />
        </svg>
      ))}
    </span>
  );
}
