import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Availability } from "./Availability";

describe("Availability", () => {
  it('[INV-2] renders "En stock" when inStock is true', () => {
    render(<Availability inStock={true} />);

    expect(screen.getByText("En stock")).toBeInTheDocument();
    expect(screen.queryByText("Sin stock")).not.toBeInTheDocument();
  });

  it('[INV-2] renders "Sin stock" when inStock is false — text derives ONLY from inStock', () => {
    render(<Availability inStock={false} />);

    expect(screen.getByText("Sin stock")).toBeInTheDocument();
    expect(screen.queryByText("En stock")).not.toBeInTheDocument();
  });
});
