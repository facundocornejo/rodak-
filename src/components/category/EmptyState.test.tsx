import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "./EmptyState";

describe("EmptyState", () => {
  it("renders the caller-supplied message and a link back to the catalog", () => {
    render(<EmptyState message="Todavía no hay productos publicados en esta categoría." />);

    expect(
      screen.getByText("Todavía no hay productos publicados en esta categoría."),
    ).toBeInTheDocument();

    const link = screen.getByRole("link", { name: "Ver el catálogo" });
    expect(link.getAttribute("href")).toBe("/");
  });

  it("renders no product/cart affordance [INV-10] — exactly one link, zero buttons", () => {
    const { container } = render(<EmptyState message="Sin resultados." />);

    expect(container.querySelectorAll("a")).toHaveLength(1);
    expect(container.querySelectorAll("button")).toHaveLength(0);
  });
});
