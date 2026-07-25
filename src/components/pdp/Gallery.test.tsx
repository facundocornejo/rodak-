import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Gallery } from "./Gallery";

const MEDIA = [
  { url: "https://rodak.ar/wp-content/uploads/mesa-kendall-1.jpg", alt: "Mesa Kendall, vista frontal" },
  { url: "https://rodak.ar/wp-content/uploads/mesa-kendall-2.jpg", alt: "Mesa Kendall, vista lateral" },
  { url: "https://rodak.ar/wp-content/uploads/mesa-kendall-3.jpg", alt: "Mesa Kendall, detalle" },
];

describe("Gallery", () => {
  // Deliberately the only test in this file that reads `document.head`: like
  // `ProductGrid.test.tsx`, `next/image`'s `preload` hoists a `<link>` there
  // via `ReactDOM.preload()`, and that hint survives RTL's unmount/cleanup
  // between tests — a second preload-reading test in the same file would risk
  // observing this test's leftover hint.
  it("[D13-PDP] preloads only media[0]'s image, tied to the initially active index", () => {
    render(<Gallery media={MEDIA} />);

    const preloadLinks = document.head.querySelectorAll('link[rel="preload"][as="image"]');
    expect(preloadLinks).toHaveLength(1);

    const preloadedSrc =
      preloadLinks[0].getAttribute("imagesrcset") ?? preloadLinks[0].getAttribute("href") ?? "";
    expect(preloadedSrc).toContain("mesa-kendall-1");
  });

  it("renders a placeholder, not a crash, when the product has zero media", () => {
    const { container } = render(<Gallery media={[]} />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders no thumbnail row for a single-image product", () => {
    render(<Gallery media={[MEDIA[0]]} />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("switches the active thumbnail on click", () => {
    render(<Gallery media={MEDIA} />);

    const secondThumb = screen.getByLabelText("Ver imagen 2 de 3");
    fireEvent.click(secondThumb);

    expect(secondThumb).toHaveAttribute("aria-current", "true");
  });
});
