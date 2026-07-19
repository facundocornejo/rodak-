const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

/**
 * Formats an integer cents amount as an es-AR currency string.
 *
 * Locale and currency are fixed explicitly (never inferred from the
 * environment) so server and client render the same string — an implicit
 * locale would produce a hydration mismatch (see spec "Money and Date
 * Invariants" and design "explicit locale/currency" hydration rule).
 */
export function formatPriceCents(priceCents: number): string {
  return currencyFormatter.format(priceCents / 100);
}
