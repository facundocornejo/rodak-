import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DescriptionTab } from "./DescriptionTab";

const FALLBACK = "Todavía no cargamos la descripción de este producto.";

describe("DescriptionTab", () => {
  it("renders the real description when present", () => {
    render(<DescriptionTab description="Mesa maciza de roble con patas en hierro." />);

    expect(screen.getByText("Mesa maciza de roble con patas en hierro.")).toBeInTheDocument();
    expect(screen.queryByText(FALLBACK)).not.toBeInTheDocument();
  });

  it("[R11] renders the honest fallback line for a null description, never a blank panel", () => {
    render(<DescriptionTab description={null} />);

    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("[R11] renders the same fallback for an empty-string description — the DAL passes both shapes through", () => {
    render(<DescriptionTab description="" />);

    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });

  it("treats a whitespace-only description as empty too", () => {
    render(<DescriptionTab description="   " />);

    expect(screen.getByText(FALLBACK)).toBeInTheDocument();
  });
});
