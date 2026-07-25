import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CategoryGridSkeleton } from "./CategoryGridSkeleton";

/**
 * PR6a review WARNING (see this file's own docblock): the previous
 * `PLACEHOLDER_COUNT` of 8 under-reserved space on almost every real
 * category (most hold more than 8 products), so the footer/pagination
 * visibly jumped down once the real grid replaced the skeleton. That
 * regression shipped with NO test pinning the count — reverting the fix
 * would leave the suite green. This test closes that gap.
 */
describe("CategoryGridSkeleton", () => {
  it("[PR6a review WARNING] reserves 24 placeholder rows, matching PRODUCT_PAGE_SIZE (the grid's real max)", () => {
    const { container } = render(<CategoryGridSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(24);
  });

  it("is presentational-only: aria-hidden, so it never competes with the real grid for assistive-tech attention", () => {
    const { container } = render(<CategoryGridSkeleton />);

    expect(container.querySelector("ul")).toHaveAttribute("aria-hidden", "true");
  });
});
