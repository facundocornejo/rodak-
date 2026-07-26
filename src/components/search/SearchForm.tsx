"use client";

import { useState, type FormEvent } from "react";

import { useRouter } from "next/navigation";

import { SEARCH_QUERY_PARAM, search } from "@/lib/routes";

import styles from "./SearchForm.module.css";

export interface SearchFormProps {
  /** The current `?q=` value (`""` when absent), so the input keeps showing
   * what the visitor already searched for after a reload or a page link. */
  initialQuery?: string;
}

/**
 * Search box for `/buscar/`. A real `<form method="get">` targeting
 * `routes.search()`'s bare path (`/buscar/`) IS the mechanism — it works with
 * JavaScript disabled: the browser assembles `/buscar/?q=...` on its own from
 * the named `q` input, no client code required (the honest baseline this
 * task asked for).
 *
 * With JavaScript, `onSubmit` intercepts the native navigation and instead
 * routes through `routes.search({q})` [INV-5], so the emitted URL follows
 * the exact same omission rules as every other internal link — in
 * particular, a fresh search always lands on page 1 rather than carrying
 * over whatever `?page=` the visitor was on before submitting. Without
 * JavaScript `onSubmit` never runs and the native GET below reaches the same
 * `/buscar/?q=` shape by itself: this is progressive enhancement, not a
 * JS-only control.
 */
export function SearchForm({ initialQuery = "" }: SearchFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(search({ q: value }));
  }

  return (
    <form method="get" action={search()} role="search" className={styles.form} onSubmit={handleSubmit}>
      <label htmlFor="buscar-input" className={styles.label}>
        Buscar productos
      </label>
      <div className={styles.row}>
        <input
          id="buscar-input"
          type="search"
          name={SEARCH_QUERY_PARAM}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="¿Qué estás buscando?"
          className={styles.input}
          autoComplete="off"
        />
        <button type="submit" className={styles.button}>
          Buscar
        </button>
      </div>
    </form>
  );
}
