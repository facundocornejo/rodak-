import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductVariantDTO } from "@/lib/data/products";

import { ProductOptions } from "./ProductOptions";
import { VariantSelectionProvider } from "./VariantSelectionProvider";

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

function renderOptions(variants: ProductVariantDTO[]) {
  return render(
    <VariantSelectionProvider variants={variants}>
      <ProductOptions variants={variants} />
    </VariantSelectionProvider>,
  );
}

describe("ProductOptions", () => {
  it("[INV-10] never renders a <button> anywhere in the buy column", () => {
    const { container } = renderOptions(VARIANTS);

    expect(container.querySelectorAll("button")).toHaveLength(0);
  });

  it("opens on the first variant in DAL order, priced and resolvable", () => {
    renderOptions(VARIANTS);

    expect(screen.getByText("$ 1.000")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Roble" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "800" })).toHaveAttribute("aria-checked", "true");
  });

  it("[D8, PR6a-review WARNING] marks an impossible (material, size) pair aria-disabled, not native-disabled — and it stays keyboard-reachable", () => {
    renderOptions(VARIANTS);

    // Selecting Nogal while size is still 800 (the only Nogal size) is valid.
    fireEvent.click(screen.getByRole("radio", { name: "Nogal" }));
    expect(screen.getByRole("radio", { name: "Nogal" })).toHaveAttribute("aria-checked", "true");

    // Nogal/1000 does not exist: still present in the DOM, aria-disabled —
    // never the native `disabled` attribute, which would remove it from the
    // tab order entirely (the exact PR6a review WARNING this pins).
    const impossibleSize = screen.getByRole("radio", { name: "1000" });
    expect(impossibleSize).toBeInTheDocument();
    expect(impossibleSize).toHaveAttribute("aria-disabled", "true");
    expect(impossibleSize).not.toHaveAttribute("disabled");
    expect(impossibleSize).toHaveAttribute("tabindex");
  });

  it("[D8] selecting a disabled option is a genuine no-op, whether by click or by Enter/Space", () => {
    renderOptions(VARIANTS);

    fireEvent.click(screen.getByRole("radio", { name: "Nogal" }));
    const impossibleSize = screen.getByRole("radio", { name: "1000" });

    fireEvent.click(impossibleSize);
    expect(impossibleSize).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("radio", { name: "800" })).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(impossibleSize, { key: "Enter" });
    expect(impossibleSize).toHaveAttribute("aria-checked", "false");

    fireEvent.keyDown(impossibleSize, { key: " " });
    expect(impossibleSize).toHaveAttribute("aria-checked", "false");
  });

  it("[D8b, INV-1] a consult-price variant replaces the price row and shows the quote-copy availability line, never $0", () => {
    renderOptions(VARIANTS);

    fireEvent.click(screen.getByRole("radio", { name: "Nogal" }));

    expect(screen.getByText("Consultar precio")).toBeInTheDocument();
    expect(screen.getByText("A medida — se cotiza por pedido")).toBeInTheDocument();
    expect(screen.queryByText("En stock")).not.toBeInTheDocument();
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });

  it("switching material updates the rendered price string (design D8's component-test requirement)", () => {
    renderOptions(VARIANTS);

    expect(screen.getByText("$ 1.000")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "1000" }));

    expect(screen.getByText("$ 1.200")).toBeInTheDocument();
    expect(screen.queryByText("$ 1.000")).not.toBeInTheDocument();
  });

  it("renders no selector at all for a dimension whose variants are all null", () => {
    const singleVariant: ProductVariantDTO[] = [
      { sku: "C-1", material: null, sizeMm: null, priceCents: 50000, salePriceCents: null, inStock: true },
    ];

    renderOptions(singleVariant);

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByText("$ 500")).toBeInTheDocument();
  });
});
