import Link from "next/link";

import { home } from "@/lib/routes";

import styles from "./SiteHeader.module.css";

/**
 * Sticky site header. Zero database reads.
 *
 * The header carries exactly one link — the wordmark, back to the catalogue —
 * because it is the only route that exists in this phase. It has no cart
 * affordance, no bundle entry, no payment entry and no placeholder anchor: a
 * control that leads nowhere is worse than no control [INV-10]. Category and
 * search navigation land here in later phases (PR5 category, PR7 search),
 * once those routes exist — PR7's task list explicitly reserves the search
 * entry point for itself, so it is deliberately not added here either.
 *
 * The mockup's gold "k" in the wordmark is dropped: gold text on the light
 * base measures 2.19:1 and fails WCAG AA (D14). The brand accent appears
 * instead as a mark — a gold rule that draws in on hover/focus.
 */
export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={home()} className={styles.wordmark}>
          Rodak
        </Link>
        <p className={styles.tagline}>Escritorios y setups en madera maciza</p>
      </div>
    </header>
  );
}
