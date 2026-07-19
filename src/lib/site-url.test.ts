import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("falls back to localhost when neither SITE_URL nor STAGING_HOST is set", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("STAGING_HOST", "");

    expect(getSiteUrl()).toBe("http://localhost:3000");
  });

  it("derives an https URL from STAGING_HOST when SITE_URL is unset", () => {
    vi.stubEnv("SITE_URL", "");
    vi.stubEnv("STAGING_HOST", "rodak.fromdevdiego.com");

    expect(getSiteUrl()).toBe("https://rodak.fromdevdiego.com");
  });

  it("prefers SITE_URL over a STAGING_HOST-derived URL", () => {
    vi.stubEnv("SITE_URL", "https://rodak.com.ar");
    vi.stubEnv("STAGING_HOST", "rodak.fromdevdiego.com");

    expect(getSiteUrl()).toBe("https://rodak.com.ar");
  });

  it("never falls back to localhost once SITE_URL is set, even without STAGING_HOST", () => {
    vi.stubEnv("SITE_URL", "https://rodak.com.ar");
    vi.stubEnv("STAGING_HOST", "");

    expect(getSiteUrl()).toBe("https://rodak.com.ar");
  });
});
