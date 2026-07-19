"use client";

import { useEffect } from "react";

/**
 * Root error boundary (Next.js special file — must be a Client Component:
 * https://nextjs.org/docs/app/getting-started/error-handling). Catches
 * unexpected errors that escape a route's own rendering.
 *
 * This also covers the catalog query failure in `(shop)/page.tsx`: that
 * error is left to propagate on purpose so the route answers non-200 and
 * Coolify's healthcheck against `/` can detect a DB outage (the server
 * logs the original error with its digest before this boundary renders).
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
