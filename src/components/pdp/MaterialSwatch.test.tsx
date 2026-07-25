import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MaterialSwatch } from "./MaterialSwatch";
import styles from "./MaterialSwatch.module.css";

describe("MaterialSwatch", () => {
  it("[D7] renders an unmapped material as a text-only pill with zero swatch-dot elements", () => {
    const { container } = render(<MaterialSwatch material="Petiribí no mapeado" />);

    expect(screen.getByText("Petiribí no mapeado")).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.dot}`)).toHaveLength(0);
  });

  it("renders a mapped material with a colour swatch dot", () => {
    const { container } = render(<MaterialSwatch material="Roble" />);

    expect(screen.getByText("Roble")).toBeInTheDocument();
    expect(container.querySelectorAll(`.${styles.dot}`)).toHaveLength(1);
  });

  it("normalizes case/accents to the same mapped entry (materials.ts's normalizeMaterial)", () => {
    const { container } = render(<MaterialSwatch material="ROBLE" />);

    expect(container.querySelectorAll(`.${styles.dot}`)).toHaveLength(1);
  });
});
