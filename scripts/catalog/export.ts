import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { RawAttribute, RawPrices, RawProduct, RawVariation, Snapshot } from "./types";

// Network-only step of the catalog migration: reads the public WooCommerce Store
// API and writes a gitignored snapshot. This file NEVER touches the database.
// Run: npm run catalog:export

const API_BASE = "https://rodak.ar/wp-json/wc/store/v1";
const SITEMAP_URL = "https://rodak.ar/product-sitemap.xml";
// Honest identification, not a browser spoof: the origin's WAF operator must be
// able to tell who is crawling and where to complain.
const USER_AGENT = "RodakCatalogMigration/1.0 (+https://rodak.fromdevdiego.com)";
const REQUEST_DELAY_MS = 400;
const PER_PAGE = 100;

const SNAPSHOT_DIR = join(process.cwd(), "data", "woo-snapshot");
const SNAPSHOT_PATH = join(SNAPSHOT_DIR, "snapshot.json");

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const RETRY_OPTIONS: RetryOptions = { maxRetries: 4, baseDelayMs: 1000 };

interface PagedResult<T> {
  items: T[];
  total: number;
  totalPages: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Single HTTP GET with pacing and exponential backoff. Retries network errors,
 * HTTP 429 and 5xx (Wordfence throttling); any other non-2xx is a hard failure.
 * Throws once the retries are exhausted so the caller exits non-zero instead of
 * producing a partial snapshot.
 */
async function fetchWithRetry(url: string, options: RetryOptions = RETRY_OPTIONS): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= options.maxRetries; attempt += 1) {
    // Pacing applies to every request, retries included.
    await sleep(REQUEST_DELAY_MS);

    let response: Response;
    try {
      response = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    } catch (error: unknown) {
      lastError = error;
      if (attempt === options.maxRetries) break;
      await sleep(options.baseDelayMs * 2 ** attempt);
      continue;
    }

    if (response.ok) return response;

    if (response.status !== 429 && response.status < 500) {
      throw new Error(`GET ${url} failed with HTTP ${response.status} ${response.statusText} (not retryable)`);
    }

    lastError = new Error(`GET ${url} failed with HTTP ${response.status} ${response.statusText}`);
    if (attempt === options.maxRetries) break;
    await sleep(options.baseDelayMs * 2 ** attempt);
  }

  throw new Error(
    `GET ${url} failed after ${options.maxRetries + 1} attempts: ${String(lastError)}`,
  );
}

function readCountHeader(response: Response, header: string, url: string): number {
  const raw = response.headers.get(header);
  if (raw === null || raw.trim() === "") {
    throw new Error(`Missing ${header} response header for ${url} — cannot prove the fetch is complete.`);
  }
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Invalid ${header} response header for ${url}: "${raw}".`);
  }
  return value;
}

async function readJsonArray<T>(response: Response, url: string): Promise<T[]> {
  const body: unknown = await response.json();
  if (!Array.isArray(body)) {
    throw new Error(`Expected a JSON array from ${url}, got ${typeof body}.`);
  }
  return body as T[];
}

/**
 * Fetches every page of a Store API collection. `baseUrl` must already carry its
 * query string (the `page` parameter is appended here).
 */
async function fetchAllPages<T>(baseUrl: string): Promise<PagedResult<T>> {
  const firstUrl = `${baseUrl}&page=1`;
  const firstResponse = await fetchWithRetry(firstUrl);
  const total = readCountHeader(firstResponse, "X-WP-Total", firstUrl);
  const totalPages = readCountHeader(firstResponse, "X-WP-TotalPages", firstUrl);

  const items: T[] = await readJsonArray<T>(firstResponse, firstUrl);

  for (let page = 2; page <= totalPages; page += 1) {
    const url = `${baseUrl}&page=${page}`;
    const response = await fetchWithRetry(url);
    const pageItems = await readJsonArray<T>(response, url);

    // An empty page is a known origin-side anomaly (Wordfence / page cache), NOT
    // the end of the collection. Never break here: keep going to X-WP-TotalPages
    // so a blanked page cannot silently truncate the export. The count gate at
    // the end is what decides whether the run is complete.
    if (pageItems.length === 0) {
      console.warn(`WARNING: empty page ${page}/${totalPages} for ${baseUrl} — continuing to the last page.`);
    }

    items.push(...pageItems);
  }

  return { items, total, totalPages };
}

function assertPricesShape(prices: RawPrices | undefined, context: string): RawPrices {
  if (prices === undefined || typeof prices.currency_minor_unit !== "number") {
    throw new Error(`${context}: missing or malformed "prices" object in the Store API response.`);
  }
  return prices;
}

function pickAttributes(attributes: RawAttribute[] | undefined): RawAttribute[] {
  return (attributes ?? []).map((attribute) => ({
    name: attribute.name,
    value: attribute.value,
    terms: attribute.terms?.map((term) => ({ name: term.name })),
  }));
}

function pickProduct(product: RawProduct): RawProduct {
  const context = `Product ${String(product.id)} (${String(product.slug)})`;
  if (typeof product.id !== "number" || typeof product.slug !== "string" || product.slug === "") {
    throw new Error(`${context}: missing "id" or "slug" in the Store API response.`);
  }
  if (typeof product.type !== "string" || product.type === "") {
    throw new Error(`${context}: missing "type" — cannot tell simple from variable products.`);
  }
  if (typeof product.is_in_stock !== "boolean") {
    throw new Error(`${context}: missing "is_in_stock" — availability must never be guessed.`);
  }

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    permalink: product.permalink,
    sku: product.sku ?? "",
    type: product.type,
    description: product.description,
    prices: assertPricesShape(product.prices, context),
    is_in_stock: product.is_in_stock,
    images: (product.images ?? []).map((image) => ({ src: image.src, alt: image.alt })),
    categories: (product.categories ?? []).map((category) => ({
      id: category.id,
      name: category.name,
      slug: category.slug,
    })),
    attributes: pickAttributes(product.attributes),
    // Filled in below for variable products; simple products keep [] and the
    // transform synthesizes their single variant.
    variations: [],
  };
}

function pickVariation(variation: RawVariation, productSlug: string): RawVariation {
  const context = `Variation ${String(variation.id)} of ${productSlug}`;
  if (typeof variation.id !== "number") {
    throw new Error(`${context}: missing "id" in the Store API response.`);
  }
  if (typeof variation.is_in_stock !== "boolean") {
    throw new Error(`${context}: missing "is_in_stock" — availability must never be guessed.`);
  }

  return {
    id: variation.id,
    sku: variation.sku ?? "",
    prices: assertPricesShape(variation.prices, context),
    is_in_stock: variation.is_in_stock,
    attributes: pickAttributes(variation.attributes),
  };
}

/**
 * Product slugs published in the sitemap. `/shop/` URLs are archive pages, not
 * products, and are excluded.
 */
async function fetchSitemapSlugs(): Promise<string[]> {
  const response = await fetchWithRetry(SITEMAP_URL);
  const xml = await response.text();
  const slugs = new Set<string>();

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const loc = match[1].trim();
    if (loc === "" || loc.includes("/shop/")) continue;

    let pathname: string;
    try {
      pathname = new URL(loc).pathname;
    } catch {
      console.warn(`WARNING: unparseable <loc> in the sitemap, skipped: ${loc}`);
      continue;
    }

    const segments = pathname.split("/").filter((segment) => segment !== "");
    if (segments.length === 0) continue;

    const lastSegment = segments[segments.length - 1];
    let slug = lastSegment;
    try {
      // Sitemap URLs percent-encode non-ASCII slugs; the API returns them decoded.
      slug = decodeURIComponent(lastSegment);
    } catch {
      // Malformed escape sequence: keep the raw segment and let the gate report it.
    }
    slugs.add(slug);
  }

  return [...slugs];
}

/**
 * Completeness gate. Fails loud (and before anything is written to disk) so a
 * partial catalog can never reach the snapshot file.
 */
function assertComplete(products: RawProduct[], xWpTotal: number, sitemapSlugs: string[]): void {
  if (products.length !== xWpTotal) {
    throw new Error(
      `Incomplete fetch: got ${String(products.length)} products but X-WP-Total reports ${String(xWpTotal)}. ` +
        "Refusing to write a partial snapshot.",
    );
  }

  const fetchedSlugs = new Set(products.map((product) => product.slug));
  const missing = sitemapSlugs.filter((slug) => !fetchedSlugs.has(slug));
  if (missing.length > 0) {
    throw new Error(
      `Under-import: ${String(missing.length)} slug(s) present in the sitemap but missing from the fetch:\n` +
        missing.map((slug) => `  - ${slug}`).join("\n"),
    );
  }

  const sitemapSet = new Set(sitemapSlugs);
  const extra = [...fetchedSlugs].filter((slug) => !sitemapSet.has(slug));
  if (extra.length > 0) {
    // Sitemap lag is expected after a publish; not a failure.
    console.warn(
      `WARNING: ${String(extra.length)} fetched slug(s) are not in the sitemap (likely sitemap lag): ${extra.join(", ")}`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`Exporting catalog from ${API_BASE}`);

  const listUrl = `${API_BASE}/products?per_page=${String(PER_PAGE)}`;
  const { items, total, totalPages } = await fetchAllPages<RawProduct>(listUrl);
  console.log(`Product list: ${String(items.length)} item(s) over ${String(totalPages)} page(s).`);

  const products = items.map(pickProduct);

  for (const product of products) {
    if (product.type !== "variable") {
      product.variations = [];
      continue;
    }
    const variationsUrl = `${API_BASE}/products/${String(product.id)}/variations?per_page=${String(PER_PAGE)}`;
    const { items: variations, total: variationsTotal } = await fetchAllPages<RawVariation>(variationsUrl);

    // Same completeness rule as the product list: the origin can blank a page for
    // this endpoint too, and a variable product silently missing variations would
    // reach the database as a product with fewer prices than it really has.
    if (variations.length !== variationsTotal) {
      throw new Error(
        `Incomplete fetch for ${product.slug}: got ${String(variations.length)} variation(s) but ` +
          `X-WP-Total reports ${String(variationsTotal)}. Refusing to write a partial snapshot.`,
      );
    }

    product.variations = variations.map((variation) => pickVariation(variation, product.slug));
    console.log(`  ${product.slug}: ${String(product.variations.length)} variation(s).`);
  }

  const sitemapSlugs = await fetchSitemapSlugs();

  assertComplete(products, total, sitemapSlugs);
  console.log(
    `Fetched: ${String(products.length)} | X-WP-Total: ${String(total)} | Sitemap: ${String(sitemapSlugs.length)} — reconciled`,
  );

  const snapshot: Snapshot = {
    fetchedAt: new Date().toISOString(),
    source: API_BASE,
    counts: { xWpTotal: total, sitemap: sitemapSlugs.length, products: products.length },
    sitemapSlugs,
    products,
  };

  mkdirSync(SNAPSHOT_DIR, { recursive: true });
  writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Snapshot written to ${SNAPSHOT_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
