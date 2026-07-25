/**
 * Setup for the `dom` vitest project only (see `vitest.config.ts`).
 *
 * 1. Registers `@testing-library/jest-dom`'s matchers (`toBeInTheDocument`,
 *    `toBeDisabled`, …) on vitest's `expect`.
 * 2. Unmounts rendered trees between tests. Testing Library only auto-registers
 *    that cleanup when `afterEach` is a global, and this suite runs WITHOUT
 *    `globals: true` (the existing node tests import from `vitest` explicitly).
 *    Without this hook every `render` would leak into the next test's document.
 */
import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
