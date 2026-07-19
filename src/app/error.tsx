"use client";

import { useEffect } from "react";

/**
 * Root error boundary (Next.js special file — must be a Client Component:
 * https://nextjs.org/docs/app/getting-started/error-handling). Catches
 * unexpected errors that escape a route's own rendering.
 *
 * This is deliberately NOT where the catalog query failure is handled —
 * that is an anticipated error, caught inline and logged server-side in
 * `(shop)/page.tsx`, and never reaches this boundary. This component only
 * covers genuinely unexpected failures (e.g. a rendering bug), which is why
 * it can only log client-side.
 */
export default function GlobalError({
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
    <main>
      <h1>Algo salió mal</h1>
      <p>Ocurrió un error inesperado. Podés intentar de nuevo.</p>
      <button type="button" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
