import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProductTagBadge } from "./ProductTagBadge";

describe("ProductTagBadge", () => {
  it("renders nothing when tag is null", () => {
    const { container } = render(<ProductTagBadge tag={null} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders the Spanish label for BEST_SELLER", () => {
    const { getByText } = render(<ProductTagBadge tag="BEST_SELLER" />);

    expect(getByText("Más vendido")).toBeInTheDocument();
  });

  it("renders the Spanish label for NEW", () => {
    const { getByText } = render(<ProductTagBadge tag="NEW" />);

    expect(getByText("Nuevo")).toBeInTheDocument();
  });
});
