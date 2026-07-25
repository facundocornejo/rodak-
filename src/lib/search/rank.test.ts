import { describe, expect, it } from "vitest";

import {
  MAX_QUERY_LENGTH,
  MIN_QUERY_LENGTH,
  SCORE_DESCRIPTION_CONTAINS,
  SCORE_NAME_CONTAINS,
  SCORE_NAME_EXACT,
  SCORE_NAME_STARTS_WITH,
  isQueryValid,
  normalizeSearchText,
  rankRows,
} from "./rank";

interface Row {
  slug: string;
  name: string;
  description: string | null;
}

function row(slug: string, name: string, description: string | null = null): Row {
  return { slug, name, description };
}

// Names carry accents on purpose: the catalog is Spanish ("Paraíso", "Guatambú").
const catalog: Row[] = [
  row("mesa", "Mesa"),
  row("mesa-ratona", "Mesa ratona", "Una mesa baja para el living."),
  row("mesa-de-luz", "Mesa de luz"),
  row("gran-mesa-plegable", "Gran mesa plegable"),
  row("banqueta", "Banqueta", "Combina con cualquier mesa del catálogo."),
  // Noise: neither name nor description contains "mesa".
  row("mesita", "Mesita"),
  row("estante", "Estante", "Roble macizo."),
];

describe("normalizeSearchText", () => {
  it("strips diacritics and lowercases", () => {
    expect(normalizeSearchText("méSa")).toBe("mesa");
    expect(normalizeSearchText("PARAÍSO")).toBe("paraiso");
    expect(normalizeSearchText("Guatambú")).toBe("guatambu");
  });

  it("leaves an already-normalized string untouched", () => {
    expect(normalizeSearchText("mesa ratona")).toBe("mesa ratona");
  });

  // Documented consequence of the NFD + `\p{Diacritic}` rule, not an accident:
  // ñ decomposes to n + combining tilde, so it folds to "n". It only ever makes
  // matching MORE permissive ("Ñandú" is findable as "nandu" and as "ñandu"),
  // which is the right direction for a storefront search box.
  it("folds ñ into n, because the tilde is a combining diacritic in NFD", () => {
    expect(normalizeSearchText("Ñandú")).toBe("nandu");
    expect(rankRows([row("n", "Ñandú")], "nandu").map((item) => item.slug)).toEqual(["n"]);
    expect(rankRows([row("n", "Ñandú")], "ñandu").map((item) => item.slug)).toEqual(["n"]);
  });
});

describe("isQueryValid", () => {
  it(`rejects queries shorter than ${String(MIN_QUERY_LENGTH)} characters`, () => {
    expect(isQueryValid("")).toBe(false);
    expect(isQueryValid("m")).toBe(false);
    expect(isQueryValid("   ")).toBe(false);
    // Whitespace does not pad a query into validity.
    expect(isQueryValid(" m ")).toBe(false);
  });

  it("accepts the boundary lengths", () => {
    expect(isQueryValid("me")).toBe(true);
    expect(isQueryValid("a".repeat(MAX_QUERY_LENGTH))).toBe(true);
  });

  it(`rejects queries longer than ${String(MAX_QUERY_LENGTH)} characters`, () => {
    expect(isQueryValid("a".repeat(MAX_QUERY_LENGTH + 1))).toBe(false);
  });

  it("counts code points, not UTF-16 units", () => {
    // One astral code point: two `.length` units, one character.
    expect(isQueryValid("🪑")).toBe(false);
    expect(isQueryValid("🪑🪑")).toBe(true);
  });
});

describe("rankRows", () => {
  it("returns identical ordered slugs for MESA / mesa / méSa", () => {
    const upper = rankRows(catalog, "MESA").map((item) => item.slug);
    const lower = rankRows(catalog, "mesa").map((item) => item.slug);
    const accented = rankRows(catalog, "méSa").map((item) => item.slug);

    expect(upper).toEqual(lower);
    expect(accented).toEqual(lower);
    expect(lower).toEqual([
      // exact name
      "mesa",
      // name startsWith, tie-broken by name asc
      "mesa-de-luz",
      "mesa-ratona",
      // name contains, but does not start with the query
      "gran-mesa-plegable",
      // description contains
      "banqueta",
    ]);
  });

  it("returns [] for a query with no matches", () => {
    expect(rankRows(catalog, "hamaca paraguaya")).toEqual([]);
  });

  it("returns [] for an empty row set", () => {
    expect(rankRows([], "mesa")).toEqual([]);
  });

  it("drops non-matching rows instead of scoring them 0", () => {
    const ranked = rankRows(catalog, "mesa").map((item) => item.slug);

    expect(ranked).not.toContain("estante");
    expect(ranked).not.toContain("mesita");
    expect(ranked).toHaveLength(5);
  });

  it("orders the score rungs exact > startsWith > contains > description", () => {
    expect(SCORE_NAME_EXACT).toBeGreaterThan(SCORE_NAME_STARTS_WITH);
    expect(SCORE_NAME_STARTS_WITH).toBeGreaterThan(SCORE_NAME_CONTAINS);
    expect(SCORE_NAME_CONTAINS).toBeGreaterThan(SCORE_DESCRIPTION_CONTAINS);
  });

  it("matches the description too, ranked below every name match", () => {
    const ranked = rankRows(catalog, "roble").map((item) => item.slug);

    expect(ranked).toEqual(["estante"]);
  });

  it("treats a null description as empty rather than throwing", () => {
    expect(rankRows([row("x", "Silla", null)], "silla").map((item) => item.slug)).toEqual(["x"]);
  });

  it("breaks score ties by name, then by slug", () => {
    const ties: Row[] = [
      row("b-copia", "Banco alto"),
      row("a-original", "Banco alto"),
      row("zzz", "Banco bajo"),
      row("aaa", "Árbol banco"),
    ];

    // All four contain "banco": "Banco alto"/"Banco bajo" start with it (60),
    // "Árbol banco" only contains it (40).
    expect(rankRows(ties, "banco").map((item) => item.slug)).toEqual([
      "a-original",
      "b-copia",
      "zzz",
      "aaa",
    ]);
  });

  it("sorts accented names next to their unaccented form, not after Z", () => {
    const ties: Row[] = [row("zapato", "Zapatero mesa"), row("arbol", "Árbol mesa")];

    expect(rankRows(ties, "mesa").map((item) => item.slug)).toEqual(["arbol", "zapato"]);
  });

  it("is deterministic across repeated calls with a shuffled input", () => {
    const shuffled = [...catalog].reverse();

    expect(rankRows(shuffled, "mesa").map((item) => item.slug)).toEqual(
      rankRows(catalog, "mesa").map((item) => item.slug),
    );
  });

  it("does not mutate the input array", () => {
    const rows = [...catalog];

    rankRows(rows, "mesa");

    expect(rows).toEqual(catalog);
  });

  it("returns [] for an invalid-length query, matching the caller's guard", () => {
    expect(rankRows(catalog, "m")).toEqual([]);
    expect(rankRows(catalog, "a".repeat(MAX_QUERY_LENGTH + 1))).toEqual([]);
  });

  it("returns [] for a query that normalizes away instead of matching everything", () => {
    // Two bare combining acute accents: length 2 (valid), normalizes to "".
    const combiningOnly = "́́";

    expect(isQueryValid(combiningOnly)).toBe(true);
    expect(rankRows(catalog, combiningOnly)).toEqual([]);
  });

  it("ignores surrounding whitespace in the query", () => {
    expect(rankRows(catalog, "  mesa  ").map((item) => item.slug)).toEqual(
      rankRows(catalog, "mesa").map((item) => item.slug),
    );
  });

  it("hands back the caller's own row objects so extra fields survive", () => {
    const enriched = { ...row("mesa", "Mesa"), categoryName: "Mesas" };

    const [first] = rankRows([enriched], "mesa");

    expect(first).toBe(enriched);
    expect(first.categoryName).toBe("Mesas");
  });
});
