import styles from "./SiteFooter.module.css";

/**
 * Site footer. Zero database reads.
 *
 * The mockup's three link columns (Tienda / Ayuda / Rodak) are all `#`
 * placeholders and none of those pages exist, so the footer ships as a brand
 * block plus the legal line rather than a wall of dead links [INV-10]. Social
 * handles are also omitted: no verified account is recorded in the repo, and an
 * invented one is worse than none.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brand}>
          <span className={styles.wordmark}>Rodak</span>
          <p className={styles.blurb}>
            Escritorios, estanterías y accesorios de setup, diseñados y fabricados en
            Argentina con madera maciza y hierro.
          </p>
        </div>
        <p className={styles.legal}>© {year} Rodak — Hecho en Argentina.</p>
      </div>
    </footer>
  );
}
