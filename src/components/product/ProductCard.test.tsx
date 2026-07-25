import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductCardDTO } from "@/lib/data/products";

import { ProductCard } from "./ProductCard";

/**
 * The leaf components each prove their own rule, but nothing proved that the
 * CARD wires them together correctly — the composition is where INV-1 and
 * INV-2 actually reach a customer's screen, and a card that simply forgot to
 * render `PriceBlock` would have passed every other test in this directory.
 *
 * The fixture deliberately carries a `stock` key the DTO does not declare:
 * the INV-2 assertion is only meaningful if the value exists and still never
 * reaches the DOM. (`getProductCards` does not even SELECT the column, so this
 * row cannot occur in production — the point is that the component would not
 * leak it even if it did.)
 */
function cardFixture(overrides: Partial<ProductCardDTO> = {}): ProductCardDTO {
  return {
    slug: "mesa-kendall",
    name: "Mesa Kendall",
    categorySlug: "mesas",
    categoryName: "Mesas",
    image: { url: "https://rodak.ar/wp-content/uploads/mesa.jpg", alt: "Mesa Kendall" },
    fromPriceCents: 3899000,
    fromSalePriceCents: null,
    inStock: true,
    materials: [],
    tag: null,
    stock: 7,
    ...overrides,
  } as ProductCardDTO;
}

describe("ProductCard", () => {
  it("[INV-1] a zero-price product shows Consultar precio, never a $ or a 0", () => {
    const { container } = render(
      <ProductCard product={cardFixture({ fromPriceCents: null, fromSalePriceCents: null })} />,
    );

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    expect(container.textContent).not.toContain("$");
    expect(container.textContent).not.toContain("0");
  });

  it("[INV-2] never renders a stock number, even when the row carries one", () => {
    const { container } = render(<ProductCard product={cardFixture({ inStock: true })} />);

    expect(container.textContent).not.toContain("7");
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });

  it("[INV-2] availability comes from inStock alone: false renders the out-of-stock line", () => {
    render(<ProductCard product={cardFixture({ inStock: false })} />);

    expect(screen.getByText("Sin stock")).toBeInTheDocument();
  });

  /**
   * INV-5 is asserted here on the PATH ONLY, deliberately.
   *
   * `routes.product("mesa-kendall")` returns `/producto/mesa-kendall/` and a
   * plain `<a>` renders exactly that — measured. But `next/link` renders
   * `/producto/mesa-kendall`, WITHOUT the slash, because it normalises the
   * href against the `trailingSlash` build setting and jsdom never loads
   * `next.config.ts`. So the slash's fate is decided by Next at build/serve
   * time, not by this component, and asserting it here would only pin a
   * test-environment artifact.
   *
   * That makes it unproven, not proven-fine: a slashless href in the SERVED
   * html means a 308 on every navigation, and a 308 read as a non-2xx already
   * cost this project a deploy cycle on the Coolify healthcheck. PR4b is the
   * first PR that renders a card inside a real route — it must `curl` a built
   * page and confirm the emitted href keeps the slash.
   *
   * MEASURED in PR4b (2026-07-25): `next build && next start` against the
   * real dev database, `curl`'d `/`. All 24 emitted `<a href="/producto/…">`
   * and every `<a href="/categoria/…">` carried the trailing slash; zero did
   * not. The jsdom behaviour above is therefore exactly the test-environment
   * artifact this docblock predicted, not a real bug.
   *
   * The redirect half was measured too, and the numbers are worth stating
   * precisely: `/categoria/barras` (slashless) returns **308** with a
   * `Location` carrying the slash, and `/categoria/barras/` returns **404** —
   * NOT 200 — because no category route exists until PR5 and no product route
   * until PR6. What is proven is the slash and the redirect, not that these
   * destinations resolve; PR5 and PR6 own that.
   *
   * The loose regex here is kept deliberately (not tightened to require the
   * slash) so this component test still passes under jsdom's own behaviour —
   * the real invariant is enforced by the build-time evidence above, not by
   * this assertion.
   */
  it("[INV-5, INV-10] the whole card is one link to the PDP path and nothing else", () => {
    const { container } = render(<ProductCard product={cardFixture()} />);
    const links = container.querySelectorAll("a");

    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toMatch(/^\/producto\/mesa-kendall\/?$/);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("renders no tag badge for the untagged products that are the whole catalog today", () => {
    render(<ProductCard product={cardFixture({ tag: null })} />);

    expect(screen.queryByText("Más vendido")).not.toBeInTheDocument();
    expect(screen.queryByText("Nuevo")).not.toBeInTheDocument();
  });

  it("falls back to a placeholder instead of a broken image when the product has none", () => {
    const { container } = render(<ProductCard product={cardFixture({ image: null })} />);

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});
