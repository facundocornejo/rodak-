"use client";

import { useEffect } from "react";

import styles from "./error.module.css";

/**
 * Shop-level error boundary (Next.js special file, must be a Client
 * Component: https://nextjs.org/docs/app/getting-started/error-handling).
 * Wraps `(shop)/page.tsx` and every nested route under `(shop)/` —
 * `/categoria/[slug]/`, `/producto/[slug]/` (PR6), `/buscar/` (PR7) — WITHOUT
 * wrapping `(shop)/layout.tsx`: in the App Router, `error.tsx` is a boundary
 * around its segment's children, so the chrome one level up (`AnnounceBar`,
 * `SiteHeader`, `SiteFooter`) stays mounted and keeps rendering.
 *
 * Before this file existed there was no `(shop)/error.tsx`, so a thrown
 * error in any shop route (e.g. the catalog query in `(shop)/page.tsx`, which
 * is deliberately left unguarded so a DB outage propagates — design D1b)
 * skipped straight past the layout to the ROOT boundary (`src/app/error.tsx`),
 * which replaces everything under the root layout. The visitor lost the
 * announce bar, header and footer precisely during an outage, when the
 * footer's real information is most useful.
 *
 * This copy MUST read as an outage, never as an empty catalog: it says a
 * request failed and offers a retry. It deliberately does NOT say anything
 * resembling "no hay productos" — collapsing a database failure into the
 * empty-state wording would misrepresent what actually happened.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className={styles.main}>
      <span className={styles.eyebrow}>Error</span>
      <h1 className={styles.title}>No pudimos cargar esta página</h1>
      <p className={styles.body}>
        Hubo un problema al conectar con el servidor. Podés intentar de nuevo.
      </p>
      <button type="button" className={styles.retry} onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
