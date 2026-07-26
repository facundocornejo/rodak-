import Link from "next/link";

import { home, search } from "@/lib/routes";

import styles from "./SiteHeader.module.css";

/**
 * Sticky site header. Zero database reads.
 *
 * PR7 adds the header's second link: search. Every PR since PR1 deliberately
 * left this link-poor — "Category and search navigation land here in later
 * phases ... PR7's task list explicitly reserves the search entry point for
 * itself" (this file's own history) — and PR7 is that phase. Still no cart
 * affordance, no bundle entry, no payment entry and no placeholder anchor: a
 * control that leads nowhere is worse than no control [INV-10].
 *
 * The search link goes to `routes.search()`'s bare path (`/buscar/`, no
 * `?q=`) [INV-5] — the same route `SearchForm`'s own `<form method="get">`
 * targets, so this is a real, working destination, not a shortcut into a
 * half-built page.
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
        <div className={styles.right}>
          <Link href={search()} className={styles.searchLink}>
            <SearchGlyph />
            Buscar
          </Link>
          <p className={styles.tagline}>Escritorios y setups en madera maciza</p>
        </div>
      </div>
    </header>
  );
}

/**
 * Inline SVG only — a magnifying-glass text glyph is not on the design's
 * banned-glyph list (`→`, `★`, `✓`) but the house rule for icons throughout
 * this repo (`StarRating.tsx`) is inline SVG regardless, so this follows the
 * same convention rather than introducing a text-glyph icon as a new pattern.
 */
function SearchGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
      <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <line
        x1="15.3"
        y1="15.3"
        x2="20.5"
        y2="20.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
