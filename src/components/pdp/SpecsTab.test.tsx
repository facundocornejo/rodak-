import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProductVariantDTO } from "@/lib/data/products";

import { ProductOptions } from "./ProductOptions";
import { SpecsTab } from "./SpecsTab";
import { VariantSelectionProvider } from "./VariantSelectionProvider";

const VARIANTS: ProductVariantDTO[] = [
  { sku: "A-1", material: null, sizeMm: "800", priceCents: 100000, salePriceCents: null, inStock: true },
  { sku: "A-2", material: null, sizeMm: "1000", priceCents: 120000, salePriceCents: null, inStock: false },
];

function renderSpecs(variants: ProductVariantDTO[], categoryName: string | null) {
  return render(
    <VariantSelectionProvider variants={variants}>
      <SpecsTab variants={variants} categoryName={categoryName} />
    </VariantSelectionProvider>,
  );
}

describe("SpecsTab", () => {
  it("[GATE-2, real-catalog shape] omits the Materiales row entirely when every variant has material===null", () => {
    renderSpecs(VARIANTS, "Mesas");

    expect(screen.queryByText("Materiales")).not.toBeInTheDocument();
  });

  it("renders the Materiales row from distinct structured `variant.material` values, never from description prose", () => {
    const withMaterial: ProductVariantDTO[] = [
      { sku: "B-1", material: "Roble", sizeMm: "800", priceCents: 100000, salePriceCents: null, inStock: true },
      { sku: "B-2", material: "Nogal", sizeMm: "800", priceCents: 100000, salePriceCents: null, inStock: true },
    ];

    renderSpecs(withMaterial, "Mesas");

    expect(screen.getByText("Materiales")).toBeInTheDocument();
    expect(screen.getByText("Roble, Nogal")).toBeInTheDocument();
  });

  it("renders free-form Medidas strings as-is, with no attempt to parse them into numbers", () => {
    const freeForm: ProductVariantDTO[] = [
      {
        sku: "C-1",
        material: null,
        sizeMm: "1000x400x600 (Ancho x profundidad x alto )",
        priceCents: 100000,
        salePriceCents: null,
        inStock: true,
      },
    ];

    renderSpecs(freeForm, "Mesas");

    expect(
      screen.getByText("1000x400x600 (Ancho x profundidad x alto )"),
    ).toBeInTheDocument();
  });

  it("always renders SKU and Categoría rows, falling back to 'Sin datos.' for a null category", () => {
    renderSpecs(VARIANTS, null);

    expect(screen.getByText("SKU")).toBeInTheDocument();
    expect(screen.getByText("Categoría")).toBeInTheDocument();
    expect(screen.getByText("Sin datos.")).toBeInTheDocument();
  });

  it("[design decision: Specs' SKU is reactive] SKU updates when a sibling ProductOptions changes the shared selection", () => {
    // Mounts both consumers under the SAME provider, exactly as
    // `producto/[slug]/page.tsx` does — this is the test that proves the
    // `VariantSelectionProvider` refactor actually closes the gap (Specs'
    // SKU must track the buy column's live selection, not just the default).
    render(
      <VariantSelectionProvider variants={VARIANTS}>
        <ProductOptions variants={VARIANTS} />
        <SpecsTab variants={VARIANTS} categoryName="Mesas" />
      </VariantSelectionProvider>,
    );

    expect(screen.getByText("A-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "1000" }));

    expect(screen.getByText("A-2")).toBeInTheDocument();
    expect(screen.queryByText("A-1")).not.toBeInTheDocument();
  });
});
