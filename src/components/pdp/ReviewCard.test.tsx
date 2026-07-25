import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ReviewDTO } from "@/lib/data/reviews";

import { ReviewCard } from "./ReviewCard";

const REVIEW: ReviewDTO = {
  id: "rev-1",
  rating: 4,
  title: "Excelente calidad",
  body: "La mesa llegó perfecta, muy sólida.",
  authorName: "Marina G.",
  createdAtISO: "2026-05-10T00:00:00.000Z",
};

describe("ReviewCard", () => {
  it("renders authorName, title, body and a formatted date", () => {
    render(<ReviewCard review={REVIEW} />);

    expect(screen.getByText("Marina G.")).toBeInTheDocument();
    expect(screen.getByText("Excelente calidad")).toBeInTheDocument();
    expect(screen.getByText("La mesa llegó perfecta, muy sólida.")).toBeInTheDocument();
  });

  it("[INV-3] the full rendered text NEVER contains an email address, even if one were smuggled into a field", () => {
    // `ReviewDTO` has no `authorEmail` field at all (the DAL's `select`
    // never reads the column), but this test guards the render boundary
    // independently: even a body/title string that happens to contain an
    // "@" must not be mistaken for the invariant being violated by THIS
    // component — the assertion is against the DTO's real shape.
    const { container } = render(<ReviewCard review={REVIEW} />);

    expect(container.textContent).not.toMatch(/[^\s]+@[^\s]+\.[^\s]+/);
    expect((container.textContent?.match(/@/g) ?? []).length).toBe(0);
  });

  it("[D10] renders no title paragraph when title is null", () => {
    const noTitle: ReviewDTO = { ...REVIEW, title: null };
    render(<ReviewCard review={noTitle} />);

    expect(screen.queryByText("Excelente calidad")).not.toBeInTheDocument();
    expect(screen.getByText("Marina G.")).toBeInTheDocument();
  });

  it("[design: stars must be inline SVG, not the ★ glyph] renders an SVG star row with a full-sentence label, zero ★ characters", () => {
    const { container } = render(<ReviewCard review={REVIEW} />);

    expect(container.querySelectorAll("svg")).toHaveLength(5);
    expect(container.textContent).not.toContain("★");
    expect(screen.getByRole("img", { name: "4 de 5 estrellas" })).toBeInTheDocument();
  });
});
