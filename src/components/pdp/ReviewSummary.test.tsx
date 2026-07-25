import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewSummaryDTO } from "@/lib/data/reviews";

import { ReviewSummary } from "./ReviewSummary";

const SUMMARY: ReviewSummaryDTO = {
  count: 4,
  average: 4.25,
  histogram: { 1: 0, 2: 0, 3: 1, 4: 1, 5: 2 },
};

describe("ReviewSummary", () => {
  it("renders the average (one decimal), the pluralized count and a 5-star SVG row", () => {
    const { container } = render(<ReviewSummary summary={SUMMARY} />);

    expect(screen.getByText("4.3")).toBeInTheDocument();
    expect(screen.getByText("4 reseñas")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(5);
  });

  it("singularizes the count for exactly one review", () => {
    render(<ReviewSummary summary={{ count: 1, average: 5, histogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } }} />);

    expect(screen.getByText("1 reseña")).toBeInTheDocument();
  });

  it("renders one histogram row per rating, 5 down to 1, each labelled by its rating value", () => {
    const { container } = render(<ReviewSummary summary={SUMMARY} />);

    const labels = Array.from(container.querySelectorAll('[class*="histogramLabel"]')).map(
      (el) => el.textContent,
    );
    expect(labels).toEqual(["5", "4", "3", "2", "1"]);
  });
});
