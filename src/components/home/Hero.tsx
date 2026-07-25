import styles from "./Hero.module.css";

/**
 * Typographic hero (design D2/component inventory): no photograph exists for
 * Rodak — the mockup's hero photo is a placeholder stock asset, not real
 * product photography — and none is invented here. The type scale carries
 * the section instead: `--step-4` is reserved in `tokens.css` for exactly
 * this line ("hero display only — nothing else").
 *
 * Dark island (`data-island="dark"`, design D14): the top edge of the
 * continuous announce-bar + hero + marquee block. `AnnounceBar` (chrome,
 * PR1) sits directly above this in `(shop)/layout.tsx`; `Marquee` sits
 * directly below in `page.tsx`.
 *
 * The CTA scrolls to the in-page catalog section (`#catalogo`, rendered by
 * `page.tsx`) rather than linking through `routes.ts`: it is a same-page
 * fragment jump, not a route navigation, so it is not an INV-5 concern. It is
 * a real, working destination — not a dead `#` link [INV-10].
 */
export function Hero() {
  return (
    <section className={styles.hero} data-island="dark">
      <div className={styles.inner}>
        <span className={styles.eyebrow}>El sistema de setup Rodak</span>
        <h1 className={styles.title}>
          Escritorios de <em className={styles.mark}>madera maciza</em>
        </h1>
        <p className={styles.lead}>
          Diseñados y fabricados en Argentina, con hierro macizo y una estructura
          pensada para durar toda una vida.
        </p>
        <a className={styles.cta} href="#catalogo">
          Ver catálogo
          <svg
            className={styles.ctaIcon}
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              d="M5 12h14M13 6l6 6-6 6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
    </section>
  );
}
