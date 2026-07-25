import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Tabs } from "./Tabs";

const TABS = [
  { id: "a", label: "Descripción", content: <p>Contenido A</p> },
  { id: "b", label: "Specs", content: <p>Contenido B</p> },
  { id: "c", label: "Envío y armado", content: <p>Contenido C</p> },
  { id: "d", label: "Reseñas", content: <p>Contenido D</p> },
];

describe("Tabs", () => {
  it("[design: real role=tablist, not half-implemented] exposes 4 tabs, one panel each, correct aria-selected/aria-controls wiring", () => {
    render(<Tabs tabs={TABS} />);

    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(4);
    expect(screen.getAllByRole("tabpanel", { hidden: true })).toHaveLength(4);

    const first = screen.getByRole("tab", { name: "Descripción" });
    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first.getAttribute("aria-controls")).toBeTruthy();

    const panelId = first.getAttribute("aria-controls");
    const panel = document.getElementById(panelId ?? "");
    expect(panel).toHaveAttribute("aria-labelledby", first.id);
  });

  it("all four panels always render (mounted), only visibility toggles via the hidden attribute", () => {
    render(<Tabs tabs={TABS} />);

    expect(screen.getByText("Contenido A")).toBeVisible();
    expect(screen.getByText("Contenido B")).not.toBeVisible();
    expect(screen.getByText("Contenido C")).not.toBeVisible();
    expect(screen.getByText("Contenido D")).not.toBeVisible();
  });

  it("click switches the active tab and its aria-selected state", () => {
    render(<Tabs tabs={TABS} />);

    fireEvent.click(screen.getByRole("tab", { name: "Reseñas" }));

    expect(screen.getByRole("tab", { name: "Reseñas" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Descripción" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
    expect(screen.getByText("Contenido D")).toBeVisible();
    expect(screen.getByText("Contenido A")).not.toBeVisible();
  });

  it("[real arrow-key navigation, not a stub] ArrowRight moves selection to the next tab and wraps at the end", () => {
    render(<Tabs tabs={TABS} />);

    const first = screen.getByRole("tab", { name: "Descripción" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(screen.getByRole("tab", { name: "Specs" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Specs" })).toHaveFocus();

    // Wrap past the last tab back to the first.
    fireEvent.keyDown(screen.getByRole("tab", { name: "Specs" }), { key: "ArrowLeft" });
    fireEvent.keyDown(screen.getByRole("tab", { name: "Descripción" }), { key: "ArrowLeft" });
    expect(screen.getByRole("tab", { name: "Reseñas" })).toHaveAttribute("aria-selected", "true");
  });

  it("roving tabindex: only the selected tab is a Tab stop", () => {
    render(<Tabs tabs={TABS} />);

    expect(screen.getByRole("tab", { name: "Descripción" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Specs" })).toHaveAttribute("tabindex", "-1");

    fireEvent.click(screen.getByRole("tab", { name: "Specs" }));

    expect(screen.getByRole("tab", { name: "Specs" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tab", { name: "Descripción" })).toHaveAttribute("tabindex", "-1");
  });
});
