/**
 * Pure search ranking (design D3).
 *
 * The catalog is ~88 products, so search loads one small projection and ranks
 * it in memory instead of pushing the query into SQL. Two consequences worth
 * stating explicitly:
 *
 *  - **the user query never reaches the database**, so there is no injection
 *    surface and no `LIKE`/`ILIKE` pattern to escape;
 *  - accent-insensitivity needs no `unaccent` extension (and therefore no
 *    migration and no drift risk on the managed Postgres).
 *
 * This module is pure and has no imports: it is unit-tested in the node
 * project and is safe to import anywhere.
 */

/** Shortest query that runs. Below this a surface shows a validation state. */
export const MIN_QUERY_LENGTH = 2;

/** Longest query that runs. Above this the input is not a product search. */
export const MAX_QUERY_LENGTH = 64;

/** Score rungs. Exported so tests and callers name them instead of the digits. */
export const SCORE_NAME_EXACT = 100;
export const SCORE_NAME_STARTS_WITH = 60;
export const SCORE_NAME_CONTAINS = 40;
export const SCORE_DESCRIPTION_CONTAINS = 10;

/**
 * The minimum a row must carry to be ranked. `rankRows` is generic over this so
 * the DAL can hand over its full projection (`categoryName`, price fields, …)
 * and get the same objects back, ranked — no re-lookup, no DTO duplication.
 */
export interface RankableRow {
  slug: string;
  name: string;
  description: string | null;
}

/**
 * Folds a string to its comparison form: decompose, drop the combining marks,
 * lowercase. This is what makes "MESA", "mesa" and "méSa" the same query
 * (spec: accent/case insensitive).
 *
 * Note that this also folds `ñ` to `n` — in NFD the tilde is a combining
 * diacritic like any accent. That is accepted, not overlooked: it only widens
 * matching (a "Ñandú" is found by both "nandu" and "ñandu"), which is what a
 * storefront search box should do. Asserted in `rank.test.ts`.
 */
export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Length guard, measured on the TRIMMED query in code points.
 *
 * Code points rather than `.length` so an astral character (an emoji, say)
 * counts once instead of twice against the bounds. Callers must short-circuit
 * on `false` WITHOUT touching the database (design D3).
 */
export function isQueryValid(query: string): boolean {
  const length = [...query.trim()].length;

  return length >= MIN_QUERY_LENGTH && length <= MAX_QUERY_LENGTH;
}

/**
 * Relevance of one row for an already-normalized query, `0` meaning "no match".
 *
 * The name rungs are a ladder, not a sum: the first one that applies wins, and
 * a description hit only counts when the name does not match at all. Summing
 * would make the number un-interpretable (a row could out-score an exact name
 * match by mentioning the term in its prose) without changing what a user
 * expects to see first.
 */
function scoreRow(row: RankableRow, normalizedQuery: string): number {
  const name = normalizeSearchText(row.name);

  if (name === normalizedQuery) return SCORE_NAME_EXACT;
  if (name.startsWith(normalizedQuery)) return SCORE_NAME_STARTS_WITH;
  if (name.includes(normalizedQuery)) return SCORE_NAME_CONTAINS;

  const description = normalizeSearchText(row.description ?? "");

  return description.includes(normalizedQuery) ? SCORE_DESCRIPTION_CONTAINS : 0;
}

/**
 * Total order for equally-scored rows, so the same query always renders the
 * same page in the same order (and a row can never appear on two pages).
 *
 * Three keys, all locale-independent:
 *  1. normalized name — "Árbol" sorts next to "arbol", not after "Zapato",
 *     which a plain code-point sort would do;
 *  2. raw name — two names differing only in accents still get a fixed order;
 *  3. slug — unique in the database, so the comparison always terminates.
 *
 * `localeCompare` is deliberately avoided: its result depends on the ICU data
 * of the running Node build, and this ordering is asserted in tests.
 */
function compareByName(a: RankableRow, b: RankableRow): number {
  const keys: [string, string][] = [
    [normalizeSearchText(a.name), normalizeSearchText(b.name)],
    [a.name, b.name],
    [a.slug, b.slug],
  ];

  for (const [left, right] of keys) {
    if (left < right) return -1;
    if (left > right) return 1;
  }

  return 0;
}

/**
 * Rows matching `query`, best first. Non-matching rows are dropped, so a query
 * with no matches returns `[]` (the caller renders an empty state, never an
 * error).
 *
 * An invalid-length query returns `[]` too, but callers must check
 * `isQueryValid` FIRST: the point of the guard is to skip the database round
 * trip, and reaching this function means the rows were already loaded.
 */
export function rankRows<T extends RankableRow>(rows: readonly T[], query: string): T[] {
  if (!isQueryValid(query)) return [];

  const normalizedQuery = normalizeSearchText(query.trim());

  // A query made only of combining marks normalizes away to nothing, and
  // `"".includes()` is true for every row — it would "match" the whole catalog.
  if (normalizedQuery === "") return [];

  return rows
    .map((row) => ({ row, score: scoreRow(row, normalizedQuery) }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score || compareByName(a.row, b.row))
    .map((scored) => scored.row);
}
