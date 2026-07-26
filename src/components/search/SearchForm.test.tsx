import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { search } from "@/lib/routes";

// Same `next/navigation` stubbing idiom as
// `src/app/(shop)/categoria/[slug]/page.test.tsx`.
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const { SearchForm } = await import("./SearchForm");

beforeEach(() => {
  pushMock.mockReset();
});

describe("SearchForm — progressive enhancement baseline", () => {
  it("is a real <form method=\"get\"> targeting the bare search path, so it works with JavaScript disabled", () => {
    render(<SearchForm />);

    const form = screen.getByRole("search");
    expect(form.tagName).toBe("FORM");
    expect(form).toHaveAttribute("method", "get");
    // `action` must be `routes.search()`'s bare path — the exact target the
    // browser's own GET submission would assemble `?q=...` onto.
    expect(form).toHaveAttribute("action", search());
  });

  it("has a real <label htmlFor> wired to the input, not just a placeholder", () => {
    render(<SearchForm />);

    expect(screen.getByLabelText("Buscar productos")).toBeInTheDocument();
  });
});

describe("SearchForm — onSubmit (design D-search, the progressive-enhancement JS path)", () => {
  it("submitting the form routes through routes.search({q}) — the SAME URL shape the native GET fallback would produce", () => {
    render(<SearchForm />);

    fireEvent.change(screen.getByLabelText("Buscar productos"), {
      target: { value: "mesa" },
    });
    fireEvent.submit(screen.getByRole("search"));

    expect(pushMock).toHaveBeenCalledTimes(1);
    expect(pushMock).toHaveBeenCalledWith(search({ q: "mesa" }));
  });

  it("a fresh search always resets to page 1, never carrying over a previous ?page= [INV-5]", () => {
    // `initialQuery` simulates arriving on `/buscar/?q=mesa&page=3`; the
    // component itself has no notion of the current page (it never reads
    // `?page=`), which is exactly what forces the reset.
    render(<SearchForm initialQuery="mesa" />);

    fireEvent.change(screen.getByLabelText("Buscar productos"), {
      target: { value: "silla" },
    });
    fireEvent.submit(screen.getByRole("search"));

    const pushedHref = pushMock.mock.calls[0]?.[0] as string;
    expect(pushedHref).toBe(search({ q: "silla" }));
    expect(pushedHref).not.toContain("page=");
  });

  it("keeps showing the previously-searched query after a reload (initialQuery prop)", () => {
    render(<SearchForm initialQuery="mesa" />);

    expect(screen.getByLabelText("Buscar productos")).toHaveValue("mesa");
  });
});
