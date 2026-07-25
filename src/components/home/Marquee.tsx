import styles from "./Marquee.module.css";

const CLAIM = "Madera maciza y hierro macizo · Hecho en Argentina · Envíos a todo el país";

/**
 * CSS-only scrolling strip, no JS and no animation library (D0). The claim
 * text is duplicated so the seam is never visible mid-loop.
 *
 * `prefers-reduced-motion` is honoured by `globals.css`'s blanket rule
 * (`animation-duration: 0.01ms !important` on every element), not by a media
 * query repeated here — that rule already freezes this track on its first
 * frame, so duplicating it locally would only be a second, driftable copy of
 * the same decision.
 *
 * `aria-hidden`: the strip repeats claims `AnnounceBar` (chrome) already
 * announces once, accessibly. Marking it decorative avoids reading the same
 * sentence to a screen reader on an infinite loop.
 */
export function Marquee() {
  return (
    <div className={styles.strip} data-island="dark" aria-hidden="true">
      <div className={styles.track}>
        <span>{CLAIM}</span>
        <span>{CLAIM}</span>
      </div>
    </div>
  );
}
