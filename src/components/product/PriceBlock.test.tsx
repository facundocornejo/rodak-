import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PriceBlock } from "./PriceBlock";

describe("PriceBlock", () => {
  it('[INV-1] renders "Consultar precio" with no "$" and no literal "0" when priceCents is 0', () => {
    const { container } = render(<PriceBlock priceCents={0} />);

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    expect(container.textContent).not.toContain("$");
    expect(container.textContent).not.toContain("0");
  });

  it('renders "Consultar precio" when priceCents is null (card: no priced variant)', () => {
    const { container } = render(<PriceBlock priceCents={null} salePriceCents={null} />);

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    expect(container.textContent).not.toContain("$");
    expect(container.textContent).not.toContain("0");
  });

  it("renders Consultar precio for a corrupt negative price, matching isConsultPrice's <=0 rule", () => {
    render(<PriceBlock priceCents={-100} />);

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
  });

  it("renders a plain formatted price when there is no sale", () => {
    render(<PriceBlock priceCents={3899000} />);

    expect(screen.getByText("$ 38.990")).toBeInTheDocument();
  });

  it("renders both sale and struck-through list price when salePriceCents is set", () => {
    render(<PriceBlock priceCents={3899000} salePriceCents={2999000} />);

    expect(screen.getByText("$ 29.990")).toBeInTheDocument();
    expect(screen.getByText("$ 38.990")).toBeInTheDocument();
  });

  it("ignores a sale price that is not actually a discount (defense in depth)", () => {
    // The DAL already normalizes this away, but the component must not
    // render a nonsensical "was $100 / now $120" if it ever receives one.
    render(<PriceBlock priceCents={3899000} salePriceCents={3899000} />);

    expect(screen.getByText("$ 38.990")).toBeInTheDocument();
    expect(screen.queryAllByText("$ 38.990")).toHaveLength(1);
  });
});
