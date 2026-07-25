import Link from "next/link";

import { home } from "@/lib/routes";

import styles from "./not-found.module.css";

/**
 * Segment-scoped 404 (Next.js special file — same nesting contract as
 * `(shop)/error.tsx`, closed for the error case in PR5). Without this file,
 * any `notFound()` call inside `(shop)/` — the category route (PR5) and, from
 * this PR, `/producto/[slug]/` — fell through to Next's bare default
 * not-found page, losing the announce bar, header and footer exactly like an
 * unhandled error did before PR5's `error.tsx`. `(shop)/layout.tsx` stays
 * mounted; only the page's own content is replaced.
 *
 * Deliberately generic wording (not "producto no encontrado"): this file
 * covers every 404 under `(shop)/`, current and future, not just the PDP.
 */
export default function ShopNotFound() {
  return (
    <main className={styles.main}>
      <span className={styles.eyebrow}>404</span>
      <h1 className={styles.title}>No encontramos esta página</h1>
      <p className={styles.body}>
        El enlace puede estar roto o el producto ya no está disponible.
      </p>
      <Link href={home()} className={styles.link}>
        Volver al catálogo
      </Link>
    </main>
  );
}
