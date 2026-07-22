// Shared shapes for the catalog migration pipeline (export -> transform -> import).
// `Raw*` types mirror the WooCommerce Store API payload verbatim (snake_case field
// names come from the API and are intentionally not renamed). `Prepared*` types are
// the transform's output, already shaped for the Prisma models.

export interface RawPrices {
  currency_minor_unit: number;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
}

export interface RawAttribute {
  name: string;
  value?: string;
  terms?: Array<{ name: string }>;
}

export interface RawVariation {
  id: number;
  sku: string;
  prices: RawPrices;
  is_in_stock: boolean;
  attributes: RawAttribute[];
}

export interface RawProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  type: string; // "simple" | "variable" as returned by the Store API
  description?: string; // raw HTML from the Store API; the transform converts it to plain text
  prices: RawPrices;
  is_in_stock: boolean;
  images: Array<{ src: string; alt: string }>;
  categories: Array<{ id: number; name: string; slug: string }>;
  attributes: RawAttribute[];
  variations: RawVariation[]; // populated by export.ts for variable products; [] for simple
}

export interface Snapshot {
  fetchedAt: string; // new Date().toISOString()
  source: string; // "https://rodak.ar/wp-json/wc/store/v1"
  counts: { xWpTotal: number; sitemap: number; products: number };
  sitemapSlugs: string[];
  products: RawProduct[];
}

export interface PreparedVariant {
  sku: string;
  wooId: number | null; // null only for a synthesized simple-product variant
  material: string | null;
  sizeMm: string | null;
  priceCents: number;
  salePriceCents: number | null;
  inStock: boolean;
}

export interface PreparedProduct {
  wooId: number;
  slug: string;
  name: string;
  description: string; // plain text, no HTML tags (see spec "Plain-text descriptions")
  categories: Array<{ slug: string; name: string }>;
  media: Array<{ url: string; alt: string | null; position: number }>;
  variants: PreparedVariant[];
}
