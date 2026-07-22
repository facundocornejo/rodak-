import type {
  PreparedProduct,
  PreparedVariant,
  RawAttribute,
  RawPrices,
  RawProduct,
  RawVariation,
} from "./types";

// Pure, offline core of the catalog migration: raw WooCommerce Store API payloads
// in, Prisma-shaped records out. No fs, no network, no database — every function
// here is deterministic and unit-testable, which is why the whole correctness
// surface of the migration (HTML extraction, integer money, stable SKUs) lives
// in this one file. Zero dependencies on purpose (no cheerio/jsdom/html-to-text).

/**
 * Named entities the Store API actually emits. `&#039;` is handled by the
 * numeric branch of the decoder, so it is intentionally absent here.
 */
const NAMED_ENTITIES: Record<string, string | undefined> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  nbsp: " ",
};

const ENTITY_PATTERN = /&(#\d+|[a-zA-Z][a-zA-Z0-9]*);/g;
const MAX_CODE_POINT = 0x10ffff;

/** Block-ish closing tags that mean "a line ended here". */
const CLOSING_BLOCK_PATTERN = /<\s*\/\s*(?:p|div|li)\s*>/gi;
const BR_PATTERN = /<\s*br\s*\/?\s*>/gi;
const REMAINING_TAG_PATTERN = /<[^>]+>/g;

// Marks a block boundary while whitespace is being collapsed, so that only real
// markup produces a line break. Newlines in the source HTML are just formatting
// (WooCommerce wraps its markup) and must NOT become line breaks in the text.
// The entity decoder refuses to emit control characters, so this sentinel cannot
// be injected through `&#0;`.
const BLOCK_BREAK = String.fromCharCode(0);
// A block break absorbs the single spaces the whitespace pass left around it.
const BLOCK_BREAK_RUN = new RegExp(`(?: ?${BLOCK_BREAK} ?)+`, "g");

/**
 * Decodes named and numeric entities in ONE pass. A two-pass decoder would
 * double-decode (`&amp;lt;` would wrongly become `<` instead of the literal
 * text `&lt;`), which is exactly the kind of silent corruption this migration
 * must not introduce into product descriptions.
 */
function decodeEntities(text: string): string {
  return text.replace(ENTITY_PATTERN, (match: string, body: string) => {
    if (body.startsWith("#")) {
      const codePoint = Number.parseInt(body.slice(1), 10);
      // Out-of-range or surrogate-half code points cannot be materialized; keep
      // the raw text rather than emitting a replacement character.
      if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > MAX_CODE_POINT) return match;
      if (codePoint >= 0xd800 && codePoint <= 0xdfff) return match;
      // Control characters are never legitimate description content, and letting
      // one through would let `&#0;` forge the block-break sentinel below.
      if (codePoint < 0x20) return match;
      return String.fromCodePoint(codePoint);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Converts the Store API's HTML description into plain text.
 *
 * Order matters twice over:
 * - tags are stripped BEFORE entities are decoded, so an escaped `&lt;strong&gt;`
 *   survives as visible text instead of being decoded into a tag and then
 *   deleted by the tag stripper;
 * - block boundaries are marked with a sentinel BEFORE whitespace is collapsed,
 *   so only real markup produces a line break. Source newlines are just markup
 *   formatting and must not become breaks in the stored text.
 *
 * The output is stored as text and never rendered as HTML, so no markup can
 * survive this function.
 */
export function htmlToText(html: string): string {
  const withBreaks = html
    .replace(CLOSING_BLOCK_PATTERN, BLOCK_BREAK)
    .replace(BR_PATTERN, BLOCK_BREAK);
  const withoutTags = withBreaks.replace(REMAINING_TAG_PATTERN, "");

  return decodeEntities(withoutTags)
    .replace(/\s+/g, " ")
    .replace(BLOCK_BREAK_RUN, "\n")
    .trim();
}

/** Store API prices are integer strings already scaled by `currency_minor_unit`. */
const INTEGER_MINOR_UNITS = /^\d+$/;

/**
 * Reads a price as integer cents. Money never touches a float here: the API
 * value is already in minor units, so it is parsed with `parseInt` and used
 * verbatim.
 *
 * Throws on an unsupported currency scale or a malformed amount. It must never
 * fall back to `0` — a zero price would pass every downstream validation and
 * silently publish a free product.
 *
 * Note: `sale_price` is `""` for products that are not on sale; callers must
 * check `on_sale`/emptiness first (see `resolveSalePriceCents`) rather than
 * relying on this function to be lenient.
 */
export function priceToCents(prices: RawPrices, field: "regular_price" | "sale_price"): number {
  if (prices.currency_minor_unit !== 2) {
    throw new Error(
      `Unsupported currency scale: currency_minor_unit=${String(prices.currency_minor_unit)} (expected 2). ` +
        "Refusing to guess where the decimal point goes.",
    );
  }

  const raw = prices[field].trim();
  if (!INTEGER_MINOR_UNITS.test(raw)) {
    throw new Error(
      `Malformed "${field}": ${JSON.stringify(prices[field])} is not an integer amount in minor units. ` +
        "Refusing to fall back to 0.",
    );
  }

  return Number.parseInt(raw, 10);
}

/**
 * Lowercase, diacritic-free, dash-separated token. Used only for SKU derivation,
 * never for display values.
 */
function slugifyValue(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** An attribute's chosen value: the direct value, else its first term. */
function attributeValue(attribute: RawAttribute): string {
  const direct = attribute.value?.trim() ?? "";
  if (direct !== "") return direct;

  const terms = attribute.terms ?? [];
  return terms.length > 0 ? terms[0].name.trim() : "";
}

/**
 * Deterministic variant SKU.
 *
 * A real SKU from the origin wins verbatim. Otherwise the SKU is derived from
 * stable inputs only (product slug + attribute values sorted by attribute name),
 * so every re-run of the migration produces the exact same string — the import
 * upserts variants keyed on `sku`, so instability here would duplicate rows
 * instead of updating them.
 *
 * Cross-variant collisions are NOT resolved here; `transformProduct` suffixes
 * duplicates in source order.
 */
export function deriveSku(product: RawProduct, variation: RawVariation | null): string {
  const variationSku = variation?.sku.trim() ?? "";
  if (variationSku !== "") return variationSku;

  if (variation === null) {
    const productSku = product.sku.trim();
    if (productSku !== "") return productSku;
  }

  const attributes = variation?.attributes ?? product.attributes;
  const attrSlug = [...attributes]
    // Locale-independent sort: the attribute order in the payload is not stable,
    // the sorted order is.
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((attribute) => slugifyValue(attributeValue(attribute)))
    .filter((slug) => slug !== "")
    .join("-");

  return `${product.slug}--v-${attrSlug === "" ? "default" : attrSlug}`;
}

const MATERIAL_PATTERN = /material|madera|acabado/i;
const SIZE_PATTERN = /medida|tama|size|dimension/i;

/**
 * Best-effort mapping of free-form WooCommerce attributes onto the two columns
 * the schema has. Unmatched attributes are ignored here (they still feed
 * `deriveSku`), and both fields stay `null` when nothing matches.
 */
export function mapAttributes(attributes: RawAttribute[]): {
  material: string | null;
  sizeMm: string | null;
} {
  let material: string | null = null;
  let sizeMm: string | null = null;

  for (const attribute of attributes) {
    const value = attributeValue(attribute);
    if (value === "") continue;

    // First match wins: a payload with two "material"-ish attributes keeps the
    // one the origin listed first instead of silently flipping between runs.
    if (material === null && MATERIAL_PATTERN.test(attribute.name)) {
      material = value;
      continue;
    }
    if (sizeMm === null && SIZE_PATTERN.test(attribute.name)) {
      sizeMm = value;
    }
  }

  return { material, sizeMm };
}

/**
 * Promotional price in cents, or `null` when the variant is not really on sale.
 *
 * The comparison is done in cents rather than on the raw strings so that a
 * cosmetic difference (`"01500"` vs `"1500"`) is not mistaken for a discount.
 *
 * A sale price ABOVE the regular one is malformed origin data, not a discount.
 * It throws instead of returning `null`, because silently dropping it would
 * hide a real inconsistency in the source catalog, and instead of passing it
 * through, because a "sale" that costs more than the regular price is exactly
 * the kind of wrong-but-plausible value that survives validation.
 */
function resolveSalePriceCents(prices: RawPrices): number | null {
  if (!prices.on_sale) return null;
  if (prices.sale_price.trim() === "") return null;

  const saleCents = priceToCents(prices, "sale_price");
  const regularCents = priceToCents(prices, "regular_price");
  if (saleCents === regularCents) return null;

  if (saleCents > regularCents) {
    throw new Error(
      `Sale price ${String(saleCents)} is above the regular price ${String(regularCents)} (both in cents). ` +
        "Refusing to store an inflated discount.",
    );
  }

  return saleCents;
}

/**
 * Suffixes duplicated SKUs with `-2`, `-3`, … in source order. The loop also
 * covers the pathological case where the suffixed candidate itself collides
 * with a real origin SKU, so the result is always unique within the product.
 *
 * `nextSuffix` remembers where each base SKU left off so a product with many
 * identical SKUs does not rescan the whole `used` set from `-2` every time.
 * It is an optimization, not a correctness requirement: dropping it and always
 * restarting the search at `-2` yields the same output.
 */
function resolveSkuCollisions(skus: string[]): string[] {
  const used = new Set<string>();
  const nextSuffix = new Map<string, number>();

  return skus.map((sku) => {
    let candidate = sku;
    let suffix = nextSuffix.get(sku) ?? 1;

    while (used.has(candidate)) {
      suffix += 1;
      candidate = `${sku}-${String(suffix)}`;
    }

    nextSuffix.set(sku, suffix);
    used.add(candidate);
    return candidate;
  });
}

/**
 * Maps one variation (or the product itself, for a simple product) onto a
 * prepared variant. `variation === null` means "synthesized single variant":
 * prices, availability and attributes then come from the product.
 */
function toVariant(product: RawProduct, variation: RawVariation | null): PreparedVariant {
  const prices = variation === null ? product.prices : variation.prices;
  const attributes = variation === null ? product.attributes : variation.attributes;
  const { material, sizeMm } = mapAttributes(attributes);

  return {
    sku: deriveSku(product, variation),
    // A synthesized variant has no WooCommerce variation id; the product's own
    // id belongs to `PreparedProduct.wooId`, never here.
    wooId: variation === null ? null : variation.id,
    material,
    sizeMm,
    priceCents: priceToCents(prices, "regular_price"),
    salePriceCents: resolveSalePriceCents(prices),
    inStock: variation === null ? product.is_in_stock : variation.is_in_stock,
  };
}

/**
 * Full raw product → prepared product. Variable products map one variant per
 * variation; every other type gets exactly one synthesized variant, so the
 * invariant "a product always has at least one priced variant" holds for every
 * value this function returns.
 *
 * Throws, with the offending product identified, rather than returning a
 * partial record: a migration over ~111 products that fails must say WHICH
 * product failed, and a product with no priced variant must never reach the
 * database looking like a valid row.
 */
export function transformProduct(raw: RawProduct): PreparedProduct {
  try {
    // A variable product whose variations were all trashed or unpublished at the
    // origin arrives with an empty array. Synthesizing a variant from the parent
    // would invent a price the origin does not actually offer.
    if (raw.type === "variable" && raw.variations.length === 0) {
      throw new Error(
        'Variable product has no variations: cannot determine a price. Re-export, or fix the product at the origin.',
      );
    }

    const draftVariants =
      raw.type === "variable"
        ? raw.variations.map((variation) => toVariant(raw, variation))
        : [toVariant(raw, null)];

    const uniqueSkus = resolveSkuCollisions(draftVariants.map((variant) => variant.sku));
    const variants = draftVariants.map((variant, index) => ({ ...variant, sku: uniqueSkus[index] }));

    return {
      wooId: raw.id,
      slug: raw.slug,
      name: raw.name,
      description: htmlToText(raw.description ?? ""),
      categories: raw.categories.map((category) => ({ slug: category.slug, name: category.name })),
      media: raw.images.map((image, index) => ({
        url: image.src,
        alt: image.alt.trim() === "" ? null : image.alt,
        position: index,
      })),
      variants,
    };
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Product ${String(raw.id)} (${raw.slug}): ${detail}`, { cause: error });
  }
}
