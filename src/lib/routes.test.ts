import { describe, expect, it } from "vitest";

import { category, home, product, search } from "./routes";

/**
 * INV-5 is about the PATH ending in a slash, which is what `trailingSlash: true`
 * redirects on. A search href legitimately continues with `?q=…` after that
 * slash, so the assertion parses the href instead of matching the last
 * character of the whole string.
 */
function pathnameOf(href: string): string {
  return new URL(href, "https://rodak.test").pathname;
}

describe("routes", () => {
  describe("trailing slash [INV-5]", () => {
    const hrefs: [string, string][] = [
      ["home()", home()],
      ["category()", category("mesas")],
      ["product()", product("mesa-ratona")],
      ["search() bare", search()],
      ["search() with query", search({ q: "mesa" })],
      ["search() with query and page", search({ q: "mesa", page: 3 })],
      ["search() with page only", search({ page: 2 })],
    ];

    it.each(hrefs)("%s returns a path ending in a slash", (_label, href) => {
      expect(pathnameOf(href)).toMatch(/\/$/);
    });

    it.each(hrefs)("%s returns a root-relative href", (_label, href) => {
      expect(href.startsWith("/")).toBe(true);
    });
  });

  describe("home", () => {
    it("is the site root", () => {
      expect(home()).toBe("/");
    });
  });

  describe("category", () => {
    it("builds the category path", () => {
      expect(category("escritorios-y-accesorios")).toBe("/categoria/escritorios-y-accesorios/");
    });

    it("encodes a slug so it cannot escape its path segment", () => {
      expect(category("a/b")).toBe("/categoria/a%2Fb/");
    });

    it("throws on a blank slug instead of emitting a broken '//' link", () => {
      expect(() => category("")).toThrow(/empty slug/);
      expect(() => category("   ")).toThrow(/empty slug/);
    });
  });

  describe("product", () => {
    it("builds the product path", () => {
      expect(product("bandeja-de-teclado")).toBe("/producto/bandeja-de-teclado/");
    });

    it("throws on a blank slug", () => {
      expect(() => product("")).toThrow(/empty slug/);
    });
  });

  describe("search", () => {
    it("returns the bare search page with no arguments", () => {
      expect(search()).toBe("/buscar/");
    });

    it("omits a blank query", () => {
      expect(search({ q: "   " })).toBe("/buscar/");
    });

    it("trims and encodes the query", () => {
      expect(search({ q: "  mesa ratona  " })).toBe("/buscar/?q=mesa+ratona");
      expect(search({ q: "mesa & silla" })).toBe("/buscar/?q=mesa+%26+silla");
    });

    it("keeps accents in the query (normalization belongs to rank.ts)", () => {
      expect(search({ q: "méSa" })).toBe("/buscar/?q=m%C3%A9Sa");
    });

    it("leaves page 1 implicit so it has a single canonical URL", () => {
      expect(search({ q: "mesa", page: 1 })).toBe("/buscar/?q=mesa");
    });

    it("emits pages above 1", () => {
      expect(search({ q: "mesa", page: 3 })).toBe("/buscar/?q=mesa&page=3");
    });

    it("orders q before page deterministically", () => {
      expect(search({ page: 2, q: "mesa" })).toBe(search({ q: "mesa", page: 2 }));
      expect(search({ q: "mesa", page: 2 })).toBe("/buscar/?q=mesa&page=2");
    });

    it.each([[0], [-3], [1.5], [Number.NaN], [Number.POSITIVE_INFINITY]])(
      "drops the unusable page %p instead of forwarding it",
      (page) => {
        expect(search({ q: "mesa", page })).toBe("/buscar/?q=mesa");
      },
    );
  });
});
