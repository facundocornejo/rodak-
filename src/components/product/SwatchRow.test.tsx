import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SwatchRow } from "./SwatchRow";
import styles from "./SwatchRow.module.css";

describe("SwatchRow", () => {
  it("renders nothing for an empty materials array (the real catalog's production case)", () => {
    const { container } = render(<SwatchRow materials={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("[D7] renders an unmapped material as a text-only pill with zero swatch elements", () => {
    const { container, getByText } = render(<SwatchRow materials={["Petiribí no mapeado"]} />);

    expect(getByText("Petiribí no mapeado")).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.swatch}`)).toHaveLength(0);
  });

  it("renders a mapped material with a colour swatch dot", () => {
    const { container, getByText } = render(<SwatchRow materials={["Roble"]} />);

    expect(getByText("Roble")).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.swatch}`)).toHaveLength(1);
  });

  it("renders one pill per distinct material, mapped and unmapped mixed", () => {
    const { container } = render(<SwatchRow materials={["Roble", "Fibrofácil no mapeado"]} />);

    expect(container.querySelectorAll(`.${styles.pill}`)).toHaveLength(2);
    expect(container.querySelectorAll(`.${styles.swatch}`)).toHaveLength(1);
  });
});
