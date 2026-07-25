import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductVariantDTO } from "@/lib/data/products";

import { ProductOptions } from "./ProductOptions";

/**
 * Roble/800 and Roble/1000 both exist; Nogal only exists at 800 (no
 * Nogal/1000 variant) — the impossible pair this suite pins. Nogal/800 is
 * also `priceCents: 0`, which doubles as the D8b consult-price fixture.
 */
const VARIANTS: ProductVariantDTO[] = [
  { sku: "A-1", material: "Roble", sizeMm: "800", priceCents: 100000, salePriceCents: null, inStock: true },
  { sku: "A-2", material: "Roble", sizeMm: "1000", priceCents: 120000, salePriceCents: null, inStock: false },
  { sku: "B-1", material: "Nogal", sizeMm: "800", priceCents: 0, salePriceCents: null, inStock: true },
];

describe("ProductOptions", () => {
  it("[INV-10] never renders a <button> anywhere in the buy column", () => {
    const { container } = render(<ProductOptions variants={VARIANTS} />);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("opens on the first variant in DAL order, priced and resolvable", () => {
    render(<ProductOptions variants={VARIANTS} />);

    expect(screen.getByText("$ 1.000")).toBeInTheDocument();
    expect(screen.getByLabelText("Roble")).toBeChecked();
    expect(screen.getByLabelText("800")).toBeChecked();
  });

  it("[D8] marks an impossible (material, size) pair disabled, not hidden, without changing selection", () => {
    render(<ProductOptions variants={VARIANTS} />);

    // Selecting Nogal while size is still 800 (the only Nogal size) is valid.
    fireEvent.click(screen.getByLabelText("Nogal"));
    expect(screen.getByLabelText("Nogal")).toBeChecked();

    // Nogal/1000 does not exist: still present in the DOM, but disabled.
    const impossibleSize = screen.getByLabelText("1000");
    expect(impossibleSize).toBeInTheDocument();
    expect(impossibleSize).toBeDisabled();
  });

  it("[D8b, INV-1] a consult-price variant replaces the price row and shows the quote-copy availability line, never $0", () => {
    render(<ProductOptions variants={VARIANTS} />);

    fireEvent.click(screen.getByLabelText("Nogal"));

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    expect(screen.getByText("A medida — se cotiza por pedido")).toBeInTheDocument();
    expect(screen.queryByText("En stock")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });

  it("switching material updates the rendered price string (design D8's component-test requirement)", () => {
    render(<ProductOptions variants={VARIANTS} />);

    expect(screen.getByText("$ 1.000")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText("1000"));

    expect(screen.getByText("$ 1.200")).toBeInTheDocument();
    expect(screen.queryByText("$ 1.000")).not.toBeInTheDocument();
  });

  it("renders no selector at all for a dimension whose variants are all null", () => {
    const singleVariant: ProductVariantDTO[] = [
      { sku: "C-1", material: null, sizeMm: null, priceCents: 50000, salePriceCents: null, inStock: true },
    ];

    render(<ProductOptions variants={singleVariant} />);

    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(screen.getByText("$ 500")).toBeInTheDocument();
  });
});
