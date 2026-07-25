import styles from "./AnnounceBar.module.css";

/**
 * Top announcement strip. Static copy only — no promotional or pricing claim
 * the repo cannot back yet (instalments and the transfer discount belong to
 * the pricing phase), and no link, so there is nothing dead here [INV-10].
 *
 * Rendered as a dark island (`data-island="dark"`): it is the top edge of the
 * announce + hero + marquee block, and the only chrome surface where the gold
 * accent is legible as text (9.60:1).
 *
 * The claims are separated by space rather than by "·" characters: each claim
 * is a non-wrapping flex item, so a narrow viewport breaks the strip between
 * claims instead of mid-claim, and no separator glyph is ever orphaned at the
 * start of a wrapped line.
 */
const CLAIMS = [
  { text: "Madera maciza y hierro", brand: false },
  { text: "Hecho en Argentina", brand: true },
  { text: "Envíos a todo el país", brand: false },
] as const;

export function AnnounceBar() {
  return (
    <div className={styles.bar} data-island="dark">
      <p className={styles.text}>
        {CLAIMS.map((claim) =>
          claim.brand ? (
            <strong key={claim.text} className={`${styles.claim} ${styles.mark}`}>
              {claim.text}
            </strong>
          ) : (
            <span key={claim.text} className={styles.claim}>
              {claim.text}
            </span>
          ),
        )}
      </p>
    </div>
  );
}
