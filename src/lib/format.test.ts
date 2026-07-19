import { describe, expect, it } from "vitest";
import { formatPriceCents } from "./format";

// Node's ICU data for es-AR/ARS places a non-breaking space (U+00A0)
// between the currency symbol and the amount. Named here (instead of a
// plain space inline) so the invisible character is unambiguous in source.
const NBSP = String.fromCharCode(0xa0);

describe("formatPriceCents", () => {
  it("formats a seeded price (Cajonera Kendall) as es-AR currency", () => {
    expect(formatPriceCents(38990000)).toBe(`$${NBSP}389.900`);
  });

  it("formats a high-ticket price (Escritorio Brent Paraiso) without decimals", () => {
    expect(formatPriceCents(111271300)).toBe(`$${NBSP}1.112.713`);
  });

  it("formats a low-ticket accessory price (Soporte celular)", () => {
    expect(formatPriceCents(613500)).toBe(`$${NBSP}6.135`);
  });

  it("never renders a raw float — cents are divided by 100 before formatting", () => {
    expect(formatPriceCents(100)).toBe(`$${NBSP}1`);
  });
});
