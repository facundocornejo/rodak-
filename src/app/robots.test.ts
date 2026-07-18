import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "./robots";

describe("robots", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disallows indexing by default outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STAGING_HOST", "");

    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("disallows indexing on staging even when NODE_ENV is production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAGING_HOST", "rodak.fromdevdiego.com");

    expect(robots().rules).toEqual({ userAgent: "*", disallow: "/" });
  });

  it("allows indexing once cutover removes STAGING_HOST in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STAGING_HOST", "");

    expect(robots().rules).toEqual({ userAgent: "*", allow: "/" });
  });
});
