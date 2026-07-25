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
  //
  // PR6a-review WARNING, fixed here: this test used to check the link count
  // only at initial mount, which does not actually prove the docblock's claim
  // that the preload link "stays singular ACROSS thumbnail switches" — a
  // regression that added a second `preload` on click would have passed the
  // old version of this test. It now clicks a thumbnail and re-asserts.
  it("[D13-PDP] preloads only media[0]'s image, and STAYS singular after switching the active thumbnail", () => {
    render(<Gallery media={MEDIA} />);

    const initialLinks = document.head.querySelectorAll('link[rel="preload"][as="image"]');
    expect(initialLinks).toHaveLength(1);

    const preloadedSrc =
      initialLinks[0].getAttribute("imagesrcset") ?? initialLinks[0].getAttribute("href") ?? "";
    expect(preloadedSrc).toContain("mesa-kendall-1");

    fireEvent.click(screen.getByLabelText("Ver imagen 2 de 3"));

    const linksAfterSwitch = document.head.querySelectorAll('link[rel="preload"][as="image"]');
    expect(linksAfterSwitch).toHaveLength(1);

    // Still the ORIGINAL media[0] link, not a new one for the now-active
    // media[1] — `Gallery.tsx`'s `preload={activeIndex === 0}` is tied to the
    // index, and the index changed, so this also proves the link is not
    // re-added for the new active image.
    const srcAfterSwitch =
      linksAfterSwitch[0].getAttribute("imagesrcset") ?? linksAfterSwitch[0].getAttribute("href") ?? "";
    expect(srcAfterSwitch).toContain("mesa-kendall-1");
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
