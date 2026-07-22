import { describe, expect, it } from "vitest";

import fixture from "./__fixtures__/sample-products.json";
import { deriveSku, htmlToText, mapAttributes, priceToCents, transformProduct } from "./transform";
import type { RawPrices, RawProduct, RawVariation, Snapshot } from "./types";

// Typed on purpose (no `as` cast): if the fixture ever drifts away from the
// shapes in types.ts, `npm run typecheck` fails instead of the tests silently
// asserting against a payload the real pipeline could never produce.
const snapshot: Snapshot = fixture;

// Named so the non-obvious characters in the expected descriptions are
// unambiguous in source (same convention as src/lib/format.test.ts).
const EN_DASH = "–"; // &#8211; in the fixture
const I_ACUTE = "í"; // &#237; in the fixture

function productBySlug(slug: string): RawProduct {
  const product = snapshot.products.find((candidate) => candidate.slug === slug);
  if (product === undefined) throw new Error(`Fixture is missing the product "${slug}".`);
  return product;
}

function prices(overrides: Partial<RawPrices> = {}): RawPrices {
  return {
    currency_minor_unit: 2,
    price: "100000",
    regular_price: "100000",
    sale_price: "",
    on_sale: false,
    ...overrides,
  };
}

function rawProduct(overrides: Partial<RawProduct> = {}): RawProduct {
  return {
    id: 9001,
    name: "Repisa Duo",
    slug: "repisa-duo",
    permalink: "https://rodak.ar/producto/repisa-duo/",
    sku: "",
    type: "variable",
    prices: prices(),
    is_in_stock: true,
    images: [],
    categories: [],
    attributes: [],
    variations: [],
    ...overrides,
  };
}

function rawVariation(overrides: Partial<RawVariation> = {}): RawVariation {
  return {
    id: 1,
    sku: "",
    prices: prices(),
    is_in_stock: true,
    attributes: [{ name: "Material", value: "Roble" }],
    ...overrides,
  };
}

describe("htmlToText", () => {
  it("decodes the named entities WooCommerce emits", () => {
    expect(htmlToText("Bar &amp; Quincho &quot;Nordelta&quot; &lt;2026&gt;")).toBe(
      'Bar & Quincho "Nordelta" <2026>',
    );
  });

  it("decodes numeric entities", () => {
    expect(htmlToText("env&#237;o &#8211; gratis")).toBe(`env${I_ACUTE}o ${EN_DASH} gratis`);
  });

  it("turns block-level tags into newlines", () => {
    expect(htmlToText("<p>uno</p><div>dos</div><ul><li>tres</li></ul>")).toBe("uno\ndos\ntres");
    expect(htmlToText("uno<br>dos<br/>tres<br />cuatro")).toBe("uno\ndos\ntres\ncuatro");
  });

  it("strips every remaining tag", () => {
    expect(htmlToText('<span class="x"><strong>Escritorio</strong> Vancouver</span>')).toBe(
      "Escritorio Vancouver",
    );
  });

  it("collapses whitespace runs and trims the result", () => {
    expect(htmlToText("  <p>  Mesa   ratona\n\n  Brooklyn  </p>\n\n  ")).toBe("Mesa ratona Brooklyn");
  });

  it("does not turn source-formatting newlines into line breaks", () => {
    // Only markup ends a line: WooCommerce wraps its own HTML source and those
    // newlines must not leak into the stored description.
    expect(htmlToText("<p>Mesa ratona\n   Brooklyn</p>\n<p>Guatambú</p>")).toBe(
      "Mesa ratona Brooklyn\nGuatambú",
    );
  });

  it("leaves control-character entities undecoded", () => {
    expect(htmlToText("<p>uno&#0;dos</p>")).toBe("uno&#0;dos");
  });

  it("decodes &nbsp; to a regular space so it collapses like any other whitespace", () => {
    expect(htmlToText("Medidas:&nbsp;&nbsp;10&nbsp;x&nbsp;8&nbsp;cm")).toBe("Medidas: 10 x 8 cm");
  });

  it("keeps escaped markup as visible text instead of deleting it", () => {
    // Decoding before stripping would turn this into a real tag and drop it.
    expect(htmlToText("<p>Usar &lt;strong&gt; sin miedo</p>")).toBe("Usar <strong> sin miedo");
  });

  it("never double-decodes an escaped ampersand", () => {
    expect(htmlToText("&amp;lt;")).toBe("&lt;");
  });

  it("returns an empty string for empty input", () => {
    expect(htmlToText("")).toBe("");
  });
});

describe("priceToCents", () => {
  it("reads the regular price as integer cents", () => {
    // ARS 1.112.713 — the same value the seed documents.
    expect(priceToCents(prices({ regular_price: "111271300" }), "regular_price")).toBe(111271300);
  });

  it("reads the sale price as integer cents", () => {
    expect(
      priceToCents(prices({ sale_price: "38250000", on_sale: true }), "sale_price"),
    ).toBe(38250000);
  });

  it("throws when the currency scale is not 2 decimals", () => {
    expect(() => priceToCents(prices({ currency_minor_unit: 0 }), "regular_price")).toThrow(
      /currency_minor_unit=0/,
    );
  });

  it("throws instead of truncating a decimal amount", () => {
    // parseInt("1112.71") would silently yield 1112 cents — 1000x off.
    expect(() => priceToCents(prices({ regular_price: "1112.71" }), "regular_price")).toThrow(
      /not an integer amount/,
    );
  });

  it("throws instead of returning 0 for a missing amount", () => {
    expect(() => priceToCents(prices({ sale_price: "" }), "sale_price")).toThrow(
      /not an integer amount/,
    );
  });
});

describe("deriveSku", () => {
  it("uses the variation SKU verbatim, trimmed", () => {
    const product = productBySlug("escritorio-vancouver-paraiso");
    expect(deriveSku(product, product.variations[2])).toBe("ESC-VAN-PAR-160");
  });

  it("uses the product SKU verbatim for a simple product", () => {
    expect(deriveSku(productBySlug("soporte-celular-rodak"), null)).toBe("SOP-CEL-001");
  });

  it("derives from the attributes when the variation has no SKU", () => {
    const product = productBySlug("escritorio-vancouver-paraiso");
    expect(deriveSku(product, product.variations[1])).toBe(
      "escritorio-vancouver-paraiso--v-paraiso-140-cm",
    );
  });

  it("sorts attributes by name and strips diacritics, ignoring payload order", () => {
    const attributes = [
      { name: "Medida", value: "90 x 35 cm" },
      { name: "Material", value: "Paraíso" },
    ];
    const reversed = [...attributes].reverse();

    expect(deriveSku(rawProduct({ type: "simple", attributes }), null)).toBe(
      "repisa-duo--v-paraiso-90-x-35-cm",
    );
    expect(deriveSku(rawProduct({ type: "simple", attributes: reversed }), null)).toBe(
      "repisa-duo--v-paraiso-90-x-35-cm",
    );
  });

  it("falls back to --v-default with no SKU and no attributes", () => {
    expect(deriveSku(productBySlug("mesa-ratona-brooklyn"), null)).toBe(
      "mesa-ratona-brooklyn--v-default",
    );
  });

  it("ignores the parent SKU when deriving for a variation", () => {
    const product = rawProduct({ sku: "PARENT-SKU" });
    expect(deriveSku(product, rawVariation())).toBe("repisa-duo--v-roble");
  });

  it("is stable across repeated calls with the same input", () => {
    const product = productBySlug("banco-quincho-nordelta");
    const first = deriveSku(product, null);
    const second = deriveSku(product, null);
    const third = deriveSku(product, null);

    expect(first).toBe("banco-quincho-nordelta--v-paraiso-90-x-35-cm");
    expect(second).toBe(first);
    expect(third).toBe(first);
  });

  it("does not reorder the caller's attributes array", () => {
    const attributes = [
      { name: "Medida", value: "90 x 35 cm" },
      { name: "Material", value: "Paraíso" },
    ];
    deriveSku(rawProduct({ type: "simple", attributes }), null);

    expect(attributes.map((attribute) => attribute.name)).toEqual(["Medida", "Material"]);
  });
});

describe("mapAttributes", () => {
  it("matches material and size attribute names case-insensitively", () => {
    expect(
      mapAttributes([
        { name: "MATERIAL", value: "Paraíso" },
        { name: "Medida", value: "120 cm" },
      ]),
    ).toEqual({ material: "Paraíso", sizeMm: "120 cm" });
  });

  it("matches the Spanish aliases for both fields", () => {
    expect(mapAttributes([{ name: "Tipo de madera", value: "Guatambú" }]).material).toBe(
      "Guatambú",
    );
    expect(mapAttributes([{ name: "Acabado", value: "Al agua" }]).material).toBe("Al agua");
    expect(mapAttributes([{ name: "Tamaño", value: "90 cm" }]).sizeMm).toBe("90 cm");
    expect(mapAttributes([{ name: "Dimensiones", value: "90x35" }]).sizeMm).toBe("90x35");
  });

  it("reads the first term when the attribute carries no direct value", () => {
    expect(mapAttributes([{ name: "Material", terms: [{ name: "Roble" }, { name: "Pino" }] }])).toEqual(
      { material: "Roble", sizeMm: null },
    );
  });

  it("returns nulls when nothing matches", () => {
    expect(mapAttributes([{ name: "Color", value: "Negro" }])).toEqual({
      material: null,
      sizeMm: null,
    });
    expect(mapAttributes([])).toEqual({ material: null, sizeMm: null });
  });
});

describe("transformProduct", () => {
  it("maps a variable product to one variant per variation", () => {
    expect(transformProduct(productBySlug("escritorio-vancouver-paraiso"))).toEqual({
      wooId: 4100,
      slug: "escritorio-vancouver-paraiso",
      name: "Escritorio Vancouver Paraíso",
      description:
        "Escritorio de madera maciza de paraíso con estructura de hierro.\n" +
        "Fabricación artesanal & terminación al agua.",
      categories: [
        { slug: "muebles", name: "Muebles" },
        { slug: "escritorios", name: "Escritorios" },
      ],
      media: [
        {
          url: "https://rodak.ar/wp-content/uploads/2025/03/escritorio-vancouver-paraiso-1.jpg",
          alt: "Escritorio Vancouver Paraíso de frente",
          position: 0,
        },
        {
          url: "https://rodak.ar/wp-content/uploads/2025/03/escritorio-vancouver-paraiso-2.jpg",
          alt: null,
          position: 1,
        },
      ],
      variants: [
        {
          sku: "ESC-VAN-PAR-120",
          wooId: 4101,
          material: "Paraíso",
          sizeMm: "120 cm",
          priceCents: 111271300,
          salePriceCents: null,
          inStock: true,
        },
        {
          sku: "escritorio-vancouver-paraiso--v-paraiso-140-cm",
          wooId: 4102,
          material: "Paraíso",
          sizeMm: "140 cm",
          priceCents: 128500000,
          salePriceCents: null,
          inStock: false,
        },
        {
          sku: "ESC-VAN-PAR-160",
          wooId: 4103,
          material: "Paraíso",
          sizeMm: "160 cm",
          // The on-sale variation keeps the REGULAR price in priceCents.
          priceCents: 145000000,
          salePriceCents: 123250000,
          inStock: true,
        },
      ],
    });
  });

  it("synthesizes exactly one wooId-less variant for a simple product", () => {
    expect(transformProduct(productBySlug("soporte-celular-rodak"))).toEqual({
      wooId: 3820,
      slug: "soporte-celular-rodak",
      name: "Soporte Celular Rodak",
      description:
        `Soporte de celular en madera maciza ${EN_DASH} ideal para escritorio & home office.\n` +
        "Medidas: 10 x 8 cm.",
      categories: [{ slug: "anexos-de-escritorios", name: "Anexos de escritorios" }],
      media: [
        {
          url: "https://rodak.ar/wp-content/uploads/2024/11/soporte-celular-rodak.jpg",
          alt: "Soporte de celular Rodak",
          position: 0,
        },
      ],
      variants: [
        {
          sku: "SOP-CEL-001",
          wooId: null,
          material: null,
          sizeMm: null,
          priceCents: 613500,
          salePriceCents: null,
          inStock: true,
        },
      ],
    });
  });

  it("keeps the regular price and records the discount for an on-sale product", () => {
    expect(transformProduct(productBySlug("mesa-ratona-brooklyn"))).toEqual({
      wooId: 3915,
      slug: "mesa-ratona-brooklyn",
      name: "Mesa Ratona Brooklyn",
      description: "Mesa ratona con tapa de guatambú.",
      categories: [
        { slug: "muebles", name: "Muebles" },
        { slug: "mesas-ratonas", name: "Mesas ratonas" },
      ],
      media: [
        {
          url: "https://rodak.ar/wp-content/uploads/2025/01/mesa-ratona-brooklyn.jpg",
          alt: "Mesa ratona Brooklyn",
          position: 0,
        },
      ],
      variants: [
        {
          sku: "mesa-ratona-brooklyn--v-default",
          wooId: null,
          material: null,
          sizeMm: null,
          priceCents: 45000000,
          salePriceCents: 38250000,
          inStock: true,
        },
      ],
    });
  });

  it("flattens an entity-laden HTML description into plain text", () => {
    expect(transformProduct(productBySlug("banco-quincho-nordelta"))).toEqual({
      wooId: 4210,
      slug: "banco-quincho-nordelta",
      name: "Banco Quincho Nordelta",
      description:
        "Banco de quincho Nordelta.\n" +
        "Madera de paraíso\n" +
        "Terminación al agua\n" +
        "Usar la etiqueta <strong> no rompe el texto.\n" +
        `Consultar por env${I_ACUTE}o.`,
      categories: [{ slug: "quincho-terraza", name: "Quincho / Terraza" }],
      media: [],
      variants: [
        {
          sku: "banco-quincho-nordelta--v-paraiso-90-x-35-cm",
          wooId: null,
          material: "Paraíso",
          sizeMm: "90 x 35 cm",
          priceCents: 27400000,
          salePriceCents: null,
          inStock: false,
        },
      ],
    });
  });

  it("ignores a sale price that does not actually discount the regular one", () => {
    const product = rawProduct({
      type: "simple",
      prices: prices({ regular_price: "100000", sale_price: "0100000", on_sale: true }),
    });

    expect(transformProduct(product).variants[0].salePriceCents).toBeNull();
  });

  it("suffixes colliding derived SKUs in source order", () => {
    const product = rawProduct({
      variations: [
        rawVariation({ id: 11 }),
        rawVariation({ id: 12 }),
        rawVariation({ id: 13 }),
      ],
    });

    expect(transformProduct(product).variants.map((variant) => variant.sku)).toEqual([
      "repisa-duo--v-roble",
      "repisa-duo--v-roble-2",
      "repisa-duo--v-roble-3",
    ]);
  });

  it("never emits a duplicate SKU, even when a real SKU looks like a suffixed one", () => {
    const product = rawProduct({
      variations: [
        rawVariation({ id: 11 }),
        rawVariation({ id: 12, sku: "repisa-duo--v-roble-2" }),
        rawVariation({ id: 13 }),
      ],
    });

    const skus = transformProduct(product).variants.map((variant) => variant.sku);
    expect(skus).toEqual([
      "repisa-duo--v-roble",
      "repisa-duo--v-roble-2",
      "repisa-duo--v-roble-3",
    ]);
    expect(new Set(skus).size).toBe(skus.length);
  });

  it("produces byte-identical output on a re-run, so the sku-keyed upsert stays idempotent", () => {
    const first = snapshot.products.map(transformProduct);
    const second = snapshot.products.map(transformProduct);

    expect(JSON.stringify(second)).toBe(JSON.stringify(first));
  });

  it("propagates a malformed price instead of importing a free product", () => {
    const product = rawProduct({
      type: "simple",
      prices: prices({ currency_minor_unit: 3 }),
    });

    expect(() => transformProduct(product)).toThrow(/currency_minor_unit=3/);
  });

  it("names the offending product when it throws, so a batch run is debuggable", () => {
    const product = rawProduct({
      id: 4242,
      slug: "banqueta-tandil",
      type: "simple",
      prices: prices({ currency_minor_unit: 3 }),
    });

    expect(() => transformProduct(product)).toThrow(/Product 4242 \(banqueta-tandil\)/);
  });

  it("refuses a variable product with no variations instead of returning it priceless", () => {
    const product = rawProduct({ type: "variable", variations: [] });

    expect(() => transformProduct(product)).toThrow(/no variations/);
  });

  it("refuses a sale price above the regular price instead of storing an inflated discount", () => {
    const product = rawProduct({
      type: "simple",
      prices: prices({ regular_price: "100000", sale_price: "150000", on_sale: true }),
    });

    expect(() => transformProduct(product)).toThrow(/above the regular price/);
  });

  it("treats an on-sale flag with no sale amount as not on sale", () => {
    const product = rawProduct({
      type: "simple",
      prices: prices({ regular_price: "100000", sale_price: "", on_sale: true }),
    });

    const [variant] = transformProduct(product).variants;
    expect(variant.priceCents).toBe(100000);
    expect(variant.salePriceCents).toBeNull();
  });
});
