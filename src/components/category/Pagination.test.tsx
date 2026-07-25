import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Pagination } from "./Pagination";

/**
 * href assertions below use a loose trailing-slash regex, not an exact
 * string match — same documented artifact as `ProductCard.test.tsx`
 * ("INV-5 is asserted here on the PATH ONLY, deliberately"): `next/link`
 * normalizes away a trailing slash in jsdom because it has no
 * `next.config.ts` (`trailingSlash: true`) loaded to normalize AGAINST. The
 * real trailing-slash behaviour is proven by this PR's `curl` measurement
 * against a built server, not by this component test.
 */
describe("Pagination", () => {
  it("disables Anterior (visibly, via aria-disabled — not hidden) on the first page", () => {
    render(<Pagination page={1} totalPages={3} hrefForPage={(p) => `/categoria/mesas/?page=${p}`} />);

    const prev = screen.getByText("Anterior");
    expect(prev.tagName).toBe("SPAN");
    expect(prev.getAttribute("aria-disabled")).toBe("true");

    const next = screen.getByText("Siguiente");
    expect(next.tagName).toBe("A");
    expect(next.getAttribute("href")).toMatch(/^\/categoria\/mesas\/?\?page=2$/);
  });

  it("disables Siguiente on the last page", () => {
    render(<Pagination page={3} totalPages={3} hrefForPage={(p) => `/categoria/mesas/?page=${p}`} />);

    const next = screen.getByText("Siguiente");
    expect(next.tagName).toBe("SPAN");
    expect(next.getAttribute("aria-disabled")).toBe("true");

    const prev = screen.getByText("Anterior");
    expect(prev.tagName).toBe("A");
    expect(prev.getAttribute("href")).toMatch(/^\/categoria\/mesas\/?\?page=2$/);
  });

  it("disables BOTH controls on a single-page result, rather than hiding pagination", () => {
    render(<Pagination page={1} totalPages={1} hrefForPage={(p) => `/categoria/mesas/?page=${p}`} />);

    expect(screen.getByText("Anterior").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Siguiente").getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
  });

  it("builds page-1 hrefs via the caller's hrefForPage — page 1 omits the query param [INV-5]", () => {
    render(
      <Pagination
        page={2}
        totalPages={2}
        hrefForPage={(p) => (p <= 1 ? "/categoria/mesas/" : `/categoria/mesas/?page=${p}`)}
      />,
    );

    expect(screen.getByText("Anterior").getAttribute("href")).toMatch(/^\/categoria\/mesas\/?$/);
  });
});
